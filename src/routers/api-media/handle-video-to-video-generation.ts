import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken/apiMediaToken.model";
import { Context } from "../../libs/graphql";
import { processAndUploadImages } from "../helpers/handleUploadGoogleLabImages";
import {
  buildThrottleError,
  classify429Error,
  retryWithThrottleGate,
  videoThrottleGate,
} from "../helpers/retry-throttle";
import { CaptchaResponseData } from "../helpers/validateApiKey";
import { pollAndExtractVideo } from "./handle-video-generation";

/**
 * Xử lý logic generate video:
 * - Validate body & prompt
 * - Upload ảnh lên Google Labs (nếu có)
 * - Setup SSE headers
 * - Gọi Aisandbox API tạo video
 * - Poll kết quả và stream về client
 * - Tăng usedQuantity sau khi thành công
 */
export async function handleVideoToVideoGeneration(
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
      aspectRatio?: "16:9" | "9:16";
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
    captchaData.accessToken,
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
    accessToken: captchaData.accessToken,
    batchId: crypto.randomUUID(),
    Seed: captchaData.Seed,
    headers: captchaData.Headers,
  });

  const pollSuccess = await pollAndExtractVideo({
    mediaName,
    accessToken: captchaData.accessToken,
    customerId: context.id,
    res,
    headers: captchaData.Headers,
  });
  if (!pollSuccess) {
    return;
  }

  // Tăng usedQuantity sau khi generate video thành công (atomic $inc, tìm theo API key)
  await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });
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
  uploadedVideoNames?: string[]; // Thêm param mới cho video input (dùng cho video-to-video)
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
  return retryWithThrottleGate(
    () => {
      return callVideoToVideoAPI(params);
    },
    { label: "generation-video-to-video", gate: videoThrottleGate }
  );
}

// ── Helpers dùng chung ──────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: "16:9" | "9:16"): string {
  const input = aspectRatio || "9:16";

  return input === "16:9" ? "VIDEO_ASPECT_RATIO_LANDSCAPE" : "VIDEO_ASPECT_RATIO_PORTRAIT";
}

function buildVideoModelKey(params: CallAisandboxParams): string {
  const base = `abra_edit`;
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
      } catch {
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

// ── Case 1: Không có ảnh → video-to-Video ────────────────────────────────────

/**
 * Chỉ có prompt, video, nhiều ảnh → gọi endpoint batchAsyncGenerateVideoEditVideo

 */
export async function callVideoToVideoAPI(
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
        videoInput: {
          mediaId: params.uploadedVideoNames?.[0],
          startFrameIndex: 0,
          endFrameIndex: 240,
        },
        ...(params.uploadedImageNames?.length
          ? {
              referenceImages: params.uploadedImageNames.map((mediaId) => ({
                mediaId,
                imageUsageType: "IMAGE_USAGE_TYPE_ASSET",
              })),
            }
          : {}),
      },
    ],
    useV2ModelConfig: true,
  };

  const endpoint = "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoEditVideo";
  return sendAndParseResponse(endpoint, payload, params.accessToken, params.headers);
}

