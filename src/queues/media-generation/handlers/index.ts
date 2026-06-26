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
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { MediaJobEmitter } from "../job-emitter";
import { handleCopyVideoGenerateImage } from "./copy-video-generate-image.handler";
import { handleGenerationElementImage } from "./generation-element-image.handler";
import { handleGenerationElementVideoToVideo } from "./generation-element-video-to-video.handler";
import { handleGenerationElementVideo } from "./generation-element-video.handler";
import { handleGenerationImage } from "./generation-image.handler";
import { handleGenerationReviewImage } from "./generation-review-image.handler";
import { handleGenerationReviewVideo } from "./generation-review-video.handler";
import { handleGenerationVideo } from "./generation-video.handler";
import { handleGenerationWolfImage } from "./generation-wolf-image.handler";
import { handleGenerationWolfVideo } from "./generation-wolf-video.handler";
import { handleApiMediaImage } from "./api-media-image.handler";
import { handleApiMediaVideo } from "./api-media-video.handler";

export type MediaJobHandlerResult = MediaGenerationImageResult | MediaGenerationVideoResult;

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
  [MediaGenerationJobType.API_MEDIA_IMAGE]: handleApiMediaImage,
  [MediaGenerationJobType.API_MEDIA_VIDEO]: handleApiMediaVideo,
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
