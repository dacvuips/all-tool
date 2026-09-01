/**
 * Handler cho job loại `GENERATION_ELEMENT_IMAGE`
 * (route POST /api/app/generation-element-image/).
 */
import {
  incrementImageCount,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationImageResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { ApiMediaAspectRatio } from "../../../routers/api-media/api-media-constants";
import { runImagePipeline } from "./_image-pipeline";

export type GenerationElementImagePayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  aspectRatio?: ApiMediaAspectRatio;
  noText?: boolean;
  artStyleId?: string;
  artStyle?: string;
};

const LOG_PREFIX = "generation-image";

const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export async function handleGenerationElementImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<GenerationElementImagePayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo ảnh...");

  // Resolve artStyle: nếu client gửi artStyleId → tìm prompt trong DB
  const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
    await resolveArtStylePrompt({
      artStyleId: payload.artStyleId,
      artStyle: payload.artStyle,
    });

  let artStyleText = payload.artStyle || "";
  if (resolvedArtStylePrompt && resolvedArtStyleName === payload.artStyle) {
    artStyleText = resolvedArtStylePrompt;
  }

  const noTextStr = !payload.noText ? NO_TEXT_NOTE : "";
  const fullPrompt = `${artStyleText} ${payload.prompt} ${noTextStr}`;

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.aspectRatio,
    imageGroups: { userImages: payload.images },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
