/**
 * Handler cho job loại `GENERATION_REVIEW_IMAGE`
 * (route POST /api/app/generation-review-image/).
 */
import {
  IMediaGenerationJob,
  MediaGenerationImageResult,
} from "../../../libs/dal/mediaGenerationJob";
import {
  buildImageReferenceNotes,
  filterReferenceImages,
  incrementImageCount,
  ReferenceImageInput,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { runImagePipeline } from "./_image-pipeline";

export type GenerationReviewImagePayload = {
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

const LOG_PREFIX = "generation-review-image";

const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export async function handleGenerationReviewImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = (job.requestPayload || {}) as GenerationReviewImagePayload;

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
    await resolveArtStylePrompt({
      artStyleId: payload.artStyleId,
      artStyle: payload.artStyle,
    });

  let artStyleText = payload.artStyle || "";
  if (resolvedArtStylePrompt && resolvedArtStyleName === payload.artStyle) {
    artStyleText = resolvedArtStylePrompt;
  }

  const productImageUrls = payload.productImages?.filter(Boolean) || [];
  const personifyImageRefs = filterReferenceImages(payload.objectToPersonifyImages);
  const userImageRefs = filterReferenceImages((payload.images || []) as ReferenceImageInput[]);
  const imageReferenceNote = buildImageReferenceNotes({
    productUrls: productImageUrls,
    productCustomPrompt: payload.productImagePrompt,
    personifyImages: personifyImageRefs,
  });

  const rule = `
- Treat the uploaded image as immutable source truth.
- Any deviation from the original product appearance is prohibited.
`;
  const noText = payload.noText ?? payload.config?.noText;
  const aspectRatio = payload.aspectRatio ?? payload.config?.aspectRatio;
  const noTextStr = !noText ? NO_TEXT_NOTE : "";
  const fullPrompt = `${artStyleText} ${payload.prompt} ${imageReferenceNote} ${noTextStr} ${rule}`;

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio,
    imageGroups: {
      personifyImages: personifyImageRefs,
      userImages: userImageRefs.length ? userImageRefs : undefined,
      productImageUrls,
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
