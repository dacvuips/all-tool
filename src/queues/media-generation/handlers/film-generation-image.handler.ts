/**
 * Handler `FILM_GENERATION_IMAGE`
 * Route: POST /api/app/film/generate-image/
 *
 * Giống pipeline generate image tool (Flow2) nhưng job type + payload + logPrefix riêng film.
 */
import {
  incrementImageCount,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationImageResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runImagePipeline } from "./_image-pipeline";
import {
  prependFilmArtStyleToPrompt,
  type FilmJobContext,
  type FilmMediaAssetKind,
} from "./film-job.types";

/** Payload Redis cho film generate image */
export type FilmGenerationImagePayload = FilmJobContext & {
  prompt: string;
  /** Ảnh reference (character sheet gen thường không cần; shot frame có thể đính) */
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  aspectRatio?: "16:9" | "9:16";
  numberOfImages?: number;
  imageModel?: string;
  noText?: boolean;
  /** ID collection artstyles — resolve prompt gắn vào prompt tạo ảnh */
  artStyleId?: string;
  filmAssetKind?: FilmMediaAssetKind;
};

const LOG_PREFIX = "film-generation-image";

const NO_TEXT_NOTE =
  "\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.";

const SINGLE_FRAME_NOTE =
  "\nIMPORTANT: Output exactly ONE unified cinematic frame. Do NOT split, divide, or stack multiple panels. No storyboard layout, comic strip, grid, contact sheet, or multiple shots in one image.";

function finalizeFilmImagePrompt(
  prompt: string,
  payload: FilmGenerationImagePayload,
  artStylePrompt?: string
): string {
  // Art style luôn ở đầu prompt
  let full = prependFilmArtStyleToPrompt(prompt, artStylePrompt);
  if (payload.filmAssetKind === "shot_frame") {
    if (!/single unified frame|no split panel|one unified cinematic frame/i.test(full)) {
      full = `${full}${SINGLE_FRAME_NOTE}`;
    }
  }
  if (payload.noText === true) {
    full = `${full}${NO_TEXT_NOTE}`;
  }
  return full;
}

export async function handleFilmGenerationImage(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationImageResult> {
  const payload = await loadMediaJobPayload<FilmGenerationImagePayload>(job);

  const assetLabel = payload.filmAssetKind || "asset";
  await emitter.progress(10, `Film: đang chuẩn bị tạo ảnh (${assetLabel})...`);

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt film generate image"), { statusCode: 400 });
  }

  // Có artStyleId → lấy prompt từ collection artstyles; không chọn / không tìm thấy → để trống
  const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
    artStyleId: payload.artStyleId,
  });

  const fullPrompt = finalizeFilmImagePrompt(prompt, payload, resolvedArtStylePrompt);

  const images = await runImagePipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.aspectRatio === "9:16" ? "9:16" : "16:9",
    variantCount: payload.numberOfImages || 1,
    imageModel: payload.imageModel,
    imageGroups: {
      userImages: payload.images || [],
      productImageUrls: [],
    },
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementImageCount(job.customerId);

  return { images };
}
