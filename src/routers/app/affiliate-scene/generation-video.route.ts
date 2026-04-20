import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  ActionEnum,
  checkVideoLimit,
  getReCaptchaCredentials,
  incrementVideoCount,
} from "./_shared";

interface PollAndExtractVideoParams {
  mediaName: string;
  accessToken: string;
  customerId: string;
  sendSSE: (data: any) => void;
  res: Response;
}

/**
 * Poll media endpoint cho đến khi video generation hoàn tất,
 * extract video data và gửi kết quả qua SSE.
 */
async function pollAndExtractVideo(params: PollAndExtractVideoParams): Promise<void> {
  const { mediaName, accessToken, customerId, sendSSE, res } = params;

  // Poll media endpoint until video generation completes
  const MAX_POLLS = 360; // max ~30 minutes (5s * 360)
  let pollCount = 0;
  let mediaResult: any = null;
  let generationStatus = "MEDIA_GENERATION_STATUS_PENDING";

  while (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL" && pollCount < MAX_POLLS) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s interval
    pollCount++;

    const progress = Math.min(15 + Math.round((pollCount / MAX_POLLS) * 75), 90);
    sendSSE({
      type: "progress",
      progress,
      message: `Đang tạo video... (${pollCount * 5}s)`,
    });

    try {
      const pollResp = await fetch(
        "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            operations: [
              {
                operation: {
                  name: mediaName,
                },
              },
            ],
          }),
        }
      );
      if (pollResp.ok) {
        const pollData = await pollResp.json();
        // Response is an array: [{ operations: [{ operation: {...}, status: "..." }], remainingCredits: ... }]
        const result = Array.isArray(pollData) ? pollData[0] : pollData;
        const operationResult = result?.operations?.[0];
        generationStatus = operationResult?.status || "MEDIA_GENERATION_STATUS_PENDING";
        mediaResult = operationResult;
        logger.info(`[generation-video] Poll #${pollCount}: status=${generationStatus}`);
        logger.info(`[generation-video] Poll #${pollCount}: result=${JSON.stringify(mediaResult)}`);

        // Nếu status FAILED → dừng polling ngay
        if (generationStatus === "MEDIA_GENERATION_STATUS_FAILED") {
          logger.warn(`[generation-video] Video generation failed at poll #${pollCount}`);
          break;
        }
      } else {
        const errText = await pollResp.text();
        logger.warn(`[generation-video] Poll error ${pollResp.status}: ${errText}`);
      }
    } catch (pollErr: any) {
      logger.warn(`[generation-video] Poll error: ${pollErr?.message}`);
    }
  }

  if (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
    const errorMsg =
      pollCount >= MAX_POLLS
        ? "Quá thời gian chờ tạo video"
        : `Tạo video thất bại: ${generationStatus}`;
    logger.info(
      `[generation-video] Final status: ${generationStatus}, pollCount: ${pollCount}, result: ${JSON.stringify(
        mediaResult
      )}`
    );
    sendSSE({ type: "error", message: errorMsg });
    res.end();
    return;
  }

  sendSSE({ type: "progress", progress: 95, message: "Đang lấy kết quả..." });
  logger.info(`[generation-video] Completed media result: ${JSON.stringify(mediaResult)}`);

  // Extract fifeUrl from operation metadata
  const fifeUrl: string | null = mediaResult?.operation?.metadata?.video?.fifeUrl || null;

  if (!fifeUrl) {
    logger.info(`[generation-video] No fifeUrl found in result: ${JSON.stringify(mediaResult)}`);
    sendSSE({ type: "error", message: "Không nhận được video từ API" });
    res.end();
    return;
  }

  logger.info(`[generation-video] fifeUrl: ${fifeUrl}`);
  await incrementVideoCount(customerId);

  sendSSE({
    type: "done",
    progress: 100,
    data: {
      videoUri: fifeUrl,
      mimeType: "video/mp4",
    },
  });

  res.end();
}

export default [
  {
    method: "post",
    path: "/api/app/generation-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          image?: { imageBytes: string; mimeType: string };
          config?: {
            aspectRatio?: string;
            generateAudio?: boolean;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);
        // Lấy captcha + credentials + projectId + accessToken
        const {
          captcha: recaptchaToken,
          sessionId,
          projectId,
          accessToken,
        } = await getReCaptchaCredentials(ActionEnum.VIDEO_GENERATION);
        // Upload ảnh lên Google Labs trước nếu có
        let uploadedImageName: string | null = null;
        if (body.image?.imageBytes) {
          logger.info(`[generation-video] Đang upload ảnh lên Google Labs cho user ${context.id}`);
          uploadedImageName = await uploadImageToGoogleLabs(
            body.image.imageBytes,
            body.image.mimeType || "image/jpeg",
            accessToken,
            projectId
          );
          logger.info(`[generation-video] Upload ảnh thành công, name: ${uploadedImageName}`);
        }

        logger.info(`[generation-video] Gọi Veo 3.1 fast (aisandbox) cho user ${context.id}`);

        // Setup SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendSSE({ type: "progress", progress: 5, message: "Đang khởi tạo..." });

        sendSSE({
          type: "progress",
          progress: 10,
          message: "Đã lấy credentials, đang gửi yêu cầu...",
        });

        const { mediaName } = await callAisandboxAPI({
          prompt: body.prompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageName,
          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
        });

        sendSSE({ type: "progress", progress: 15, message: "Đã gửi yêu cầu, đang chờ xử lý..." });

        logger.info(`[generation-video] Polling mediaName: ${mediaName}`);

        await pollAndExtractVideo({
          mediaName,
          accessToken,
          customerId: context.id,
          sendSSE,
          res,
        });
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
          );
          res.end();
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];

interface CallAisandboxParams {
  prompt: string;
  aspectRatio?: string;
  uploadedImageName?: string | null;
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
}

/**
 * Gọi Aisandbox API: build payload từ raw params, gọi API với retry, parse response và trả về mediaName.
 */
export async function callAisandboxAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const {
    prompt,
    aspectRatio,
    uploadedImageName,
    recaptchaToken,
    sessionId,
    projectId,
    accessToken,
  } = params;
  const label = "generation-video";

  // Map aspectRatio sang format aisandbox
  const aspectRatioInput = aspectRatio || "9:16";
  let videoAspectRatio = "VIDEO_ASPECT_RATIO_PORTRAIT";
  if (aspectRatioInput === "16:9" || aspectRatioInput === "landscape") {
    videoAspectRatio = "VIDEO_ASPECT_RATIO_LANDSCAPE";
  } else if (aspectRatioInput === "1:1" || aspectRatioInput === "square") {
    videoAspectRatio = "VIDEO_ASPECT_RATIO_SQUARE";
  } else if (aspectRatioInput === "9:16" || aspectRatioInput === "portrait") {
    videoAspectRatio = "VIDEO_ASPECT_RATIO_PORTRAIT";
  }

  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);

  // Build request object
  const videoRequest: any = {
    aspectRatio: videoAspectRatio,
    seed,
    textInput: {
      structuredPrompt: {
        parts: [{ text: prompt }],
      },
    },
    videoModelKey: "veo_3_1_r2v_fast_portrait_ultra",
    metadata: {},
  };

  // Nếu có image đã upload → thêm referenceImages
  if (uploadedImageName) {
    videoRequest.referenceImages = [
      {
        mediaId: uploadedImageName,
        imageUsageType: "IMAGE_USAGE_TYPE_ASSET",
      },
    ];
  }

  const payload = {
    mediaGenerationContext: {
      batchId,
    },
    clientContext: {
      projectId,
      tool: "PINHOLE",
      userPaygateTier: "PAYGATE_TIER_TWO",
      sessionId,
      recaptchaContext: {
        token: recaptchaToken,
        applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
      },
    },
    requests: [videoRequest],
    useV2ModelConfig: true,
  };

  const endpoint =
    "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages";
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const err: any = new Error(`Aisandbox API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }
  const response = await resp.json();

  // Log full response for debugging
  logger.info(`[${label}] Full response: ${JSON.stringify(response)}`);

  // Aisandbox API trả về mảng:
  // [{ operations: [{ operation: { name: "mediaName" }, status: "..." }],
  //    media: [{ name: "mediaName", ... }] }]
  const result = Array.isArray(response) ? response[0] : response;
  const operations = result?.operations || [];
  const mediaName =
    operations[0]?.operation?.name || // aisandbox format
    result?.media?.[0]?.name || // fallback from media array
    null;

  if (!mediaName) {
    logger.info(`[${label}] No mediaName found in response`);
    const err: any = new Error("Không nhận được operation ID từ API");
    err.statusCode = 500;
    throw err;
  }

  logger.info(`[${label}] Extracted mediaName: ${mediaName}`);
  return { response, mediaName };
}
