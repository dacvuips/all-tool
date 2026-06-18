import logger from "../../../helpers/logger";
import { CAPTCHA_GENERATION_MAX_RETRIES, getApiSetting } from "../../helpers/validateApiKey";

export type Flow2StatusResponse = Record<string, unknown>;

/** Payload `result` Flow2 trả về khi gen_image / gen_text_video / gen_image_video hoàn tất. */
export type Flow2MediaResult = {
  image_urls?: string[];
  video_urls?: string[];
  Link?: string;
  Local?: string;
  local_files?: string[];
  media_ids?: string[];
  media_entries?: Array<{ url?: string; media_id?: string; kind?: string }>;
  poll_mode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Lấy object `result` từ response poll Flow2 (hỗ trợ nhiều lớp bọc). */
export function pickFlow2ResultPayload(statusData: Flow2StatusResponse): Flow2MediaResult | null {
  const candidates: unknown[] = [
    statusData.result,
    (statusData.data as Record<string, unknown> | undefined)?.result,
    (statusData.request as Record<string, unknown> | undefined)?.result,
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const hasMediaHints =
      Array.isArray(candidate.image_urls) ||
      Array.isArray(candidate.video_urls) ||
      typeof candidate.Link === "string" ||
      typeof candidate.Local === "string" ||
      Array.isArray(candidate.media_entries) ||
      (Array.isArray(candidate.media_ids) && candidate.media_ids.length > 0) ||
      typeof candidate.poll_mode === "string";
    if (hasMediaHints) {
      return candidate as Flow2MediaResult;
    }
  }
  return null;
}

function pushHttpUrl(urls: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (isHttpUrl(trimmed)) {
    urls.push(trimmed);
  }
}

/** Trích URL ảnh từ `result` Flow2 (image_urls, Link, Local, media_entries). */
export function collectFlow2ImageUrls(result: Flow2MediaResult): string[] {
  const urls: string[] = [];
  for (const item of result.image_urls || []) {
    pushHttpUrl(urls, item);
  }
  pushHttpUrl(urls, result.Link);
  pushHttpUrl(urls, result.Local);
  for (const entry of result.media_entries || []) {
    pushHttpUrl(urls, entry?.url);
  }
  return Array.from(new Set(urls));
}

/** Trích URL video từ `result` Flow2 (video_urls, Link, Local, media_entries). */
export function collectFlow2VideoUrls(result: Flow2MediaResult): string[] {
  const urls: string[] = [];
  for (const item of result.video_urls || []) {
    pushHttpUrl(urls, item);
  }
  pushHttpUrl(urls, result.Link);
  pushHttpUrl(urls, result.Local);
  for (const entry of result.media_entries || []) {
    pushHttpUrl(urls, entry?.url);
  }
  return Array.from(new Set(urls));
}

/** Metadata cần cho upsample ảnh lên 4K qua Flow2. */
export type Flow2UpscaleFields = {
  mediaId?: string;
  projectId?: string;
  profileId?: string;
};

function pickFlow2StringField(
  statusData: Flow2StatusResponse,
  key: string,
  resultPayload?: Flow2MediaResult | null
): string | undefined {
  const candidates: unknown[] = [
    resultPayload ? (resultPayload as Record<string, unknown>)[key] : undefined,
    statusData[key],
    (statusData.data as Record<string, unknown> | undefined)?.[key],
    (statusData.request as Record<string, unknown> | undefined)?.[key],
    (statusData.result as Record<string, unknown> | undefined)?.[key],
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ? String(found).trim() : undefined;
}

/** Trích media_id / project_id / profile_id từ response poll Flow2 sau gen_image. */
export function pickFlow2UpscaleFields(
  statusData: Flow2StatusResponse,
  imageIndex = 0
): Flow2UpscaleFields {
  const resultPayload = pickFlow2ResultPayload(statusData);
  const mediaIds = resultPayload?.media_ids || [];
  const mediaEntries = resultPayload?.media_entries || [];
  const mediaId =
    mediaIds[imageIndex] ||
    mediaEntries[imageIndex]?.media_id ||
    pickFlow2StringField(statusData, "media_id", resultPayload);

  return {
    mediaId: typeof mediaId === "string" && mediaId.trim() ? mediaId.trim() : undefined,
    projectId: pickFlow2StringField(statusData, "project_id", resultPayload),
    profileId: pickFlow2StringField(statusData, "profile_id", resultPayload),
  };
}

/** Lấy request id từ response poll Flow2. */
export function pickFlow2RequestId(statusData: Flow2StatusResponse): string | undefined {
  const candidates = [
    statusData.id,
    statusData.request_id,
    (statusData.data as Record<string, unknown> | undefined)?.id,
    (statusData.data as Record<string, unknown> | undefined)?.request_id,
    (statusData.request as Record<string, unknown> | undefined)?.id,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found as string | undefined;
}

/** Flow2 poll_mode=media: URL video theo quy ước `{baseUrl}/video/{requestId}`. */
export function buildFlow2DerivedVideoUrl(baseUrl: string, requestId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/video/${requestId}`;
}

function summarizeFlow2ResultForLog(statusData: Flow2StatusResponse): string {
  const resultPayload = pickFlow2ResultPayload(statusData);
  const requestId = pickFlow2RequestId(statusData);
  return JSON.stringify({
    requestId,
    status: pickStatus(statusData),
    poll_mode: resultPayload?.poll_mode ?? null,
    video_urls: resultPayload?.video_urls ?? [],
    media_ids: resultPayload?.media_ids ?? [],
    Link: resultPayload?.Link ?? null,
    Local: resultPayload?.Local ?? null,
  });
}

export const FLOW2_SETTING_KEY = "recaptcha-api-secret-key";
/** Số lần tạo request Flow2 mới khi gặp lỗi reCAPTCHA / unusual activity (cùng mức Google Aisandbox). */
export const FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX = CAPTCHA_GENERATION_MAX_RETRIES;
/** Số lần retry khi Flow2 trả `video_generation_failed` / `image_generation_failed` (lỗi tạm thời). */
export const FLOW2_GENERATION_FAILED_RETRY_MAX = 3;
/** Chờ giữa mỗi lần retry — tăng theo attempt (Flow2/captcha cần thời gian hồi). */
export const FLOW2_CAPTCHA_RETRY_BASE_DELAY_MS = 5_000;

/** Số lần retry khi gọi Flow2 API gặp lỗi mạng tạm thời (fetch failed, ECONNRESET...). */
export const FLOW2_NETWORK_RETRY_MAX = 3;
/** Chờ giữa mỗi lần retry mạng — tăng theo attempt. */
export const FLOW2_NETWORK_RETRY_BASE_DELAY_MS = 2_000;

export function isRetryableNetworkError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: string; code?: string; cause?: { message?: string; code?: string } };
  const parts = [
    anyErr.message,
    anyErr.code,
    anyErr.cause?.message,
    anyErr.cause?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    parts.includes("fetch failed") ||
    parts.includes("econnreset") ||
    parts.includes("econnrefused") ||
    parts.includes("etimedout") ||
    parts.includes("enotfound") ||
    parts.includes("socket hang up") ||
    parts.includes("network") ||
    parts.includes("aborted")
  );
}

async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchFlow2WithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FLOW2_NETWORK_RETRY_MAX; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt >= FLOW2_NETWORK_RETRY_MAX) {
        throw err;
      }
      const delay = FLOW2_NETWORK_RETRY_BASE_DELAY_MS * attempt;
      logger.warn(
        `[flow2] Lỗi mạng khi gọi ${url} (lần ${attempt}/${FLOW2_NETWORK_RETRY_MAX}): ${
          (err as Error)?.message
        } — retry sau ${delay}ms`
      );
      await delayMs(delay);
    }
  }
  throw lastError;
}

export async function getFlow2Config(): Promise<{ baseUrl: string; token: string }> {
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

export async function safeProgress(
  fn: ((progress: number, message?: string) => void | Promise<void>) | undefined,
  progress: number,
  message?: string
): Promise<void> {
  if (!fn) return;
  try {
    await fn(progress, message);
  } catch (err: any) {
    logger.warn(`[flow2] onProgress lỗi: ${err?.message}`);
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function looksLikeRawBase64(value: string, minLength = 128): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

export async function createFlow2Request(body: {
  type: string;
  params: Record<string, unknown>;
}): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const { baseUrl, token } = await getFlow2Config();

  const resp = await fetchFlow2WithRetry(`${baseUrl}/api/requests`, {
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
    if (isFlow2RetryableCaptchaError(errText)) {
      err.isRetryableCaptchaError = true;
    }
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
  const resp = await fetchFlow2WithRetry(`${baseUrl}/api/requests/${requestId}`, {
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

export function pickStatus(statusData: Flow2StatusResponse): string {
  const candidates = [
    statusData.status,
    (statusData.data as Record<string, unknown> | undefined)?.status,
    (statusData.request as Record<string, unknown> | undefined)?.status,
  ];
  const status = candidates.find((v) => typeof v === "string");
  return ((status as string) || "").toLowerCase();
}

export function pickError(statusData: Flow2StatusResponse): string | undefined {
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
  const nonErrorHints = ["processing", "pending", "queued", "running", "in progress", "wait"];
  return !nonErrorHints.some((hint) => normalized.includes(hint));
}

export function isFlow2RetryableCaptchaError(...inputs: (string | undefined)[]): boolean {
  return inputs.some((input) => {
    if (!input) return false;
    const upper = input.toUpperCase();
    return (
      upper.includes("PUBLIC_ERROR_UNUSUAL_ACTIVITY") ||
      upper.includes("CAPTCHA_FAILED") ||
      upper.includes("RECAPTCHA EVALUATION FAILED") ||
      (upper.includes("RECAPTCHA") && upper.includes("FAILED"))
    );
  });
}

/** Flow2 đôi khi trả lỗi tạm thời khi model không tạo được media — retry tạo request mới. */
export function isFlow2RetryableGenerationError(...inputs: (string | undefined)[]): boolean {
  return inputs.some((input) => {
    if (!input) return false;
    const normalized = input.toLowerCase();
    return (
      normalized.includes("video_generation_failed") ||
      normalized.includes("image_generation_failed")
    );
  });
}

/** Flow2 trả status dạng `failed: PUBLIC_ERROR_UNUSUAL_ACTIVITY: ...`, không chỉ `failed`. */
export function isFlow2FailedStatus(status: string): boolean {
  if (!status) return false;
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return true;
  if (status.startsWith("failed:") || status.startsWith("failed ")) return true;
  return isFlow2RetryableCaptchaError(status);
}

export function isFlow2SuccessStatus(status: string): boolean {
  if (!status) return false;
  if (["done", "completed", "succeeded", "success", "finished"].includes(status)) return true;
  return (
    status.startsWith("done") ||
    status.startsWith("completed") ||
    status.startsWith("succeeded") ||
    status.startsWith("success") ||
    status.startsWith("finished")
  );
}

function markFlow2RetryableError(err: any, errorText: string, status: string): void {
  if (isFlow2RetryableCaptchaError(errorText, status)) {
    err.isRetryableCaptchaError = true;
  }
  if (isFlow2RetryableGenerationError(errorText, status)) {
    err.isRetryableGenerationError = true;
  }
}

function getFlow2RetryMaxAttempts(err: any): number {
  if (err?.isRetryableGenerationError || isFlow2RetryableGenerationError(err?.message)) {
    return FLOW2_GENERATION_FAILED_RETRY_MAX;
  }
  return FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX;
}

/** Nhận diện lỗi Flow2 có thể retry (captcha hoặc generation_failed). */
export function isFlow2RetryableError(err: any): boolean {
  if (err?.isRetryableCaptchaError === true) return true;
  if (err?.isRetryableGenerationError === true) return true;
  return (
    isFlow2RetryableCaptchaError(err?.message) ||
    isFlow2RetryableGenerationError(err?.message)
  );
}

function formatFlow2FailureMessage(errorText: string): string {
  const trimmed = errorText.trim();
  const stripped = trimmed.replace(/^flow2 xử lý thất bại:\s*/i, "").trim();
  return `Flow2 xử lý thất bại: ${stripped || trimmed || "Unknown error"}`;
}

async function delayBeforeFlow2CaptchaRetry(attempt: number): Promise<void> {
  const delayMs = FLOW2_CAPTCHA_RETRY_BASE_DELAY_MS * attempt;
  logger.info(`[flow2] Chờ ${delayMs}ms trước khi retry captcha (lần ${attempt + 1})...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function waitForFlow2Result<T>(params: {
  requestId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  extract: (statusData: Flow2StatusResponse) => Promise<T[]>;
  emptyResultMessage: string;
  waitingProgressMessage: string;
  doneProgressMessage: string;
  logTag: string;
}): Promise<T[]> {
  const timeoutMs = params.timeoutMs || 600_000;
  const pollIntervalMs = params.pollIntervalMs || 2_500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const statusData = await getFlow2RequestStatus(params.requestId);
    const status = pickStatus(statusData);

    if (isFlow2FailedStatus(status) || hasImmediateError(statusData)) {
      const errorText = pickError(statusData) || status || "Unknown error";
      const err: any = new Error(formatFlow2FailureMessage(errorText));
      markFlow2RetryableError(err, errorText, status);
      throw err;
    }

    if (isFlow2SuccessStatus(status)) {
      await safeProgress(params.onProgress, 90, params.doneProgressMessage);
      const items = await params.extract(statusData);
      if (items.length === 0) {
        logger.warn(
          `[flow2-${params.logTag}] ${params.emptyResultMessage} requestId=${
            params.requestId
          } summary=${summarizeFlow2ResultForLog(statusData)}`
        );
        throw new Error(params.emptyResultMessage);
      }
      logger.info(
        `[flow2-${params.logTag}] Trích được ${items.length} item requestId=${params.requestId} status=${status}`
      );
      return items;
    }

    await safeProgress(params.onProgress, 70, params.waitingProgressMessage);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Flow2 xử lý quá thời gian (${timeoutMs}ms) cho request ${params.requestId} [${params.logTag}]`
  );
}

export async function runFlow2WithRetry<T>(params: {
  logTag: string;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  createProgressMessage: string;
  createdProgressMessage: (requestId: string) => string;
  retryProgressMessage: (attempt: number) => string;
  runOnce: () => Promise<T>;
}): Promise<T> {
  let lastError: any;
  let maxAttempts = FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await safeProgress(params.onProgress, 40, params.createProgressMessage);
      const result = await params.runOnce();
      return result;
    } catch (err: any) {
      lastError = err;
      maxAttempts = getFlow2RetryMaxAttempts(err);
      if (isFlow2RetryableError(err) && attempt < maxAttempts) {
        const reason =
          err?.isRetryableGenerationError || isFlow2RetryableGenerationError(err?.message)
            ? "generation failed"
            : "captcha/unusual activity";
        logger.warn(
          `[flow2-${params.logTag}] ${reason} — retry ${attempt}/${maxAttempts}: ${err?.message}`
        );
        await safeProgress(params.onProgress, 60, params.retryProgressMessage(attempt + 1));
        await delayBeforeFlow2CaptchaRetry(attempt);
        continue;
      }
      throw err;
    }
  }

  if (lastError && isFlow2RetryableError(lastError)) {
    const tried = getFlow2RetryMaxAttempts(lastError);
    lastError.message = `${lastError.message} (đã thử ${tried} lần)`;
  }
  throw lastError;
}
