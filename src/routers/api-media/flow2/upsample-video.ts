import logger from "../../../helpers/logger";
import {
  fetchFlow2WithRetry,
  getFlow2Config,
  getFlow2RequestStatus,
  isFlow2FailedStatus,
  isFlow2SuccessStatus,
  pickError,
  pickStatus,
} from "./_shared";

export type UpsampledVideoResult = {
  videoBytes: string;
  mimeType: string;
};

function pickUpsampleJobId(data: Record<string, unknown>): string | undefined {
  const candidates = [
    data.request_id,
    data.id,
    (data.data as Record<string, unknown> | undefined)?.request_id,
    (data.data as Record<string, unknown> | undefined)?.id,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ? String(found).trim() : undefined;
}

async function waitForUpsampleVideoDone(
  upsampleJobId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onProgress?: (progress: number, message?: string) => void | Promise<void>;
  }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 900_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 2_500;
  const startedAt = Date.now();
  let pollCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    pollCount += 1;
    const statusData = await getFlow2RequestStatus(upsampleJobId);
    const status = pickStatus(statusData);

    if (isFlow2FailedStatus(status)) {
      const errorText = pickError(statusData) || status || "Unknown error";
      const err: any = new Error(`Flow2 upsample video thất bại: ${errorText}`);
      err.statusCode = 500;
      throw err;
    }

    if (isFlow2SuccessStatus(status)) {
      return;
    }

    if (options?.onProgress) {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / timeoutMs);
      const progress = 15 + Math.round(ratio * 70);
      Promise.resolve(
        options.onProgress(progress, `Đang upscale video 1080p... (${pollCount})`)
      ).catch((): undefined => undefined);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Flow2 upsample video quá thời gian (${timeoutMs}ms) cho job ${upsampleJobId}`
  );
}

/**
 * Upscale video lên 1080p qua Flow2:
 * 1. POST /api/requests/upsample-video (enqueue, trả ngay)
 * 2. Poll job đến status=done
 * 3. GET /api/requests/{jobId}?download=true
 */
export async function upsampleVideoWithFlow2(params: {
  flow2RequestId: string;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
}): Promise<UpsampledVideoResult> {
  const { baseUrl, token } = await getFlow2Config();
  const sourceRequestId = params.flow2RequestId.trim();
  const { onProgress } = params;

  if (onProgress) {
    await onProgress(8, "Đang gửi yêu cầu upscale 1080p...");
  }

  const enqueueResp = await fetchFlow2WithRetry(`${baseUrl}/api/requests/upsample-video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ request_id: sourceRequestId }),
  });

  if (!enqueueResp.ok) {
    const errText = await enqueueResp.text();
    const err: any = new Error(`Flow2 upsample-video enqueue error ${enqueueResp.status}: ${errText}`);
    err.statusCode = enqueueResp.status;
    throw err;
  }

  const enqueueData = (await enqueueResp.json()) as Record<string, unknown>;
  const upsampleJobId = pickUpsampleJobId(enqueueData);
  if (!upsampleJobId) {
    throw new Error("Không lấy được upsample job id từ Flow2");
  }

  logger.info(
    `[flow2-upsample-video] Enqueued source=${sourceRequestId} job=${upsampleJobId}`
  );

  if (onProgress) {
    await onProgress(12, "Đã enqueue, đang chờ Flow2 upscale...");
  }

  await waitForUpsampleVideoDone(upsampleJobId, { onProgress });

  if (onProgress) {
    await onProgress(90, "Đang tải video 1080p từ Flow2...");
  }

  const downloadResp = await fetchFlow2WithRetry(
    `${baseUrl}/api/requests/${upsampleJobId}?download=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!downloadResp.ok) {
    const errText = await downloadResp.text();
    const err: any = new Error(
      `Flow2 upsample-video download error ${downloadResp.status}: ${errText}`
    );
    err.statusCode = downloadResp.status;
    throw err;
  }

  const contentType = (downloadResp.headers.get("content-type") || "video/mp4")
    .split(";")[0]
    .trim();
  const buffer = Buffer.from(await downloadResp.arrayBuffer());

  if (contentType.includes("application/json")) {
    const json = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      "Flow2 upsample video không trả file";
    throw new Error(message);
  }

  if (!buffer.length) {
    throw new Error("Flow2 upsample video trả về file rỗng");
  }

  logger.info(
    `[flow2-upsample-video] Hoàn tất source=${sourceRequestId} job=${upsampleJobId} (${buffer.length} bytes, ${contentType})`
  );

  return {
    videoBytes: buffer.toString("base64"),
    mimeType: contentType || "video/mp4",
  };
}
