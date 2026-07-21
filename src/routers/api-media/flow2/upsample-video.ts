import logger from "../../../helpers/logger";
import {
  fetchFlow2WithRetry,
  getFlow2Config,
  throwFlow2HttpError,
} from "./_shared";
import {
  pickUpsampleJobId,
  resolveUpsampleVideoUrl,
  waitForUpsampleJobDone,
} from "./upsample-poll";

export type UpsampledVideoResult = {
  videoUri: string;
  mimeType: string;
  upsampleJobId: string;
};

/**
 * Upscale video lên 1080p qua Flow2 (async):
 * 1. POST /api/requests/upsample-video — enqueue
 * 2. Poll GET /api/requests/{upsampleJobId} đến status=done
 * 3. Trả URL video (không tải base64)
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
    throwFlow2HttpError("Flow2 upsample-video enqueue error", enqueueResp.status, errText);
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

  const statusData = await waitForUpsampleJobDone(upsampleJobId, {
    onProgress,
    progressLabel: "upscale video 1080p",
  });

  if (onProgress) {
    await onProgress(90, "Đang lấy link video 1080p...");
  }

  const videoUri = await resolveUpsampleVideoUrl(upsampleJobId, statusData);

  logger.info(
    `[flow2-upsample-video] Hoàn tất source=${sourceRequestId} job=${upsampleJobId} url=${videoUri}`
  );

  if (onProgress) {
    await onProgress(100, "Hoàn tất upscale 1080p");
  }

  return {
    videoUri,
    mimeType: "video/mp4",
    upsampleJobId,
  };
}
