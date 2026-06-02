import logger from "../../../helpers/logger";
import { getApiSetting } from "../../helpers/validateApiKey";

export type Flow2StatusResponse = Record<string, unknown>;

export const FLOW2_SETTING_KEY = "recaptcha-api-secret-key";
export const FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX = 3;

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

export function isUnusualActivityErrorText(input?: string): boolean {
  if (!input) return false;
  return input.toUpperCase().includes("PUBLIC_ERROR_UNUSUAL_ACTIVITY");
}

export function isCaptchaFailedErrorText(input?: string): boolean {
  if (!input) return false;
  return input.toUpperCase().includes("CAPTCHA_FAILED");
}

function markRetryableCaptchaError(err: any, errorText: string, status: string): void {
  if (
    isUnusualActivityErrorText(errorText) ||
    isUnusualActivityErrorText(status) ||
    isCaptchaFailedErrorText(errorText) ||
    isCaptchaFailedErrorText(status)
  ) {
    err.isRetryableCaptchaError = true;
  }
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

    if (["failed", "error", "cancelled", "canceled"].includes(status) || hasImmediateError(statusData)) {
      const errorText = pickError(statusData) || status || "Unknown error";
      const err: any = new Error(`Flow2 xử lý thất bại: ${errorText}`);
      markRetryableCaptchaError(err, errorText, status);
      throw err;
    }

    if (["done", "completed", "succeeded", "success", "finished"].includes(status)) {
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
      if (err?.isRetryableCaptchaError && attempt < FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX) {
        logger.warn(
          `[flow2-${params.logTag}] Retry do captcha error (${attempt}/${FLOW2_UNUSUAL_ACTIVITY_RETRY_MAX})`
        );
        await safeProgress(params.onProgress, 60, params.retryProgressMessage(attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
