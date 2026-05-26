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
import {
  CAPTCHA_GENERATION_MAX_RETRIES,
  CaptchaResponseData,
  fetchCaptchaData,
  getApiSetting,
  isCaptchaValidationError,
} from "../helpers/validateApiKey";
export {
  initGenerationSSE,
  initVideoGenerationSSE,
  sendGenerationSSEError,
  sendVideoGenerationSSEError,
} from "./generation-sse";
import { initGenerationSSE } from "./generation-sse";

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

      const pollSuccess = await pollAndExtractVideo({
        mediaName,
        accessToken: currentCaptchaData.accessToken,
        customerId: context.id,
        res,
        headers: currentCaptchaData.Headers,
      });
      if (!pollSuccess) {
        return;
      }

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
  uploadedVideoNames?: string[];
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
  useRelaxedModel?: boolean;
  batchId?: string;
  Seed?: string;
  headers?: Record<string, string>;
  captchaRetry?: {
    actionType?: string;
    logPrefix: string;
    onRefresh: (captcha: CaptchaResponseData) => Promise<CallAisandboxParams>;
  };
}

async function callAisandboxVideoAPICore(
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

/**
 * Gọi Aisandbox API: dispatch sang hàm xử lý phù hợp dựa trên số lượng ảnh.
 * Dùng ThrottleGate (Redis-coordinated) khi 429 throttle.
 * Khi lỗi reCAPTCHA + có captchaRetry → lấy captcha mới (hàng đợi 10s), tối đa 10 lần.
 */
export async function callAisandboxVideoAPI(
  params: CallAisandboxParams
): Promise<{ response: any; mediaName: string; accessToken: string; headers?: Record<string, string> }> {
  const maxAttempts = params.captchaRetry ? CAPTCHA_GENERATION_MAX_RETRIES : 1;
  let current = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await callAisandboxVideoAPICore(current);
      return {
        ...result,
        accessToken: current.accessToken,
        headers: current.headers,
      };
    } catch (err: any) {
      const retry = current.captchaRetry;
      if (isCaptchaValidationError(err) && retry && attempt < maxAttempts) {
        logger.warn(
          `[${retry.logPrefix}] Google Captcha thất bại, lấy captcha mới (${attempt}/${maxAttempts})...`
        );
        const freshCaptcha = await fetchCaptchaData({
          type: retry.actionType,
          logPrefix: retry.logPrefix,
        });
        current = await retry.onRefresh(freshCaptcha);
        continue;
      }
      throw err;
    }
  }

  const err: any = new Error("Google xác minh Captcha thất bại. Vui lòng thử lại sau 2-3 phút.");
  err.isCaptchaError = true;
  err.statusCode = 403;
  throw err;
}

/**
 * Gọi video API kèm retry captcha (route gọi trực tiếp callStartImageAPI, ...).
 * Khi retry: fetchCaptchaData + onRefresh (upload lại ảnh/video nếu cần).
 */
export async function callVideoAPIWithCaptchaRetry<T extends CallAisandboxParams>(
  params: T,
  callFn: (params: T) => Promise<{ mediaName: string }>
): Promise<{ mediaName: string; accessToken: string; headers?: Record<string, string> }> {
  const maxAttempts = params.captchaRetry ? CAPTCHA_GENERATION_MAX_RETRIES : 1;
  let current = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await callFn(current);
      return {
        mediaName: result.mediaName,
        accessToken: current.accessToken,
        headers: current.headers,
      };
    } catch (err: any) {
      const retry = current.captchaRetry;
      if (isCaptchaValidationError(err) && retry && attempt < maxAttempts) {
        logger.warn(
          `[${retry.logPrefix}] Google Captcha thất bại, lấy captcha mới (${attempt}/${maxAttempts})...`
        );
        const freshCaptcha = await fetchCaptchaData({
          type: retry.actionType,
          logPrefix: retry.logPrefix,
        });
        current = (await retry.onRefresh(freshCaptcha)) as T;
        continue;
      }
      throw err;
    }
  }

  const err: any = new Error("Google xác minh Captcha thất bại. Vui lòng thử lại sau 2-3 phút.");
  err.isCaptchaError = true;
  err.statusCode = 403;
  throw err;
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

function resolveVideoGenerationErrorMessage(
  generationStatus: string,
  mediaResult: any,
  pollCount: number,
  maxPolls: number
): string {
  const apiMessage =
    mediaResult?.operation?.error?.message ||
    mediaResult?.error?.message ||
    mediaResult?.operation?.metadata?.errorMessage;
  if (apiMessage) {
    return apiMessage;
  }
  if (generationStatus === "MEDIA_GENERATION_STATUS_FAILED") {
    return "Video creation failed due to a policy violation. Please try again.";
  }
  if (pollCount >= maxPolls) {
    return "Hết thời gian chờ tạo video. Vui lòng thử lại.";
  }
  return "Tạo video thất bại. Vui lòng thử lại.";
}

/**
 * Poll media endpoint cho đến khi video generation hoàn tất,
 * extract video data và gửi kết quả qua SSE.
 * @returns true nếu thành công, false nếu đã gửi lỗi qua SSE (không throw để tránh double-response).
 */
export async function pollAndExtractVideo(params: PollAndExtractVideoParams): Promise<boolean> {
  const { mediaName, accessToken, customerId, res, headers } = params;
  const sendSSE = initGenerationSSE(res);

  // Poll media endpoint until video generation completes
  const MAX_POLLS = 360; // max ~30 minutes (5s * 360)
  let pollCount = 0;
  let mediaResult: any = null;
  let generationStatus = "MEDIA_GENERATION_STATUS_PENDING";

  sendSSE({ type: "progress", progress: 50, message: "Đang chờ Google tạo video..." });

  while (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL" && pollCount < MAX_POLLS) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s interval
    pollCount++;

    const pollProgress = 50 + Math.min(45, Math.round((pollCount / MAX_POLLS) * 45));
    sendSSE({
      type: "progress",
      progress: pollProgress,
      message: `Đang xử lý video... (${pollCount}/${MAX_POLLS})`,
    });

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

  if (generationStatus !== "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
    const errorMsg = resolveVideoGenerationErrorMessage(
      generationStatus,
      mediaResult,
      pollCount,
      MAX_POLLS
    );

    logger.error(
      `[generation-video] Error message: ${errorMsg} (status: ${generationStatus}, pollCount: ${pollCount}/${MAX_POLLS})`
    );

    sendSSE({ type: "error", message: errorMsg });
    res.end();
    return false;
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
    return false;
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
  return true;
}
