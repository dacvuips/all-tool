import {
  IMediaGenerationJob,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { runApiMediaVideoFlow2 } from "../../../routers/api-media/api-media-flow2-video";
import { ApiMediaVideoRequest } from "../../../routers/api-media/api-media-validate";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import {
  assertApiMediaTokenRequestQuota,
  incrementApiMediaTokenUsage,
} from "./_api-media-quota";

export async function handleApiMediaVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const apiMediaTokenId = job.metadata?.apiMediaTokenId as string | undefined;
  if (!apiMediaTokenId) {
    throw new Error("Thiếu apiMediaTokenId trong metadata job");
  }

  await assertApiMediaTokenRequestQuota(apiMediaTokenId);

  const payload = await loadMediaJobPayload<ApiMediaVideoRequest>(job);
  if (!payload?.prompt) {
    throw new Error("Thiếu prompt");
  }

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  const result = await runApiMediaVideoFlow2(payload, {
    customerId: job.customerId,
    logPrefix: "api-media-video",
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
  });

  await incrementApiMediaTokenUsage(apiMediaTokenId);
  return {
    videoUri: result.videoUri,
    videoBytes: null,
    mimeType: result.mimeType,
    flow2RequestId: result.flow2RequestId,
  };
}
