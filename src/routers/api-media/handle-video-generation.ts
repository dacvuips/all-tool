import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken/apiMediaToken.model";
import { Context } from "../../libs/graphql";
import { processAndUploadImages } from "../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData } from "../helpers/validateApiKey";

/**
 * Xử lý logic generate video:
 * - Validate body & prompt
 * - Upload ảnh lên Google Labs (nếu có)
 * - Setup SSE headers
 * - Gọi Aisandbox API tạo video
 * - Poll kết quả và stream về client
 * - Tăng usedQuantity sau khi thành công
 */
export async function handleVideoGeneration(
  req: Request,
  res: Response,
  captchaData: CaptchaResponseData,
  tokenKey: string
): Promise<void> {
  const body = req.body as {
    prompt: string;
    images?: Array<
      | string // URL ảnh
      | { imageBytes: string; mimeType?: string } // base64
    >;
    config?: {
      aspectRatio?: string;
      generateAudio?: boolean;
    };
  };
  if (!body?.prompt) {
    res.status(400).json({ message: "Thiếu prompt" });
    return;
  }
  // Upload ảnh lên Google Labs trước nếu có
  const context = new Context({ req });
  const uploadedImageNames = await processAndUploadImages(
    body.images || [],
    captchaData.Headers.Authorization,
    captchaData.ProjectID,
    context.id
  );

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  // Tao video
  const { mediaName } = await callAisandboxAPI({
    prompt: body.prompt,
    aspectRatio: body.config?.aspectRatio,
    uploadedImageNames,
    recaptchaToken: captchaData.captcha,
    sessionId: captchaData.sessionId,
    projectId: captchaData.ProjectID,
    accessToken: captchaData.Headers.Authorization,
  });

  await pollAndExtractVideo({
    mediaName,
    accessToken: captchaData.Headers.Authorization,
    customerId: context.id,

    res,
  });

  // Tăng usedQuantity sau khi generate video thành công (atomic $inc, tìm theo API key)
  await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });

  res.json({
    reCaptchaToken: captchaData.captcha,
  });
}

interface CallAisandboxParams {
  prompt: string;
  aspectRatio?: string;
  uploadedImageNames?: string[];
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
    uploadedImageNames,
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
  if (uploadedImageNames && uploadedImageNames.length > 0) {
    videoRequest.referenceImages = uploadedImageNames.map((mediaId) => ({
      mediaId,
      imageUsageType: "IMAGE_USAGE_TYPE_ASSET",
    }));
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

interface PollAndExtractVideoParams {
  mediaName: string;
  accessToken: string;
  customerId: string;
  res: Response;
}

/**
 * Poll media endpoint cho đến khi video generation hoàn tất,
 * extract video data và gửi kết quả qua SSE.
 */
export async function pollAndExtractVideo(params: PollAndExtractVideoParams): Promise<void> {
  const { mediaName, accessToken, customerId, res } = params;

  // Poll media endpoint until video generation completes
  const MAX_POLLS = 360; // max ~30 minutes (5s * 360)
  let pollCount = 0;
  let mediaResult: any = null;
  let generationStatus = "MEDIA_GENERATION_STATUS_PENDING";

  while (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL" && pollCount < MAX_POLLS) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s interval
    pollCount++;

    const progress = Math.min(15 + Math.round((pollCount / MAX_POLLS) * 75), 90);

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

    res.end();
    return;
  }

  logger.info(`[generation-video] Completed media result: ${JSON.stringify(mediaResult)}`);

  // Extract fifeUrl from operation metadata
  const fifeUrl: string | null = mediaResult?.operation?.metadata?.video?.fifeUrl || null;

  if (!fifeUrl) {
    logger.info(`[generation-video] No fifeUrl found in result: ${JSON.stringify(mediaResult)}`);

    res.end();
    return;
  }

  logger.info(`[generation-video] fifeUrl: ${fifeUrl}`);

  res.end();
}
