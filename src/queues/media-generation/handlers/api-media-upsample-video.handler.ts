/**
 * Handler API_MEDIA_UPSAMPLE_VIDEO — upscale video 1080p Flow2 (async job, tránh 504).
 */
import {
  IMediaGenerationJob,
  MediaGenerationUpsampleVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { upsampleVideoWithFlow2 } from "../../../routers/api-media/flow2/upsample-video";
import {
  assertApiMediaTokenRequestQuota,
  incrementApiMediaTokenUsage,
} from "./_api-media-quota";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";

export type ApiMediaUpsampleVideoPayload = {
  flow2RequestId: string;
};

export async function handleApiMediaUpsampleVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationUpsampleVideoResult> {
  const apiMediaTokenId = job.metadata?.apiMediaTokenId as string | undefined;
  if (!apiMediaTokenId) {
    throw new Error("Thiếu apiMediaTokenId trong metadata job");
  }

  const payload = await loadMediaJobPayload<ApiMediaUpsampleVideoPayload>(job);
  if (!payload?.flow2RequestId?.trim()) {
    throw Object.assign(new Error("Thiếu requestId / flow2RequestId"), { statusCode: 400 });
  }

  await assertApiMediaTokenRequestQuota(apiMediaTokenId);
  await emitter.progress(5, "Đang upscale video 1080p...");

  const result = await upsampleVideoWithFlow2({
    flow2RequestId: payload.flow2RequestId.trim(),
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
  });

  await incrementApiMediaTokenUsage(apiMediaTokenId);
  await emitter.progress(100, "Hoàn tất upscale video");
  return {
    videoBytes: result.videoBytes,
    mimeType: result.mimeType,
  };
}
