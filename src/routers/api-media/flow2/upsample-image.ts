import logger from "../../../helpers/logger";
import {
  fetchFlow2WithRetry,
  getFlow2Config,
  throwFlow2HttpError,
} from "./_shared";
import {
  pickUpsampleJobId,
  resolveUpsampleImageUrl,
  waitForUpsampleJobDone,
} from "./upsample-poll";

export type UpsampleResolution = "2K" | "4K";

export type UpsampleImageWithFlow2Params = {
  resolution: UpsampleResolution;
  flow2RequestId: string;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
};

export type UpsampledImageResult = {
  imageUrl: string;
  mimeType: string;
  upsampleJobId: string;
};

const UPSAMPLE_TARGET_RESOLUTION: Record<UpsampleResolution, string> = {
  "2K": "UPSAMPLE_IMAGE_RESOLUTION_2K",
  "4K": "UPSAMPLE_IMAGE_RESOLUTION_4K",
};

function buildUpsampleBody(params: UpsampleImageWithFlow2Params): Record<string, string> {
  return {
    request_id: params.flow2RequestId,
    target_resolution: UPSAMPLE_TARGET_RESOLUTION[params.resolution],
  };
}

/**
 * Flow2 upsample-image (async):
 * 1) POST /api/requests/upsample-image — enqueue
 * 2) Poll GET /api/requests/{upsampleJobId} đến status=done
 * 3) Trả URL ảnh (không tải base64)
 */
export async function upsampleImageWithFlow2(
  params: UpsampleImageWithFlow2Params
): Promise<UpsampledImageResult> {
  const { baseUrl, token } = await getFlow2Config();
  const sourceRequestId = params.flow2RequestId.trim();
  const { onProgress, resolution } = params;
  const body = JSON.stringify(buildUpsampleBody(params));

  if (onProgress) {
    await onProgress(8, `Đang gửi yêu cầu upscale ${resolution}...`);
  }

  const enqueueResp = await fetchFlow2WithRetry(`${baseUrl}/api/requests/upsample-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  if (!enqueueResp.ok) {
    const errText = await enqueueResp.text();
    throwFlow2HttpError("Flow2 upsample-image enqueue error", enqueueResp.status, errText);
  }

  const enqueueData = (await enqueueResp.json()) as Record<string, unknown>;
  const upsampleJobId = pickUpsampleJobId(enqueueData);
  if (!upsampleJobId) {
    throw new Error("Không lấy được upsample job id từ Flow2");
  }

  logger.info(
    `[flow2-upsample-image] Enqueued source=${sourceRequestId} resolution=${resolution} job=${upsampleJobId}`
  );

  if (onProgress) {
    await onProgress(12, "Đã enqueue, đang chờ Flow2 upscale...");
  }

  const statusData = await waitForUpsampleJobDone(upsampleJobId, {
    onProgress,
    progressLabel: `upscale ảnh ${resolution}`,
  });

  if (onProgress) {
    await onProgress(90, "Đang lấy link ảnh upscale...");
  }

  const imageUrl = await resolveUpsampleImageUrl(upsampleJobId, statusData);

  logger.info(
    `[flow2-upsample-image] Hoàn tất ${resolution} source=${sourceRequestId} job=${upsampleJobId} url=${imageUrl}`
  );

  if (onProgress) {
    await onProgress(100, `Hoàn tất upscale ảnh ${resolution}`);
  }

  return {
    imageUrl,
    mimeType: "image/jpeg",
    upsampleJobId,
  };
}
