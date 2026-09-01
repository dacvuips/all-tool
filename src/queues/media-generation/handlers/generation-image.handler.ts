/**
 * Handler cho job loại `GENERATION_IMAGE` (route POST /api/app/generation-image/).
 *
 * Logic gốc nằm trong `generation-image.route.ts`. Worker chỉ chạy:
 *   build prompt → upload (+ captcha) → call API → trả kết quả
 *
 * `checkImageLimit` đã chạy ở route (fail-fast).
 * `incrementImageCount` chạy *trong handler* sau khi gọi API thành công.
 */
import {
  buildImageReferenceNotes,
  filterReferenceImages,
  incrementImageCount,
  resolveArtStyleTextForGeneration,
  ReferenceImageInput,
} from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationImageResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runImagePipeline } from "./_image-pipeline";
import { ApiMediaAspectRatio } from "../../../routers/api-media/api-media-constants";

/** Payload mong đợi trong Redis (`dataRedisKey`) */
export type GenerationImagePayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  productImages?: string[];
  objectToPersonifyImages?: ReferenceImageInput[];
  productImagePrompt?: string;
  artStyleId?: string;
  artStyle?: string;
  config?: {
    numberOfImages?: number;
    aspectRatio?: ApiMediaAspectRatio;
    noText?: boolean;
    imageModel?: string;
    artStyleId?: string;
    artStyle?: string;
  };
};

const LOG_PREFIX = "generation-image";

const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export async function handleGenerationImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<GenerationImagePayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const productImageUrls = payload.productImages?.filter(Boolean) || [];
  const personifyImageRefs = filterReferenceImages(payload.objectToPersonifyImages);
  const imageReferenceNote = buildImageReferenceNotes({
    productUrls: productImageUrls,
    productCustomPrompt: payload.productImagePrompt,
    personifyImages: personifyImageRefs,
  });

  const artStyleText = await resolveArtStyleTextForGeneration({
    artStyleId: payload.artStyleId || payload.config?.artStyleId,
    artStyle: payload.artStyle || payload.config?.artStyle,
  });

  const noTextStr = !payload.config?.noText ? NO_TEXT_NOTE : "";
  const fullPrompt = [artStyleText, payload.prompt, imageReferenceNote, noTextStr]
    .filter((part) => String(part || "").trim())
    .join(" ");

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.config?.aspectRatio,
    variantCount: payload.config?.numberOfImages,
    imageModel: payload.config?.imageModel,
    imageGroups: {
      personifyImages: personifyImageRefs,
      userImages: payload.images,
      productImageUrls,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  // Chỉ tăng quota khi API thực sự trả ảnh
  await incrementImageCount(job.customerId);

  return { images };
}
