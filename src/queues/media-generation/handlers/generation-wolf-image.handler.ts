/**
 * Handler cho job loại `GENERATION_WOLF_IMAGE`
 * (route POST /api/app/generate-image-wolf/).
 */
import {
  IMediaGenerationJob,
  MediaGenerationImageResult,
} from "../../../libs/dal/mediaGenerationJob";
import { incrementImageCount } from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";
import { runImagePipeline } from "./_image-pipeline";

export type GenerationWolfImagePayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  config?: {
    numberOfImages?: number;
    aspectRatio?: "16:9" | "9:16";
    imageModel?: string;
  };
};

const LOG_PREFIX = "generation-wolf-image";

export async function handleGenerationWolfImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<GenerationWolfImagePayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: payload.prompt,
    aspectRatio: payload.config?.aspectRatio,
    variantCount: payload.config?.numberOfImages,
    imageModel: payload.config?.imageModel,
    imageGroups: {
      userImages: payload.images,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
