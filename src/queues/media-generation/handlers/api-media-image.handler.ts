import { IMediaGenerationJob, MediaGenerationImageResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runImagePipeline } from "./_image-pipeline";
import {
  assertApiMediaTokenRequestQuota,
  incrementApiMediaTokenUsage,
} from "./_api-media-quota";

import { ApiMediaImageRequest } from "../../../routers/api-media/api-media-validate";

const LOG_PREFIX = "api-media-image";

const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export async function handleApiMediaImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const apiMediaTokenId = job.metadata?.apiMediaTokenId as string | undefined;
  if (!apiMediaTokenId) {
    throw new Error("Thiếu apiMediaTokenId trong metadata job");
  }

  await assertApiMediaTokenRequestQuota(apiMediaTokenId);

  const payload = await loadMediaJobPayload<ApiMediaImageRequest>(job);
  if (!payload?.prompt) {
    throw new Error("Thiếu prompt");
  }

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const noTextStr = !payload.config?.noText ? NO_TEXT_NOTE : "";
  const fullPrompt = `${payload.prompt} ${noTextStr}`.trim();

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.config?.aspectRatio,
    variantCount: payload.config?.numberOfImages,
    imageModel: payload.config?.imageModel,
    imageGroups: {
      userImages: payload.images,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementApiMediaTokenUsage(apiMediaTokenId);
  return { images };
}
