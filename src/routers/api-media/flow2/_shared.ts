import logger from "../../../helpers/logger";
import {
  CAPTCHA_GENERATION_MAX_RETRIES,
  getApiSetting,
} from "../../helpers/validateApiKey";

export type Flow2StatusResponse = Record<string, unknown>;

export const FLOW2_SETTING_KEY = "recaptcha-api-secret-key";
/** Số lần tạo request Flow2 mới khi gặp lỗi reCAPTCHA / unusual activity (cùng mức Google Aisandbox). */
export const FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX = CAPTCHA_GENERATION_MAX_RETRIES;
/** Chờ giữa mỗi lần retry — tăng theo attempt (Flow2/captcha cần thời gian hồi). */
export const FLOW2_CAPTCHA_RETRY_BASE_DELAY_MS = 5_000;

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

function markRetryableCaptchaError(err: any, errorText: string, status: string): void {
  if (isFlow2RetryableCaptchaError(errorText, status)) {
    err.isRetryableCaptchaError = true;
  }
}

/** Nhận diện lỗi captcha từ Error (kể cả khi chỉ còn message). */
export function isFlow2RetryableError(err: any): boolean {
  if (err?.isRetryableCaptchaError === true) return true;
  return isFlow2RetryableCaptchaError(err?.message);
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
      markRetryableCaptchaError(err, errorText, status);
      throw err;
    }

    if (isFlow2SuccessStatus(status)) {
      await safeProgress(params.onProgress, 90, params.doneProgressMessage);
      const items = await params.extract(statusData);
      if (items.length === 0) {
        throw new Error(params.emptyResultMessage);
      }
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

  for (let attempt = 1; attempt <= FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX; attempt++) {
    try {
      await safeProgress(params.onProgress, 40, params.createProgressMessage);
      const result = await params.runOnce();
      return result;
    } catch (err: any) {
      lastError = err;
      if (isFlow2RetryableError(err) && attempt < FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX) {
        logger.warn(
          `[flow2-${params.logTag}] Captcha/unusual activity — retry ${attempt}/${FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX}: ${err?.message}`
        );
        await safeProgress(params.onProgress, 60, params.retryProgressMessage(attempt + 1));
        await delayBeforeFlow2CaptchaRetry(attempt);
        continue;
      }
      throw err;
    }
  }

  if (lastError && isFlow2RetryableError(lastError)) {
    lastError.message = `${lastError.message} (đã thử ${FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX} lần)`;
  }
  throw lastError;
}
