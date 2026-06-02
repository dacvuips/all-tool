import logger from "../../helpers/logger";
import { fetchImageAsBase64, stripDataUrlFromBase64 } from "../helpers/handleUploadGoogleLabImages";
import { getApiSetting } from "../helpers/validateApiKey";

export type Flow2ImageInput = string | { imageBytes: string; mimeType?: string };

export type Flow2CreateRequestParams = {
  prompt: string;
  imageInputs?: Flow2ImageInput[];
  aspectRatio?: "16:9" | "9:16";
  imageModel?: string;
  variantCount?: number;
  imageInputTypes?: string[];
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
};

export type GeneratedImage = {
  imageBytes?: string;
  mimeType?: string;
};

type Flow2StatusResponse = Record<string, unknown>;

const FLOW2_SETTING_KEY = "recaptcha-api-secret-key";
const DEFAULT_IMAGE_MODEL = "NANO_BANANA_2";
const FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX = 3;

async function getFlow2Config(): Promise<{ baseUrl: string; token: string }> {
  const links = await getApiSetting(FLOW2_SETTING_KEY);
  const selected = links.find((item) => item?.url && item?.apiKey);
  if (!selected) {
    throw new Error(`Thiếu cấu hình Flow2 trong setting key: ${FLOW2_SETTING_KEY}`);
  }
  return {
    baseUrl: selected.url.replace(/\/+$/, ""),
    token: selected.apiKey,
  };
}

async function safeProgress(
  fn: Flow2CreateRequestParams["onProgress"],
  progress: number,
  message?: string
): Promise<void> {
  if (!fn) return;
  try {
    await fn(progress, message);
  } catch (err: any) {
    logger.warn(`[flow2-image] onProgress lỗi: ${err?.message}`);
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeRawBase64Image(value: string): boolean {
  const trimmed = value.trim();
  // Tránh bắt nhầm status ngắn như "done", "success", ...
  if (trimmed.length < 128) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

export async function normalizeImageToDataUrl(input: Flow2ImageInput): Promise<string> {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Ảnh đầu vào rỗng");
    if (trimmed.startsWith("data:")) return trimmed;
    if (isHttpUrl(trimmed)) {
      const fetched = await fetchImageAsBase64(trimmed);
      return `data:${fetched.mimeType};base64,${fetched.imageBytes}`;
    }
    const stripped = stripDataUrlFromBase64(trimmed, "image/jpeg");
    return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
  }

  const stripped = stripDataUrlFromBase64(input.imageBytes, input.mimeType || "image/jpeg");
  return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
}

export async function createFlow2ImageRequest(
  params: Flow2CreateRequestParams
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const { baseUrl, token } = await getFlow2Config();
  const image_base64s = await Promise.all((params.imageInputs || []).map(normalizeImageToDataUrl));
  const image_input_types =
    params.imageInputTypes && params.imageInputTypes.length > 0
      ? params.imageInputTypes
      : new Array(image_base64s.length).fill("reference");

  const body = {
    type: "gen_image",
    params: {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || "16:9",
      image_base64s,
      image_input_types,
      image_model: params.imageModel || DEFAULT_IMAGE_MODEL,
      variant_count: Math.max(1, params.variantCount || 1),
    },
  };

  const resp = await fetch(`${baseUrl}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err: any = new Error(`Flow2 create request error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }

  const data = (await resp.json()) as Record<string, unknown>;

  const requestId =
    (data.request_id as string) ||
    (data.id as string) ||
    ((data.data as Record<string, unknown> | undefined)?.request_id as string);

  if (!requestId) {
    throw new Error("Không lấy được request_id từ Flow2");
  }

  return { requestId, raw: data };
}

export async function getFlow2RequestStatus(requestId: string): Promise<Flow2StatusResponse> {
  const { baseUrl, token } = await getFlow2Config();
  const resp = await fetch(`${baseUrl}/api/requests/${requestId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err: any = new Error(`Flow2 status error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }
  return (await resp.json()) as Flow2StatusResponse;
}

function pickStatus(statusData: Flow2StatusResponse): string {
  const candidates = [
    statusData.status,
    (statusData.data as Record<string, unknown> | undefined)?.status,
    (statusData.request as Record<string, unknown> | undefined)?.status,
  ];
  const status = candidates.find((v) => typeof v === "string");
  return ((status as string) || "").toLowerCase();
}

function pickError(statusData: Flow2StatusResponse): string | undefined {
  const candidates = [
    statusData.error,
    statusData.message,
    (statusData.data as Record<string, unknown> | undefined)?.error,
    (statusData.data as Record<string, unknown> | undefined)?.message,
  ];
  const found = candidates.find((v) => typeof v === "string");
  return found as string | undefined;
}

function hasImmediateError(statusData: Flow2StatusResponse): boolean {
  const err = pickError(statusData);
  if (!err) return false;
  const normalized = err.toLowerCase();
  // Một số trạng thái trung gian có thể mang message thông tin, chỉ fail-fast khi thật sự là lỗi.
  const nonErrorHints = ["processing", "pending", "queued", "running", "in progress", "wait"];
  return !nonErrorHints.some((hint) => normalized.includes(hint));
}

function isUnusualActivityErrorText(input?: string): boolean {
  if (!input) return false;
  return input.toUpperCase().includes("PUBLIC_ERROR_UNUSUAL_ACTIVITY");
}

function isCaptchaFailedErrorText(input?: string): boolean {
  if (!input) return false;
  return input.toUpperCase().includes("CAPTCHA_FAILED");
}

function collectImageLikeStrings(value: unknown, out: string[], forceDive = false): void {
  const tryCollect = (input: string) => {
    const trimmed = input.trim();
    if (
      trimmed.startsWith("data:image/") ||
      isHttpUrl(trimmed) ||
      looksLikeRawBase64Image(trimmed)
    ) {
      out.push(trimmed);
    }
  };

  if (typeof value === "string") {
    tryCollect(value);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageLikeStrings(item, out, forceDive);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const candidateKeys = [
    "image",
    "images",
    "imageBytes",
    "imageBase64",
    "image_base64",
    "file_url",
    "fileUrl",
    "url",
    "urls",
    "output",
    "outputs",
    "result",
    "results",
    "data",
  ];

  for (const [key, val] of Object.entries(record)) {
    const shouldDive =
      forceDive ||
      candidateKeys.includes(key) ||
      key.toLowerCase().includes("image") ||
      key.toLowerCase().includes("file") ||
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("result") ||
      key.toLowerCase().includes("output");

    if (!shouldDive) continue;

    if (typeof val === "string") {
      tryCollect(val);
      continue;
    }

    collectImageLikeStrings(val, out, true);
  }
}

async function normalizeResultImage(value: string): Promise<GeneratedImage> {
  if (value.startsWith("data:image/")) {
    const stripped = stripDataUrlFromBase64(value, "image/png");
    return { imageBytes: stripped.imageBytes, mimeType: stripped.mimeType };
  }
  if (isHttpUrl(value)) {
    const fetched = await fetchImageAsBase64(value);
    return { imageBytes: fetched.imageBytes, mimeType: fetched.mimeType };
  }
  const stripped = stripDataUrlFromBase64(value, "image/png");
  return { imageBytes: stripped.imageBytes, mimeType: stripped.mimeType };
}

export async function extractFlow2Images(
  statusData: Flow2StatusResponse
): Promise<GeneratedImage[]> {
  const found: string[] = [];
  collectImageLikeStrings(statusData, found);
  const deduped = Array.from(new Set(found)).slice(0, 10);
  if (deduped.length === 0) return [];
  return Promise.all(deduped.map(normalizeResultImage));
}

export async function waitForFlow2ImageResult(params: {
  requestId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
}): Promise<GeneratedImage[]> {
  const timeoutMs = params.timeoutMs || 360_000;
  const pollIntervalMs = params.pollIntervalMs || 2_500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const statusData = await getFlow2RequestStatus(params.requestId);
    const status = pickStatus(statusData);

    if (["failed", "error", "cancelled", "canceled"].includes(status) || hasImmediateError(statusData)) {
      const errorText = pickError(statusData) || status || "Unknown error";
      const err: any = new Error(`Flow2 xử lý thất bại: ${errorText}`);
      if (
        isUnusualActivityErrorText(errorText) ||
        isUnusualActivityErrorText(status) ||
        isCaptchaFailedErrorText(errorText) ||
        isCaptchaFailedErrorText(status)
      ) {
        err.isRetryableCaptchaError = true;
      }
      throw err;
    }

    if (["done", "completed", "succeeded", "success", "finished"].includes(status)) {
      await safeProgress(params.onProgress, 90, "Flow2 đã tạo ảnh xong, đang xử lý kết quả...");
      const images = await extractFlow2Images(statusData);
      if (images.length === 0) {
        throw new Error("Flow2 hoàn tất nhưng không có ảnh đầu ra");
      }
      return images;
    }

    await safeProgress(params.onProgress, 70, "Đang chờ Flow2 xử lý ảnh...");
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Flow2 xử lý quá thời gian (${timeoutMs}ms) cho request ${params.requestId}`);
}

export async function generateImageWithFlow2(
  params: Flow2CreateRequestParams
): Promise<{ requestId: string; images: GeneratedImage[] }> {
  let lastError: any;

  for (let attempt = 1; attempt <= FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX; attempt++) {
    try {
      await safeProgress(params.onProgress, 40, "Đang gửi request tạo ảnh lên Flow2...");
      const created = await createFlow2ImageRequest(params);
      await safeProgress(
        params.onProgress,
        55,
        `Đã tạo request Flow2 (${created.requestId}), đang chờ kết quả...`
      );
      const images = await waitForFlow2ImageResult({
        requestId: created.requestId,
        onProgress: params.onProgress,
      });
      return { requestId: created.requestId, images };
    } catch (err: any) {
      lastError = err;
      if (err?.isRetryableCaptchaError && attempt < FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX) {
        logger.warn(
          `[flow2-image] Retry do captcha error (${attempt}/${FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX})`
        );
        await safeProgress(
          params.onProgress,
          60,
          `Flow2 gặp lỗi captcha, đang retry lần ${attempt + 1}...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
