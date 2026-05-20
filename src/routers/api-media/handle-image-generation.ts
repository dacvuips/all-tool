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
import { CaptchaResponseData, getApiSetting } from "../helpers/validateApiKey";

/**
 * Xử lý logic generate image:
 * - Validate body & prompt
 * - Gọi Google Labs API tạo image (batchGenerateImages)
 * - Extract images từ response (fifeUrl → base64)
 * - Tăng usedQuantity sau khi thành công
 */
export async function handleImageGeneration(
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
    };
  };
  if (!body?.prompt) {
    res.status(400).json({ message: "Thiếu prompt" });
    return;
  }

  const context = new Context({ req });
  const links = await getApiSetting("recaptcha-api-secret-key");
  let lastCaptchaError = false;
  let currentCaptchaData: CaptchaResponseData | null = null;

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
      currentCaptchaData = await captchaResp.json();

      if (!currentCaptchaData) continue;

      const uploadedImageNames = await processAndUploadImages(
        body.images || [],
        currentCaptchaData.accessToken,
        currentCaptchaData.ProjectID,
        context.id
      );

      // Tạo ảnh
      await callAisandboxImageAPI({
        res,
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

      // Tăng usedQuantity sau khi generate image thành công (atomic $inc, tìm theo API key)
      await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });
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

interface CallAisandboxParams {
  res: Response;
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
}

/**
 * Gọi Aisandbox API: dispatch sang hàm xử lý phù hợp dựa trên số lượng ảnh.
 * Dùng ThrottleGate (Redis-coordinated) để:
 * - Khi bị 429 throttle → back off đồng bộ cross-instance rồi retry.
 * - Khi không bị throttle → bay tự do, không giới hạn concurrency.
 */
export async function callAisandboxImageAPI(params: CallAisandboxParams): Promise<void> {
  const { uploadedImageNames } = params;
  const imageCount = uploadedImageNames?.length || 0;
  await retryWithThrottleGate(
    async () => {
      if (imageCount === 0) {
        await callTextOnlyAPI(params);
      } else {
        await callImageToImageAPI(params);
      }
    },
    { label: "generation-image", gate: imageThrottleGate }
  );
}

// ── Helpers dùng chung ──────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: "16:9" | "9:16"): string {
  const input = aspectRatio || "9:16";
  return input === "16:9" ? "IMAGE_ASPECT_RATIO_LANDSCAPE" : "IMAGE_ASPECT_RATIO_PORTRAIT";
}
function buildClientContext(params: CallAisandboxParams) {
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
async function sendAndParseResponse(
  res: Response,
  endpoint: string,
  payload: any,
  accessToken: string,
  headers?: Record<string, string>
): Promise<void> {
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
    // Phát hiện 429 throttle → throw throttle error để retryOnThrottle bắt và retry.
    if (resp.status === 429) {
      const { isThrottle, errText } = await classify429Error(resp);
      if (isThrottle) {
        logger.warn(`[generation-image] Bị throttle 429 (PUBLIC_ERROR_USER_REQUESTS_THROTTLED).`);
        throw buildThrottleError(`Google Labs API throttle (429): ${errText.slice(0, 200)}`);
      }
      // 429 khác throttle (ví dụ daily quota khác) → throw thường, không retry.
      const err: any = new Error(`Google Labs API error 429: ${errText}`);
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

    const err: any = new Error(`Google Labs API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }
  const apiRes = await resp.json();

  // Extract images từ response Google Labs
  // Response trả về { media: [{ image: { generatedImage: { fifeUrl: "..." } } }] }

  const mediaItems = (apiRes as any)?.media || [];

  if (mediaItems.length === 0) {
    const err: any = new Error("Không nhận được ảnh từ Google Labs API");
    err.statusCode = 500;
    throw err;
  }

  // Fetch từng ảnh từ fifeUrl và convert sang base64
  const images = await Promise.all(
    mediaItems.map(async (item: any) => {
      const fifeUrl = item?.image?.generatedImage?.fifeUrl;
      if (fifeUrl) {
        // Fetch image binary từ Google Storage URL
        const imgResp = await fetch(fifeUrl);
        if (!imgResp.ok) {
          logger.warn(`[generation-image] Không thể fetch ảnh từ fifeUrl: ${imgResp.status}`);
          return { imageUrl: fifeUrl };
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
      // Fallback: trả về toàn bộ object
      return item;
    })
  );

  res.json({ success: true, data: images });
}

async function callTextOnlyAPI(params: CallAisandboxParams): Promise<void> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: {
      batchId,
    },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: {
          parts: [{ text: params.prompt }],
        },
        seed,
        imageInputs: [] as any,
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  await sendAndParseResponse(params.res, endpoint, payload, params.accessToken, params.headers);
}

export async function callImageToImageAPI(params: CallAisandboxParams): Promise<void> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = params.batchId;
  const seed = params.Seed;
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: {
      batchId,
    },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: {
          parts: [{ text: params.prompt }],
        },
        seed,
        imageInputs: params.uploadedImageNames!.map((mediaId) => ({
          name: mediaId,
          imageInputType: "IMAGE_INPUT_TYPE_REFERENCE",
        })),
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  await sendAndParseResponse(params.res, endpoint, payload, params.accessToken, params.headers);
}
