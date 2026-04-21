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

  // Tao video
  const { mediaName } = await callAisandboxVideoAPI({
    res: res,
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
}

interface CallAisandboxParams {
  res: Response;
  prompt: string;
  aspectRatio?: string;
  uploadedImageNames?: string[];
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
}

/**
 * Gọi Aisandbox API: dispatch sang hàm xử lý phù hợp dựa trên số lượng ảnh.
 */
export async function callAisandboxVideoAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const { uploadedImageNames } = params;
  const imageCount = uploadedImageNames?.length || 0;

  // Setup SSE headers
  params.res.setHeader("Content-Type", "text/event-stream");
  params.res.setHeader("Cache-Control", "no-cache");
  params.res.setHeader("Connection", "keep-alive");
  params.res.flushHeaders();

  if (imageCount === 0) {
    return callTextOnlyAPI(params);
  } else if (imageCount === 1) {
    return callStartImageAPI(params);
  } else if (imageCount === 2) {
    return callStartAndEndImageAPI(params);
  } else {
    return callReferenceImagesAPI(params);
  }
}

// ── Helpers dùng chung ──────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: string): string {
  const input = aspectRatio || "9:16";
  if (input === "16:9" || input === "landscape") return "VIDEO_ASPECT_RATIO_LANDSCAPE";
  if (input === "1:1" || input === "square") return "VIDEO_ASPECT_RATIO_SQUARE";
  return "VIDEO_ASPECT_RATIO_PORTRAIT";
}

function buildClientContext(params: CallAisandboxParams) {
  return {
    projectId: params.projectId,
    tool: "PINHOLE",
    userPaygateTier: "PAYGATE_TIER_TWO",
    sessionId: params.sessionId,
    recaptchaContext: {
      token: params.recaptchaToken,
      applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
    },
  };
}

async function sendAndParseResponse(
  endpoint: string,
  payload: any,
  accessToken: string
): Promise<{ response: any; mediaName: string }> {
  const label = "generation-video";
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

  logger.info(`[${label}] Full response: ${JSON.stringify(response)}`);

  const result = Array.isArray(response) ? response[0] : response;
  const operations = result?.operations || [];
  const mediaName = operations[0]?.operation?.name || result?.media?.[0]?.name || null;

  if (!mediaName) {
    logger.info(`[${label}] No mediaName found in response`);
    const err: any = new Error("Không nhận được operation ID từ API");
    err.statusCode = 500;
    throw err;
  }

  logger.info(`[${label}] Extracted mediaName: ${mediaName}`);
  return { response, mediaName };
}

// ── Case 1: Không có ảnh → Text-to-Video ────────────────────────────────────

/**
 * Chỉ có prompt, không có ảnh → gọi endpoint batchAsyncGenerateVideoText
 */
async function callTextOnlyAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);

  const payload = {
    mediaGenerationContext: {
      batchId,
      audioFailurePreference: "BLOCK_SILENCED_VIDEOS",
    },
    clientContext: buildClientContext(params),
    requests: [
      {
        aspectRatio: videoAspectRatio,
        seed,
        textInput: {
          structuredPrompt: {
            parts: [{ text: params.prompt }],
          },
        },
        videoModelKey: "veo_3_1_t2v_fast_portrait_ultra",
        metadata: {},
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint = "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText";
  return sendAndParseResponse(endpoint, payload, params.accessToken);
}

// ── Case 2: 1 ảnh → Start Image ─────────────────────────────────────────────

/**
 * 1 ảnh upload → gọi endpoint batchAsyncGenerateVideoStartImage (startImage)
 */
async function callStartImageAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);

  const payload = {
    mediaGenerationContext: {
      batchId,
      audioFailurePreference: "BLOCK_SILENCED_VIDEOS",
    },
    clientContext: buildClientContext(params),
    requests: [
      {
        aspectRatio: videoAspectRatio,
        seed,
        textInput: {
          structuredPrompt: {
            parts: [{ text: params.prompt }],
          },
        },
        videoModelKey: "veo_3_1_i2v_s_fast_portrait_ultra",
        metadata: {},
        startImage: {
          mediaId: params.uploadedImageNames![0],
        },
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint = "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage";
  return sendAndParseResponse(endpoint, payload, params.accessToken);
}

// ── Case 3: 2 ảnh → Start + End Image ───────────────────────────────────────

/**
 * 2 ảnh upload → gọi endpoint batchAsyncGenerateVideoStartAndEndImage
 * (startImage = ảnh đầu, endImage = ảnh thứ 2)
 */
async function callStartAndEndImageAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);

  const payload = {
    mediaGenerationContext: {
      batchId,
      audioFailurePreference: "BLOCK_SILENCED_VIDEOS",
    },
    clientContext: buildClientContext(params),
    requests: [
      {
        aspectRatio: videoAspectRatio,
        seed,
        textInput: {
          structuredPrompt: {
            parts: [{ text: params.prompt }],
          },
        },
        videoModelKey: "veo_3_1_i2v_s_fast_portrait_ultra_fl",
        metadata: {},
        startImage: {
          mediaId: params.uploadedImageNames![0],
        },
        endImage: {
          mediaId: params.uploadedImageNames![1],
        },
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint =
    "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartAndEndImage";
  return sendAndParseResponse(endpoint, payload, params.accessToken);
}

// ── Case 4: 3+ ảnh → Reference Images (logic hiện tại) ─────────────────────

/**
 * 3+ ảnh upload → gọi endpoint batchAsyncGenerateVideoReferenceImages (referenceImages)
 */
async function callReferenceImagesAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);

  const payload = {
    mediaGenerationContext: {
      batchId,
      audioFailurePreference: "BLOCK_SILENCED_VIDEOS",
    },
    clientContext: buildClientContext(params),
    requests: [
      {
        aspectRatio: videoAspectRatio,
        seed,
        textInput: {
          structuredPrompt: {
            parts: [{ text: params.prompt }],
          },
        },
        videoModelKey: "veo_3_1_r2v_fast_portrait_ultra",
        metadata: {},
        referenceImages: params.uploadedImageNames!.map((mediaId) => ({
          mediaId,
          imageUsageType: "IMAGE_USAGE_TYPE_ASSET",
        })),
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint =
    "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages";
  return sendAndParseResponse(endpoint, payload, params.accessToken);
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
    // Log error message
    logger.error(`[generation-video] Error message: ${errorMsg}`);

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

  // Gửi kết quả video về client qua SSE
  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  sendSSE({ type: "progress", progress: 100, message: "Hoàn tất!" });
  sendSSE({
    type: "done",
    data: {
      videoUri: fifeUrl,
      videoBytes: null,
      mimeType: "video/mp4",
    },
  });

  res.end();
}
