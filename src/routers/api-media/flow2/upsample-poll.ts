/**
 * Poll job upsample Flow2 (ảnh 2K/4K, video 1080p) — enqueue → poll done → trả URL.
 * Tải media: URL public có thể 404; ưu tiên /media/{id} kèm Bearer token.
 */
import logger from "../../../helpers/logger";
import { stripDataUrlFromBase64 } from "../../helpers/handleUploadGoogleLabImages";
import {
  buildFlow2DerivedImageUrl,
  buildFlow2DerivedVideoUrl,
  collectFlow2ImageUrls,
  collectFlow2VideoUrls,
  FLOW2_GENERATION_TIMEOUT_MS,
  Flow2StatusResponse,
  formatFlow2StatusResponseForLog,
  getFlow2Config,
  getFlow2RequestStatus,
  isFlow2FailedStatus,
  isFlow2SuccessStatus,
  isHttpUrl,
  normalizeFlow2MediaUrl,
  pickError,
  pickFlow2ResultPayload,
  pickStatus,
  resolveFlow2MediaBaseUrl,
} from "./_shared";

export function pickUpsampleJobId(data: Record<string, unknown>): string | undefined {
  const candidates = [
    data.request_id,
    data.id,
    (data.data as Record<string, unknown> | undefined)?.request_id,
    (data.data as Record<string, unknown> | undefined)?.id,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ? String(found).trim() : undefined;
}

function pickTopLevelMediaUrl(statusData: Flow2StatusResponse): string | undefined {
  const candidates = [
    statusData.Link,
    statusData.Local,
    (statusData.data as Record<string, unknown> | undefined)?.Link,
    (statusData.data as Record<string, unknown> | undefined)?.Local,
    (statusData.result as Record<string, unknown> | undefined)?.Link,
    (statusData.result as Record<string, unknown> | undefined)?.Local,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && isHttpUrl(value.trim())) {
      return normalizeFlow2MediaUrl(value.trim());
    }
  }
  return undefined;
}

/** Quét sâu mọi HTTP URL trong payload status (Flow2 upsample đôi khi không bọc trong `result`). */
function collectHttpUrlsDeep(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isHttpUrl(trimmed)) out.push(normalizeFlow2MediaUrl(trimmed));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHttpUrlsDeep(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectHttpUrlsDeep(nested, out, depth + 1);
    }
  }
}

function preferMediaUrls(urls: string[]): string[] {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const rank = (url: string) => {
    if (/\/image\//i.test(url)) return 0;
    if (/\/video\//i.test(url)) return 0;
    if (/\/media\//i.test(url)) return 1;
    return 2;
  };
  return unique.sort((a, b) => rank(a) - rank(b));
}

export async function waitForUpsampleJobDone(
  upsampleJobId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onProgress?: (progress: number, message?: string) => void | Promise<void>;
    progressLabel?: string;
    customerId?: string;
  }
): Promise<Flow2StatusResponse> {
  const timeoutMs = options?.timeoutMs ?? FLOW2_GENERATION_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? 2_500;
  const label = options?.progressLabel || "upscale";
  const startedAt = Date.now();
  let pollCount = 0;
  const flow2Opts = options?.customerId ? { customerId: options.customerId } : undefined;

  while (Date.now() - startedAt < timeoutMs) {
    pollCount += 1;
    const statusData = await getFlow2RequestStatus(upsampleJobId, flow2Opts);
    const status = pickStatus(statusData);

    if (isFlow2FailedStatus(status)) {
      const errorText = pickError(statusData) || status || "Unknown error";
      const err: any = new Error(`Flow2 ${label} thất bại: ${errorText}`);
      err.statusCode = 500;
      throw err;
    }

    if (isFlow2SuccessStatus(status)) {
      return statusData;
    }

    if (options?.onProgress) {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / timeoutMs);
      const progress = 15 + Math.round(ratio * 70);
      Promise.resolve(
        options.onProgress(progress, `Đang ${label}... (${pollCount})`)
      ).catch((): undefined => undefined);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Flow2 ${label} quá thời gian (${timeoutMs}ms) cho job ${upsampleJobId}`);
}

/**
 * Flow2 upsample_image thường trả `result.data_url` (data:image/jpeg;base64,...) —
 * không có HTTP URL công khai. Ưu tiên lấy bytes từ đây trước khi tải URL.
 */
export function extractUpsampleImageBytesFromStatus(
  statusData: Flow2StatusResponse
): { imageBytes: string; mimeType: string } | null {
  const resultPayload = pickFlow2ResultPayload(statusData);
  const candidates: unknown[] = [
    resultPayload?.data_url,
    (resultPayload as Record<string, unknown> | null)?.dataUrl,
    (statusData.result as Record<string, unknown> | undefined)?.data_url,
    (statusData.result as Record<string, unknown> | undefined)?.dataUrl,
    ((statusData.data as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined)
      ?.data_url,
  ];

  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("data:image/") || trimmed.length > 256) {
      const stripped = stripDataUrlFromBase64(trimmed, "image/jpeg");
      if (stripped.imageBytes.length > 64) {
        return stripped;
      }
    }
  }
  return null;
}

function pushResultHttpUrl(found: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (isHttpUrl(trimmed)) found.push(normalizeFlow2MediaUrl(trimmed));
}

export async function resolveUpsampleImageUrl(
  upsampleJobId: string,
  statusData?: Flow2StatusResponse,
  options?: { customerId?: string }
): Promise<string> {
  const found: string[] = [];

  if (statusData) {
    const resultPayload = pickFlow2ResultPayload(statusData);
    if (resultPayload) {
      found.push(...collectFlow2ImageUrls(resultPayload).map(normalizeFlow2MediaUrl));
      pushResultHttpUrl(found, resultPayload.url);
      pushResultHttpUrl(found, resultPayload.image_url);
    }
    const topLevel = pickTopLevelMediaUrl(statusData);
    if (topLevel) found.push(topLevel);
    collectHttpUrlsDeep(statusData, found);
  }

  const preferred = preferMediaUrls(found);
  if (preferred.length > 0) {
    return preferred[0];
  }

  const { baseUrl } = await getFlow2Config(options);
  const derived = buildFlow2DerivedImageUrl(baseUrl, upsampleJobId);
  logger.warn(
    `[flow2-upsample] Không có URL trong status job=${upsampleJobId} — fallback derived=${derived} status=${
      statusData ? formatFlow2StatusResponseForLog(statusData) : "n/a"
    }`
  );
  return derived;
}

export async function resolveUpsampleVideoUrl(
  upsampleJobId: string,
  statusData?: Flow2StatusResponse,
  options?: { customerId?: string }
): Promise<string> {
  const found: string[] = [];

  if (statusData) {
    const resultPayload = pickFlow2ResultPayload(statusData);
    if (resultPayload) {
      found.push(...collectFlow2VideoUrls(resultPayload).map(normalizeFlow2MediaUrl));
    }
    const topLevel = pickTopLevelMediaUrl(statusData);
    if (topLevel) found.push(topLevel);
    collectHttpUrlsDeep(statusData, found);
  }

  const preferred = preferMediaUrls(found);
  if (preferred.length > 0) {
    return preferred[0];
  }

  const { baseUrl } = await getFlow2Config(options);
  const derived = buildFlow2DerivedVideoUrl(baseUrl, upsampleJobId);
  logger.warn(
    `[flow2-upsample] Không có URL video trong status job=${upsampleJobId} — fallback derived=${derived} status=${
      statusData ? formatFlow2StatusResponseForLog(statusData) : "n/a"
    }`
  );
  return derived;
}

function buildUpsampleDownloadCandidates(
  primaryUrl: string,
  jobId: string,
  apiBaseUrl: string,
  kind: "image" | "video"
): string[] {
  const mediaBase = resolveFlow2MediaBaseUrl(apiBaseUrl).replace(/\/+$/, "");
  const apiBase = apiBaseUrl.replace(/\/+$/, "");
  const candidates = [
    primaryUrl,
    `${mediaBase}/${kind}/${encodeURIComponent(jobId)}`,
    `${mediaBase}/media/${encodeURIComponent(jobId)}`,
    `${apiBase}/media/${encodeURIComponent(jobId)}`,
  ];
  return Array.from(new Set(candidates.filter((u) => isHttpUrl(u))));
}

function looksLikeBinaryMedia(mimeType: string, buffer: Buffer, kind: "image" | "video"): boolean {
  if (buffer.length < 64) return false;
  const normalized = (mimeType || "").toLowerCase();
  if (normalized.includes("json") || normalized.includes("text/html") || normalized.includes("text/plain")) {
    return false;
  }
  if (kind === "image") {
    if (normalized.startsWith("image/")) return true;
    // JPEG / PNG magic
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    if (normalized.includes("octet-stream")) return true;
    return false;
  }
  if (normalized.startsWith("video/") || normalized.includes("octet-stream") || normalized.includes("mp4")) {
    return true;
  }
  return buffer.length > 1024;
}

/**
 * Tải bytes media upsample từ Flow2.
 * `/image/{jobId}` upsample thường 404 — thử kèm Bearer và `/media/{jobId}`.
 */
export async function fetchFlow2UpsampleMediaBytes(options: {
  url: string;
  jobId: string;
  kind: "image" | "video";
  retries?: number;
  retryDelayMs?: number;
  customerId?: string;
}): Promise<{ buffer: Buffer; mimeType: string; finalUrl: string }> {
  const { url, jobId, kind } = options;
  const retries = options.retries ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 2_000;
  const { baseUrl, token } = await getFlow2Config(
    options.customerId ? { customerId: options.customerId } : undefined
  );
  const candidates = buildUpsampleDownloadCandidates(url, jobId, baseUrl, kind);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const candidate of candidates) {
      for (const useAuth of [false, true]) {
        try {
          const headers: Record<string, string> = {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          };
          if (useAuth) {
            headers.Authorization = `Bearer ${token}`;
          }

          const resp = await fetch(candidate, { headers });
          if (!resp.ok) {
            lastError = new Error(`HTTP ${resp.status} ${candidate}${useAuth ? " (auth)" : ""}`);
            continue;
          }

          const buffer = Buffer.from(await resp.arrayBuffer());
          const mimeType =
            resp.headers.get("content-type")?.split(";")[0]?.trim() ||
            (kind === "image" ? "image/jpeg" : "video/mp4");

          if (!looksLikeBinaryMedia(mimeType, buffer, kind)) {
            lastError = new Error(
              `Payload không phải ${kind} từ ${candidate} (mime=${mimeType}, len=${buffer.length})`
            );
            continue;
          }

          logger.info(
            `[flow2-upsample] Tải ${kind} OK job=${jobId} url=${candidate} auth=${useAuth} bytes=${buffer.length}`
          );
          return { buffer, mimeType, finalUrl: candidate };
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err?.message || err));
        }
      }
    }

    if (attempt < retries) {
      logger.warn(
        `[flow2-upsample] Chưa tải được ${kind} job=${jobId} (lần ${attempt}/${retries}): ${lastError?.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  throw Object.assign(
    new Error(
      kind === "image"
        ? `Không tải được ảnh upscale từ Flow2${lastError ? `: ${lastError.message}` : ""}`
        : `Không tải được video upscale từ Flow2${lastError ? `: ${lastError.message}` : ""}`
    ),
    { statusCode: 502 }
  );
}
