import logger from "../../../helpers/logger";
import {
  fetchFlow2WithRetry,
  FLOW2_GENERATION_TIMEOUT_MS,
  getFlow2Config,
  isFlow2GatewayBusyError,
  throwFlow2HttpError,
} from "./_shared";

export type UpsampleResolution = "2K" | "4K";

export type UpsampleImageWithFlow2Params = {
  resolution: UpsampleResolution;
  flow2RequestId: string;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
};

export type UpsampledImageResult = {
  imageBytes: string;
  mimeType: string;
};

const UPSAMPLE_TARGET_RESOLUTION: Record<UpsampleResolution, string> = {
  "2K": "UPSAMPLE_IMAGE_RESOLUTION_2K",
  "4K": "UPSAMPLE_IMAGE_RESOLUTION_4K",
};

/** Timeout từng request Flow2 — tránh treo 100s+ rồi nhận Cloudflare HTML. */
const FLOW2_UPSAMPLE_REQUEST_TIMEOUT_MS = 90_000;
/** Số lần thử POST ?download=true khi gateway bận / timeout. */
const FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX = 4;
const FLOW2_UPSAMPLE_DOWNLOAD_RETRY_BASE_MS = 5_000;

function buildUpsampleBody(params: UpsampleImageWithFlow2Params): Record<string, string> {
  return {
    request_id: params.flow2RequestId,
    target_resolution: UPSAMPLE_TARGET_RESOLUTION[params.resolution],
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFlow2Upsample(
  url: string,
  init: RequestInit,
  timeoutMs = FLOW2_UPSAMPLE_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFlow2WithRetry(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("abort")) {
      const timeoutErr: any = new Error(
        `Flow2 upsample timeout sau ${timeoutMs}ms — thử lại`
      );
      timeoutErr.statusCode = 504;
      timeoutErr.isGatewayBusyError = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableUpsampleError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as {
    statusCode?: number;
    isGatewayBusyError?: boolean;
    message?: string;
  };
  if (anyErr.isGatewayBusyError) return true;
  if (anyErr.statusCode && isFlow2GatewayBusyError(anyErr.statusCode)) return true;
  const msg = (anyErr.message || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("bận") ||
    msg.includes("busy") ||
    msg.includes("abort")
  );
}

async function parseImageDownloadResponse(resp: Response): Promise<UpsampledImageResult> {
  const contentType = (resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const buffer = Buffer.from(await resp.arrayBuffer());

  if (contentType.includes("application/json")) {
    const json = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      "Flow2 upsample không trả ảnh";
    throw new Error(message);
  }

  if (!buffer.length) {
    throw new Error("Flow2 upsample trả về file rỗng");
  }

  return {
    imageBytes: buffer.toString("base64"),
    mimeType: contentType || "image/jpeg",
  };
}

/**
 * Flow2 upsample-image contract:
 * 1) POST /api/requests/upsample-image
 *    body: { request_id, target_resolution }
 * 2) POST /api/requests/upsample-image?download=true  (+ cùng body) → file ảnh
 *
 * Không dùng GET /api/requests/{id}?download=true (đó là pattern video).
 */
export async function upsampleImageWithFlow2(
  params: UpsampleImageWithFlow2Params
): Promise<UpsampledImageResult> {
  const { baseUrl, token } = await getFlow2Config();
  const sourceRequestId = params.flow2RequestId.trim();
  const { onProgress, resolution } = params;
  const body = JSON.stringify(buildUpsampleBody(params));
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (onProgress) {
    await onProgress(8, `Đang gửi yêu cầu upscale ${resolution}...`);
  }

  // Bước 1: enqueue (không download) — best-effort, không chặn nếu thiếu job id
  try {
    const enqueueResp = await fetchFlow2Upsample(`${baseUrl}/api/requests/upsample-image`, {
      method: "POST",
      headers: authHeaders,
      body,
    });

    if (!enqueueResp.ok) {
      const errText = await enqueueResp.text();
      // Gateway bận lúc enqueue → vẫn thử download sau (có thể task đã có)
      if (isFlow2GatewayBusyError(enqueueResp.status, errText)) {
        logger.warn(
          `[flow2-upsample-image] Enqueue gateway busy source=${sourceRequestId} — sẽ thử download`
        );
      } else {
        throwFlow2HttpError("Flow2 upsample-image enqueue error", enqueueResp.status, errText);
      }
    } else {
      const enqueueText = await enqueueResp.text();
      let enqueueData: Record<string, unknown> = {};
      try {
        enqueueData = enqueueText ? (JSON.parse(enqueueText) as Record<string, unknown>) : {};
      } catch {
        logger.warn(
          `[flow2-upsample-image] Enqueue response không phải JSON source=${sourceRequestId}: ${enqueueText.slice(0, 200)}`
        );
      }
      logger.info(
        `[flow2-upsample-image] Enqueued source=${sourceRequestId} resolution=${resolution} keys=${Object.keys(enqueueData).join(",") || "(empty)"}`
      );
    }
  } catch (err) {
    if (!isRetryableUpsampleError(err)) throw err;
    logger.warn(
      `[flow2-upsample-image] Enqueue lỗi tạm thời source=${sourceRequestId}: ${(err as Error)?.message}`
    );
  }

  if (onProgress) {
    await onProgress(20, `Đang tải ảnh ${resolution} từ Flow2...`);
  }

  // Bước 2: POST ?download=true (đúng curl docs) + retry khi gateway bận
  let lastError: unknown;
  for (let attempt = 1; attempt <= FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX; attempt++) {
    try {
      if (onProgress) {
        await onProgress(
          20 + Math.round((attempt / FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX) * 70),
          `Đang tải ảnh ${resolution} (lần ${attempt}/${FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX})...`
        );
      }

      const downloadResp = await fetchFlow2Upsample(
        `${baseUrl}/api/requests/upsample-image?download=true`,
        {
          method: "POST",
          headers: authHeaders,
          body,
        },
        // download có thể lâu hơn enqueue
        Math.min(FLOW2_GENERATION_TIMEOUT_MS, 180_000)
      );

      if (!downloadResp.ok) {
        const errText = await downloadResp.text();
        throwFlow2HttpError("Flow2 upsample-image download error", downloadResp.status, errText);
      }

      const result = await parseImageDownloadResponse(downloadResp);
      logger.info(
        `[flow2-upsample-image] Hoàn tất ${resolution} source=${sourceRequestId} (${Buffer.from(result.imageBytes, "base64").length} bytes, ${result.mimeType})`
      );
      if (onProgress) await onProgress(100, `Đã tải ảnh ${resolution}`);
      return result;
    } catch (err) {
      lastError = err;
      if (!isRetryableUpsampleError(err) || attempt >= FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX) {
        throw err;
      }
      const delay = FLOW2_UPSAMPLE_DOWNLOAD_RETRY_BASE_MS * attempt;
      logger.warn(
        `[flow2-upsample-image] Download ${resolution} lỗi tạm thời (lần ${attempt}/${FLOW2_UPSAMPLE_DOWNLOAD_RETRY_MAX}): ${(err as Error)?.message} — retry sau ${delay}ms`
      );
      await delayMs(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Không thể upscale ảnh ${resolution}`);
}
