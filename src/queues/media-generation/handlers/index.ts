/**
 * Registry mapping `MediaGenerationJobType` → handler function.
 *
 * Worker chỉ cần `HANDLER_REGISTRY[job.type](job, emitter)`. Thêm loại mới:
 *   1. Thêm enum vào `MediaGenerationJobType`.
 *   2. Viết 1 handler mới (xem các file `.handler.ts` hiện có làm template).
 *   3. Thêm dòng map ở đây.
 */
import {
  IMediaGenerationJob,
  MediaGenerationImageResult,
  MediaGenerationJobType,
  MediaGenerationJsonResult,
  MediaGenerationUpsampleImageResult,
  MediaGenerationUpsampleVideoResult,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { MediaJobEmitter } from "../job-emitter";
import { handleCopyVideoGenerateImage } from "./copy-video-generate-image.handler";
import { handleCopyVideoAnalysis } from "./copy-video-analysis.handler";
import { handleGenerationElementImage } from "./generation-element-image.handler";
import { handleGenerationElementVideoToVideo } from "./generation-element-video-to-video.handler";
import { handleGenerationElementVideo } from "./generation-element-video.handler";
import { handleGenerationImage } from "./generation-image.handler";
import { handleGenerationReviewImage } from "./generation-review-image.handler";
import { handleGenerationReviewScene } from "./generation-review-scene.handler";
import { handleGenerationReviewVideo } from "./generation-review-video.handler";
import { handleGenerationScene } from "./generation-scene.handler";
import { handleGenerationTrending } from "./generation-trending.handler";
import { handleGenerationVideo } from "./generation-video.handler";
import { handleGenerationWolfImage } from "./generation-wolf-image.handler";
import { handleGenerationWolfVideo } from "./generation-wolf-video.handler";
import { handleGenerationShopeeVideo } from "./generation-shopee-video.handler";
import { handleApiMediaImage } from "./api-media-image.handler";
import { handleApiMediaVideo } from "./api-media-video.handler";
import { handleApiMediaUpsampleImage } from "./api-media-upsample-image.handler";
import { handleApiMediaUpsampleVideo } from "./api-media-upsample-video.handler";
import { handleFilmGenerationImage } from "./film-generation-image.handler";
import { handleFilmGenerationVideo } from "./film-generation-video.handler";
import { handleStoryboardAnalysis } from "./storyboard-analysis.handler";
import { handleSuggestConfig } from "./suggest-config.handler";
import { handleVoiceFreeGenAudio } from "./voice-free-gen-audio.handler";
import { handleGenerateText } from "./generate-text.handler";

export type MediaJobHandlerResult =
  | MediaGenerationImageResult
  | MediaGenerationVideoResult
  | MediaGenerationJsonResult
  | MediaGenerationUpsampleImageResult
  | MediaGenerationUpsampleVideoResult;

export type MediaJobHandler = (
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
) => Promise<MediaJobHandlerResult>;

export const HANDLER_REGISTRY: Record<MediaGenerationJobType, MediaJobHandler> = {
  [MediaGenerationJobType.GENERATION_IMAGE]: handleGenerationImage,
  [MediaGenerationJobType.GENERATION_ELEMENT_IMAGE]: handleGenerationElementImage,
  [MediaGenerationJobType.COPY_VIDEO_GENERATE_IMAGE]: handleCopyVideoGenerateImage,
  [MediaGenerationJobType.GENERATION_VIDEO]: handleGenerationVideo,
  [MediaGenerationJobType.GENERATION_ELEMENT_VIDEO]: handleGenerationElementVideo,
  [MediaGenerationJobType.GENERATION_ELEMENT_VIDEO_TO_VIDEO]: handleGenerationElementVideoToVideo,
  [MediaGenerationJobType.GENERATION_REVIEW_IMAGE]: handleGenerationReviewImage,

  [MediaGenerationJobType.GENERATION_REVIEW_VIDEO]: handleGenerationReviewVideo,
  [MediaGenerationJobType.GENERATION_WOLF_VIDEO]: handleGenerationWolfVideo,
  [MediaGenerationJobType.GENERATION_WOLF_IMAGE]: handleGenerationWolfImage,
  [MediaGenerationJobType.GENERATION_SHOPEE_VIDEO]: handleGenerationShopeeVideo,
  [MediaGenerationJobType.API_MEDIA_IMAGE]: handleApiMediaImage,
  [MediaGenerationJobType.API_MEDIA_VIDEO]: handleApiMediaVideo,
  [MediaGenerationJobType.API_MEDIA_UPSAMPLE_IMAGE]: handleApiMediaUpsampleImage,
  [MediaGenerationJobType.API_MEDIA_UPSAMPLE_VIDEO]: handleApiMediaUpsampleVideo,
  [MediaGenerationJobType.GENERATION_SCENE]: handleGenerationScene,
  [MediaGenerationJobType.GENERATION_REVIEW_SCENE]: handleGenerationReviewScene,
  [MediaGenerationJobType.STORYBOARD_ANALYSIS]: handleStoryboardAnalysis,
  [MediaGenerationJobType.SUGGEST_CONFIG]: handleSuggestConfig,
  [MediaGenerationJobType.COPY_VIDEO_ANALYSIS]: handleCopyVideoAnalysis,
  [MediaGenerationJobType.GENERATION_TRENDING]: handleGenerationTrending,
  [MediaGenerationJobType.FILM_GENERATION_IMAGE]: handleFilmGenerationImage,
  [MediaGenerationJobType.FILM_GENERATION_VIDEO]: handleFilmGenerationVideo,
  [MediaGenerationJobType.VOICE_FREE_GEN_AUDIO]: handleVoiceFreeGenAudio,
  [MediaGenerationJobType.GENERATE_TEXT]: handleGenerateText,
};

/**
 * Lấy handler cho 1 type. Throw nếu không có (chặn handler thiếu sót khi enqueue type lạ).
 */
export function getMediaJobHandler(type: MediaGenerationJobType): MediaJobHandler {
  const handler = HANDLER_REGISTRY[type];
  if (!handler) {
    throw new Error(`Không tìm thấy handler cho job type "${type}"`);
  }
  return handler;
}
