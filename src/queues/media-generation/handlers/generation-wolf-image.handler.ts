/**
 * Handler cho job loại `GENERATION_REVIEW_IMAGE`
 * (route POST /api/app/generation-review-image/).
 */
import {
  IMediaGenerationJob,
  MediaGenerationImageResult,
} from "../../../libs/dal/mediaGenerationJob";
import {
  incrementImageCount,
  ReferenceImageInput,
} from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";
import { runImagePipeline } from "./_image-pipeline";

export type GenerationWolfImagePayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  productImages?: string[];
  objectToPersonifyImages?: ReferenceImageInput[];
  productImagePrompt?: string;
  aspectRatio?: "16:9" | "9:16";
  noText?: boolean;
  artStyleId?: string;
  artStyle?: string;
  config?: {
    numberOfImages?: number;
    aspectRatio?: "16:9" | "9:16";
    noText?: boolean;
  };
};

const LOG_PREFIX = "generation-wolf-image";

export async function handleGenerationWolfImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<GenerationWolfImagePayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const productImageUrls = payload.productImages?.filter(Boolean) || [];

  const aspectRatio = payload.aspectRatio ?? payload.config?.aspectRatio;

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: payload.prompt,
    aspectRatio,
    imageGroups: {
      userImages: productImageUrls,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
