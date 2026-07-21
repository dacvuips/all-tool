/**
 * Poll job upsample Flow2 (ảnh 2K/4K, video 1080p) — enqueue → poll done → trả URL.
 */
import {
  buildFlow2DerivedImageUrl,
  buildFlow2DerivedVideoUrl,
  collectFlow2ImageUrls,
  collectFlow2VideoUrls,
  FLOW2_GENERATION_TIMEOUT_MS,
  Flow2StatusResponse,
  getFlow2Config,
  getFlow2RequestStatus,
  isFlow2FailedStatus,
  isFlow2SuccessStatus,
  isHttpUrl,
  normalizeFlow2MediaUrl,
  pickError,
  pickFlow2ResultPayload,
  pickStatus,
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

export async function waitForUpsampleJobDone(
  upsampleJobId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onProgress?: (progress: number, message?: string) => void | Promise<void>;
    progressLabel?: string;
  }
): Promise<Flow2StatusResponse> {
  const timeoutMs = options?.timeoutMs ?? FLOW2_GENERATION_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? 2_500;
  const label = options?.progressLabel || "upscale";
  const startedAt = Date.now();
  let pollCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    pollCount += 1;
    const statusData = await getFlow2RequestStatus(upsampleJobId);
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

export async function resolveUpsampleImageUrl(
  upsampleJobId: string,
  statusData?: Flow2StatusResponse
): Promise<string> {
  if (statusData) {
    const resultPayload = pickFlow2ResultPayload(statusData);
    if (resultPayload) {
      const urls = collectFlow2ImageUrls(resultPayload).map(normalizeFlow2MediaUrl);
      if (urls.length > 0) return urls[0];
    }
    const topLevel = pickTopLevelMediaUrl(statusData);
    if (topLevel) return topLevel;
  }

  const { baseUrl } = await getFlow2Config();
  return buildFlow2DerivedImageUrl(baseUrl, upsampleJobId);
}

export async function resolveUpsampleVideoUrl(
  upsampleJobId: string,
  statusData?: Flow2StatusResponse
): Promise<string> {
  if (statusData) {
    const resultPayload = pickFlow2ResultPayload(statusData);
    if (resultPayload) {
      const urls = collectFlow2VideoUrls(resultPayload).map(normalizeFlow2MediaUrl);
      if (urls.length > 0) return urls[0];
    }
    const topLevel = pickTopLevelMediaUrl(statusData);
    if (topLevel) return topLevel;
  }

  const { baseUrl } = await getFlow2Config();
  return buildFlow2DerivedVideoUrl(baseUrl, upsampleJobId);
}
