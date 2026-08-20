/**
 * Handler `FILM_GENERATION_VIDEO`
 * Route: POST /api/app/film/generate-video/
 *
 * Giống pipeline generate video tool (Flow2) nhưng job type + payload + logPrefix riêng film.
 */
import {
  IMediaGenerationJob,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { Flow2VideoMode } from "../../../routers/api-media/flow2/video-generation";
import { incrementVideoCount } from "../../../routers/app/affiliate-scene/_shared";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";
import { runFlow2VideoPipeline } from "./_flow2-video-pipeline";
import type { FilmJobContext, FilmMediaAssetKind } from "./film-job.types";

/** Payload Redis cho film generate video */
export type FilmGenerationVideoPayload = FilmJobContext & {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  aspectRatio?: "16:9" | "9:16";
  videoMode?: Flow2VideoMode | string;
  serviceImageType?: ServiceImageEnum | string;
  generateAudio?: boolean;
  noText?: boolean;
  filmAssetKind?: FilmMediaAssetKind;
};

const LOG_PREFIX = "film-generation-video";

const NO_TEXT_NOTE =
  "\nIMPORTANT: Do not render any readable on-screen text, captions, logos, or watermarks in the video frames.";

export async function handleFilmGenerationVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<FilmGenerationVideoPayload>(job);

  await emitter.progress(10, "Film: đang chuẩn bị tạo video...");

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt film generate video"), { statusCode: 400 });
  }

  // Film: không tự chèn anti-text note (chỉ ghép khi client gửi noText: true)
  const fullPrompt =
    payload.noText === true ? `${prompt}${NO_TEXT_NOTE}` : prompt;

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.aspectRatio || "9:16",
    images: payload.images,
    videoMode: payload.videoMode,
    serviceImageType: payload.serviceImageType as ServiceImageEnum | undefined,
    emitter,
    logPrefix: LOG_PREFIX,
  });

  await incrementVideoCount(job.customerId);
  return result;
}
