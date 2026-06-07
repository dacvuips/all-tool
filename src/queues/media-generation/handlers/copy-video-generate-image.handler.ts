/**
 * Handler cho job loại `COPY_VIDEO_GENERATE_IMAGE`
 * (route POST /api/app/copy-video-generate-image/).
 *
 * Tương tự `GENERATION_IMAGE` nhưng dùng cho module copy-video.
 */
import {
  buildImageReferenceNotes,
  filterReferenceImages,
  incrementImageCount,
  ReferenceImageInput,
} from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationImageResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runImagePipeline } from "./_image-pipeline";

export type CopyVideoGenerateImagePayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  productImages?: string[];
  objectToPersonifyImages?: ReferenceImageInput[];
  productImagePrompt?: string;
  config?: {
    numberOfImages?: number;
    aspectRatio?: "16:9" | "9:16";
  };
  noText?: boolean;
};

const LOG_PREFIX = "generation-image";

const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export async function handleCopyVideoGenerateImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<CopyVideoGenerateImagePayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const productImageUrls = payload.productImages?.filter(Boolean) || [];
  const personifyImageRefs = filterReferenceImages(payload.objectToPersonifyImages);
  const imageReferenceNote = buildImageReferenceNotes({
    productUrls: productImageUrls,
    productCustomPrompt: payload.productImagePrompt,
    personifyImages: personifyImageRefs,
  });

  const noTextStr = !payload.noText ? NO_TEXT_NOTE : "";
  const fullPrompt = `${payload.prompt} ${imageReferenceNote} ${noTextStr}`;

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.config?.aspectRatio,
    imageGroups: {
      personifyImages: personifyImageRefs,
      userImages: payload.images,
      productImageUrls,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
