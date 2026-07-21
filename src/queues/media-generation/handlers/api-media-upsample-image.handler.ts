/**
 * Handler API_MEDIA_UPSAMPLE_IMAGE — upscale ảnh Flow2 (async job, tránh 504).
 * Không trừ usedQuantity (upsample miễn phí theo lượt request).
 */
import {
  IMediaGenerationJob,
  MediaGenerationUpsampleImageResult,
} from "../../../libs/dal/mediaGenerationJob";
import {
  upsampleImageWithFlow2,
  UpsampleResolution,
} from "../../../routers/api-media/flow2/upsample-image";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";

export type ApiMediaUpsampleImagePayload = {
  resolution: UpsampleResolution;
  flow2RequestId: string;
};

export async function handleApiMediaUpsampleImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationUpsampleImageResult> {
  const apiMediaTokenId = job.metadata?.apiMediaTokenId as string | undefined;
  if (!apiMediaTokenId) {
    throw new Error("Thiếu apiMediaTokenId trong metadata job");
  }

  const payload = await loadMediaJobPayload<ApiMediaUpsampleImagePayload>(job);
  if (!payload?.flow2RequestId?.trim()) {
    throw Object.assign(new Error("Thiếu flow2RequestId"), { statusCode: 400 });
  }

  await emitter.progress(5, `Đang upscale ảnh ${payload.resolution}...`);

  const result = await upsampleImageWithFlow2({
    resolution: payload.resolution || "4K",
    flow2RequestId: payload.flow2RequestId.trim(),
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
  });

  await emitter.progress(100, "Hoàn tất upscale ảnh");
  return {
    imageUrl: result.imageUrl,
    fifeUrl: result.imageUrl,
    mimeType: result.mimeType,
    upsampleJobId: result.upsampleJobId,
    imageBytes: result.imageBytes,
  };
}
