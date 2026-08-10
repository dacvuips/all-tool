/**
 * Lớp xử lý gọi Google Aisandbox API để tạo ảnh.
 *
 * Refactor: hàm public không còn phụ thuộc `express.Response`; trả về kết quả thuần
 * (`GeneratedImage[]`) để cả route HTTP **và** worker job đều có thể dùng chung.
 *
 * Compat: hàm `callAisandboxImageAPI(params)` vẫn được export — chỉ thay đổi giá trị trả về
 * (từ `void` → `Promise<GeneratedImage[]>`). Tất cả call site nội bộ đã cập nhật.
 *
 * Nếu route cũ cần gửi JSON về client, caller tự gọi `res.json({ success: true, data: images })`.
 */
import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { ForbiddenError } from "../../libs/core";
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken/apiMediaToken.model";
import { Context } from "../../libs/graphql";
import { processAndUploadImages } from "../helpers/handleUploadGoogleLabImages";
import {
  buildThrottleError,
  classify429Error,
  imageThrottleGate,
  retryWithThrottleGate,
} from "../helpers/retry-throttle";
import {
  CAPTCHA_GENERATION_MAX_RETRIES,
  CaptchaResponseData,
  detectAisandboxCaptchaError,
  fetchCaptchaData,
  getApiSetting,
  isCaptchaValidationError,
  throwAisandboxCaptchaError,
} from "../helpers/validateApiKey";

/** Ảnh đã sinh — cấu trúc thống nhất giữa các kiểu input (text-only, image-to-image, ...) */
export type GeneratedImage = {
  imageBytes?: string;
  mimeType?: string;
  fifeUrl?: string;
  imageUrl?: string;
};

/** Tham số chung gọi Google Aisandbox API tạo ảnh — *không* còn `Response`. */
export interface CallAisandboxImageParams {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  uploadedImageNames?: string[];
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
  noText?: boolean;
  batchId?: string;
  Seed?: string;
  headers?: Record<string, string>;
  /** Callback tiến độ — caller (worker/route) tự cập nhật UI. */
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  /** Khi Google trả lỗi reCAPTCHA → lấy captcha mới, tối đa `CAPTCHA_GENERATION_MAX_RETRIES` lần. */
  captchaRetry?: {
    actionType?: string;
    logPrefix: string;
    customerId?: string;
    onRefresh: (captcha: CaptchaResponseData) => Promise<CallAisandboxImageParams>;
  };
}

/** Helper an toàn gọi onProgress (nuốt lỗi) */
async function safeProgress(
  fn: CallAisandboxImageParams["onProgress"],
  progress: number,
  message?: string
): Promise<void> {
  if (!fn) return;
  try {
    await fn(progress, message);
  } catch (err: any) {
    logger.warn(`[generation-image] onProgress lỗi: ${err?.message}`);
  }
}

/**
 * Hàm `pure` được route legacy `/api/api-media` dùng — vẫn cần gửi JSON.
 * Worker pattern (job mode) sẽ dùng `callAisandboxImageAPI` trực tiếp.
 */
export async function handleImageGeneration(
  req: Request,
  res: Response,
  _captchaData: CaptchaResponseData,
  tokenKey: string
): Promise<void> {
  const body = req.body as {
    prompt: string;
    images?: Array<string | { imageBytes: string; mimeType?: string }>;
    config?: { aspectRatio?: "16:9" | "9:16" };
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
      const type = (req.query.type as string) || "IMAGE_GENERATION";
      const captchaUrl = `${selectedLink.url}?action=${type}`;
      const headers: Record<string, string> = {};
      if (selectedLink.apiKey) {
        headers["X-API-Key"] = selectedLink.apiKey;
      }

      const captchaResp = await fetch(captchaUrl, { headers });
      if (!captchaResp.ok) continue;
      const captcha = (await captchaResp.json()) as CaptchaResponseData;
      if (!captcha) continue;

      const uploadedImageNames = await processAndUploadImages(
        body.images || [],
        captcha.accessToken,
        captcha.ProjectID,
        context.id
      );

      const captchaRetry: CallAisandboxImageParams["captchaRetry"] = {
        actionType: type,
        logPrefix: "generation-image",
        onRefresh: async (freshCaptcha: CaptchaResponseData) => {
          const freshUploaded = await processAndUploadImages(
            body.images || [],
            freshCaptcha.accessToken,
            freshCaptcha.ProjectID,
            context.id
          );
          return {
            prompt: body.prompt,
            aspectRatio: body.config?.aspectRatio,
            uploadedImageNames: freshUploaded,
            recaptchaToken: freshCaptcha.captcha,
            sessionId: freshCaptcha.sessionId,
            projectId: freshCaptcha.ProjectID,
            accessToken: freshCaptcha.accessToken,
            batchId: crypto.randomUUID(),
            Seed: freshCaptcha.Seed,
            headers: freshCaptcha.Headers,
            captchaRetry,
          };
        },
      };

      const images = await callAisandboxImageAPI({
        prompt: body.prompt,
        aspectRatio: body.config?.aspectRatio,
        uploadedImageNames,
        recaptchaToken: captcha.captcha,
        sessionId: captcha.sessionId,
        projectId: captcha.ProjectID,
        accessToken: captcha.accessToken,
        batchId: crypto.randomUUID(),
        Seed: captcha.Seed,
        headers: captcha.Headers,
        captchaRetry,
      });

      await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });
      res.json({ success: true, data: images });
      return;
    } catch (err: any) {
      if (err.isCaptchaError || err.statusCode === 403) {
        lastCaptchaError = true;
        logger.warn(
          `[generation-image] Link ${selectedLink.url} bị lỗi Captcha/403. Thử link tiếp theo...`
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

// ── Public API: gọi tạo ảnh ────────────────────────────────────────────────────

/**
 * Gọi Aisandbox API tạo ảnh — *đã* xử lý:
 * - Throttle 429 (Redis-coordinated gate).
 * - Retry captcha tới `CAPTCHA_GENERATION_MAX_RETRIES` lần nếu Google trả lỗi reCAPTCHA.
 * - Dispatch text-only vs image-to-image dựa trên `uploadedImageNames`.
 *
 * Trả về **mảng ảnh** đã fetch từ `fifeUrl` và convert sang base64.
 */
export async function callAisandboxImageAPI(
  params: CallAisandboxImageParams
): Promise<GeneratedImage[]> {
  const maxAttempts = params.captchaRetry ? CAPTCHA_GENERATION_MAX_RETRIES : 1;
  let current = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callAisandboxImageAPICore(current);
    } catch (err: any) {
      const retry = current.captchaRetry;
      if (isCaptchaValidationError(err) && retry && attempt < maxAttempts) {
        logger.warn(
          `[${retry.logPrefix}] Google Captcha thất bại, lấy captcha mới (${attempt}/${maxAttempts})...`
        );
        const freshCaptcha = await fetchCaptchaData({
          type: retry.actionType,
          logPrefix: retry.logPrefix,
          customerId: retry.customerId,
        });
        // captcha mới — caller cung cấp params mới (có thể đổi headers/accessToken/...)
        current = await retry.onRefresh(freshCaptcha);
        continue;
      }
      throw err;
    }
  }
  // Không bao giờ đến đây vì throw bên trong loop
  return [];
}

async function callAisandboxImageAPICore(
  params: CallAisandboxImageParams
): Promise<GeneratedImage[]> {
  const imageCount = params.uploadedImageNames?.length || 0;
  return retryWithThrottleGate(
    async () => {
      if (imageCount === 0) {
        return callTextOnlyAPI(params);
      }
      return callImageToImageAPI(params);
    },
    { label: "generation-image", gate: imageThrottleGate }
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: "16:9" | "9:16"): string {
  const input = aspectRatio || "9:16";
  return input === "16:9" ? "IMAGE_ASPECT_RATIO_LANDSCAPE" : "IMAGE_ASPECT_RATIO_PORTRAIT";
}

function buildClientContext(params: CallAisandboxImageParams) {
  return {
    projectId: params.projectId,
    tool: "PINHOLE",
    sessionId: params.sessionId,
    recaptchaContext: {
      token: params.recaptchaToken,
      applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
    },
  };
}

/**
 * Gửi request lên Aisandbox + parse response + tải binary từ `fifeUrl`.
 * Trả mảng ảnh chuẩn hoá. Throw có thông tin `statusCode` / `isCaptchaError`.
 */
async function sendAndParseResponse(
  endpoint: string,
  payload: any,
  accessToken: string,
  headers: Record<string, string> | undefined,
  onProgress: CallAisandboxImageParams["onProgress"]
): Promise<GeneratedImage[]> {
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
    if (resp.status === 429) {
      const { isThrottle, errText } = await classify429Error(resp);
      if (isThrottle) {
        logger.warn(`[generation-image] Bị throttle 429 (PUBLIC_ERROR_USER_REQUESTS_THROTTLED).`);
        throw buildThrottleError(`Google Labs API throttle (429): ${errText.slice(0, 200)}`);
      }
      const err: any = new Error(`Google Labs API error 429: ${errText}`);
      err.statusCode = 429;
      throw err;
    }

    const errText = await resp.text();
    if (detectAisandboxCaptchaError(resp.status, errText)) {
      throwAisandboxCaptchaError();
    }

    const err: any = new Error(`Google Labs API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }

  const apiRes = await resp.json();
  const mediaItems = (apiRes as any)?.media || [];

  if (mediaItems.length === 0) {
    const err: any = new Error("Không nhận được ảnh từ Google Labs API");
    err.statusCode = 500;
    throw err;
  }

  await safeProgress(onProgress, 70, "Đang tải ảnh từ Google...");

  // Tải từng ảnh từ fifeUrl → base64 (có thể song song an toàn vì là GET)
  const images: GeneratedImage[] = await Promise.all(
    mediaItems.map(async (item: any) => {
      const fifeUrl = item?.image?.generatedImage?.fifeUrl;
      if (fifeUrl) {
        const imgResp = await fetch(fifeUrl);
        if (!imgResp.ok) {
          logger.warn(`[generation-image] Không thể fetch ảnh từ fifeUrl: ${imgResp.status}`);
          return { imageUrl: fifeUrl, fifeUrl } as GeneratedImage;
        }
        const imgBuffer = await imgResp.arrayBuffer();
        const base64 = Buffer.from(imgBuffer).toString("base64");
        const contentType = imgResp.headers.get("content-type") || "image/png";
        return {
          imageBytes: base64,
          mimeType: contentType,
          fifeUrl,
        };
      }
      // Fallback: response không có fifeUrl — trả nguyên item để client tự xử lý
      return item as GeneratedImage;
    })
  );

  await safeProgress(onProgress, 90, "Đang hoàn tất...");
  return images;
}

async function callTextOnlyAPI(params: CallAisandboxImageParams): Promise<GeneratedImage[]> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: { batchId },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: { parts: [{ text: params.prompt }] },
        seed,
        imageInputs: [] as any,
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  return sendAndParseResponse(
    endpoint,
    payload,
    params.accessToken,
    params.headers,
    params.onProgress
  );
}

export async function callImageToImageAPI(
  params: CallAisandboxImageParams
): Promise<GeneratedImage[]> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: { batchId },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: { parts: [{ text: params.prompt }] },
        seed,
        imageInputs: params.uploadedImageNames!.map((mediaId) => ({
          name: mediaId,
          imageInputType: "IMAGE_INPUT_TYPE_REFERENCE",
        })),
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  return sendAndParseResponse(
    endpoint,
    payload,
    params.accessToken,
    params.headers,
    params.onProgress
  );
}
