import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { ForbiddenError } from "../../libs/core";
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken/apiMediaToken.model";
import { Context } from "../../libs/graphql";
import { processAndUploadImages } from "../helpers/handleUploadGoogleLabImages";
import {
  buildThrottleError,
  classify429Error,
  retryWithThrottleGate,
  videoThrottleGate,
} from "../helpers/retry-throttle";
import { CaptchaResponseData, getApiSetting } from "../helpers/validateApiKey";

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
  _captchaData: CaptchaResponseData,
  tokenKey: string
): Promise<void> {
  const body = req.body as {
    prompt: string;
    images?: Array<
      | string // URL ảnh
      | { imageBytes: string; mimeType?: string } // base64
    >;
    config?: {
      aspectRatio?: "16:9" | "9:16";
      generateAudio?: boolean;
    };
  };
  if (!body?.prompt) {
    res.status(400).json({ message: "Thiếu prompt" });
    return;
  }

  const context = new Context({ req });
  const links = await getApiSetting("recaptcha-api-secret-key");
  let lastCaptchaError = false;

  for (const selectedLink of links) {
    if (!selectedLink || !selectedLink.url) continue;

    try {
      const type = (req.query.type as string) || "VIDEO_GENERATION";
      const captchaUrl = `${selectedLink.url}?action=${type}`;
      const headers: Record<string, string> = {};
      if (selectedLink.apiKey) {
        headers["X-API-Key"] = selectedLink.apiKey;
      }

      const captchaResp = await fetch(captchaUrl, { headers });
      if (!captchaResp.ok) continue;
      const currentCaptchaData: CaptchaResponseData = await captchaResp.json();
      if (!currentCaptchaData) continue;

      const uploadedImageNames = await processAndUploadImages(
        body.images || [],
        currentCaptchaData.accessToken,
        currentCaptchaData.ProjectID,
        context.id
      );

      const { mediaName } = await callAisandboxVideoAPI({
        res: res,
        prompt: body.prompt,
        aspectRatio: body.config?.aspectRatio,
        uploadedImageNames,
        recaptchaToken: currentCaptchaData.captcha,
        sessionId: currentCaptchaData.sessionId,
        projectId: currentCaptchaData.ProjectID,
        accessToken: currentCaptchaData.accessToken,
        batchId: crypto.randomUUID(),
        Seed: currentCaptchaData.Seed,
        headers: currentCaptchaData.Headers,
      });

      await pollAndExtractVideo({
        mediaName,
        accessToken: currentCaptchaData.accessToken,
        customerId: context.id,
        res,
        headers: currentCaptchaData.Headers,
      });

      await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });
      return;
    } catch (err: any) {
      if (err.isCaptchaError || err.statusCode === 403) {
        lastCaptchaError = true;
        logger.warn(
          `[generation-video] Link ${selectedLink.url} bị lỗi Captcha/403. Thử link tiếp theo...`
        );
        continue;
      }
      throw err;
    }
  }

  if (lastCaptchaError) {
    throw new ForbiddenError(`Google xác minh Captcha thất bại. Vui lòng thử lại sau 2-3 phút.`);
  } else {
    throw new Error(`Hệ thống hiện tại đang quá tải. Vui lòng thử lại sau ít phút.`);
  }
}

interface CallAisandboxParams {
  res: Response;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  uploadedImageNames?: string[];
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
  useRelaxedModel?: boolean;
  batchId?: string;
  Seed?: string;
  headers?: Record<string, string>;
}

/**
 * Gọi Aisandbox API: dispatch sang hàm xử lý phù hợp dựa trên số lượng ảnh.
 * Dùng ThrottleGate (Redis-coordinated) để:
 * - Khi bị 429 throttle → back off đồng bộ cross-instance rồi retry.
 * - Khi không bị throttle → bay tự do, không giới hạn concurrency.
 */
export async function callAisandboxVideoAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const { uploadedImageNames } = params;
  const imageCount = uploadedImageNames?.length || 0;

  return retryWithThrottleGate(
    () => {
      if (imageCount === 0) {
        return callTextOnlyAPI(params);
      } else if (imageCount === 1) {
        return callStartImageAPI(params);
      } else if (imageCount === 2) {
        return callStartAndEndImageAPI(params);
      } else {
        return callReferenceImagesAPI(params);
      }
    },
    { label: "generation-video", gate: videoThrottleGate }
  );
}

// ── Helpers dùng chung ──────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: "16:9" | "9:16"): string {
  const input = aspectRatio || "9:16";

  return input === "16:9" ? "VIDEO_ASPECT_RATIO_LANDSCAPE" : "VIDEO_ASPECT_RATIO_PORTRAIT";
}

function buildVideoModelKey(params: CallAisandboxParams): string {
  const base = `veo_3_1_t2v_lite_low_priority`;
  return base;
}
function buildVideoModelKeyWithReferenceImages(params: CallAisandboxParams): string {
  const base = `veo_3_1_r2v_lite_low_priority`;
  return base;
}

function buildClientContext(params: CallAisandboxParams) {
  return {
    projectId: params.projectId,
    tool: "PINHOLE",
    userPaygateTier: "PAYGATE_TIER_TWO",
    sessionId: `;${params.sessionId}`,
    recaptchaContext: {
      token: params.recaptchaToken,
      applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
    },
  };
}

async function sendAndParseResponse(
  endpoint: string,
  payload: any,
  accessToken: string,
  headers?: Record<string, string>
): Promise<{ response: any; mediaName: string }> {
  const label = "generation-video";
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(headers || {}),
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    // 429 throttle → throw throttle error để retryOnThrottle bắt và retry tự động.
    if (resp.status === 429) {
      const { isThrottle, errText } = await classify429Error(resp);
      if (isThrottle) {
        logger.warn(`[${label}] Bị throttle 429 (PUBLIC_ERROR_USER_REQUESTS_THROTTLED).`);
        throw buildThrottleError(`Aisandbox API throttle (429): ${errText.slice(0, 200)}`);
      }
      const err: any = new Error(`Aisandbox API error 429: ${errText}`);
      err.statusCode = 429;
      throw err;
    }

    const errText = await resp.text();
    let isCaptchaError = false;
    if (resp.status === 403) {
      try {
        const errJson = JSON.parse(errText);
        if (
          errJson?.error?.message?.includes("reCAPTCHA") ||
          errJson?.error?.details?.some((d: any) => d.reason === "PUBLIC_ERROR_UNUSUAL_ACTIVITY")
        ) {
          isCaptchaError = true;
        }
      } catch (e) {
        if (errText.includes("reCAPTCHA") || errText.includes("PUBLIC_ERROR_UNUSUAL_ACTIVITY")) {
          isCaptchaError = true;
        }
      }
    }

    if (isCaptchaError) {
      const err: any = new Error(
        `Google xác minh Captcha thất bại. Vui lòng thử lại sau 2-3 phút.`
      );
      err.isCaptchaError = true;
      err.statusCode = 403;
      throw err;
    }

    const err: any = new Error(`Aisandbox API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }
  const response = await resp.json();

  const result = Array.isArray(response) ? response[0] : response;
  const operations = result?.operations || [];
  const mediaName = operations[0]?.operation?.name || result?.media?.[0]?.name || null;

  if (!mediaName) {
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
export async function callTextOnlyAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);

  const batchId = params.batchId;
  const seed = params.Seed;

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
        videoModelKey: buildVideoModelKey(params),
        metadata: {},
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint = "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText";
  return sendAndParseResponse(endpoint, payload, params.accessToken, params.headers);
}

// ── Case 2: 1 ảnh → Start Image ─────────────────────────────────────────────

/**
 * 1 ảnh upload → gọi endpoint batchAsyncGenerateVideoStartImage (startImage)
 */
export async function callStartImageAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;

  const payload = {
    mediaGenerationContext: {
      batchId,
      // audioFailurePreference: "BLOCK_SILENCED_VIDEOS",
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
        videoModelKey: buildVideoModelKey(params),
        metadata: {},
        startImage: {
          mediaId: params.uploadedImageNames![0],
        },
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint = "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage";
  return sendAndParseResponse(endpoint, payload, params.accessToken, params.headers);
}

// ── Case 3: 2 ảnh → Start + End Image ───────────────────────────────────────

/**
 * 2 ảnh upload → gọi endpoint batchAsyncGenerateVideoStartAndEndImage
 * (startImage = ảnh đầu, endImage = ảnh thứ 2)
 */
export async function callStartAndEndImageAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;

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
        videoModelKey: buildVideoModelKey(params),
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
  return sendAndParseResponse(endpoint, payload, params.accessToken, params.headers);
}

// ── Case 4: 3+ ảnh → Reference Images (logic hiện tại) ─────────────────────

/**
 * 3+ ảnh upload → gọi endpoint batchAsyncGenerateVideoReferenceImages (referenceImages)
 */
export async function callReferenceImagesAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string }> {
  const videoAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;

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
        videoModelKey: buildVideoModelKeyWithReferenceImages(params),
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
  return sendAndParseResponse(endpoint, payload, params.accessToken, params.headers);
}

interface PollAndExtractVideoParams {
  mediaName: string;
  accessToken: string;
  customerId: string;
  res: Response;
  headers?: Record<string, string>;
}

/**
 * Poll media endpoint cho đến khi video generation hoàn tất,
 * extract video data và gửi kết quả qua SSE.
 */
export async function pollAndExtractVideo(params: PollAndExtractVideoParams): Promise<void> {
  const { mediaName, accessToken, customerId, res, headers } = params;

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
            ...(headers || {}),
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

  // Gửi kết quả video về client qua SSE
  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
    const errorMsg = "Video creation failed due to a policy violation. Please try again.";

    // Log error message
    logger.error(
      `[generation-video] Error message: ${errorMsg} (status: ${generationStatus}, pollCount: ${pollCount}/${MAX_POLLS})`
    );

    sendSSE({ type: "error", message: errorMsg });
    res.end();
    throw new Error(errorMsg);
  }

  // Extract fifeUrl from operation metadata – try multiple known paths
  // because text-to-video and image-to-video APIs may return different structures
  const metadata = mediaResult?.operation?.metadata;
  const fifeUrl: string | null =
    metadata?.video?.fifeUrl ||
    metadata?.video?.uri ||
    metadata?.video?.downloadUri ||
    metadata?.fifeUrl ||
    metadata?.mediaContent?.uri ||
    metadata?.mediaContent?.fifeUrl ||
    mediaResult?.operation?.result?.video?.fifeUrl ||
    mediaResult?.operation?.result?.fifeUrl ||
    null;

  if (!fifeUrl) {
    const errorMsg = "Không tìm thấy URL video trong kết quả API";
    logger.error(`[generation-video] No fifeUrl found in result: ${JSON.stringify(mediaResult)}`);

    sendSSE({ type: "error", message: errorMsg });
    res.end();
    return;
  }

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
