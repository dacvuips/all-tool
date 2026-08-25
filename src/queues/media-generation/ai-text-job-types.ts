/**
 * Job AI text/JSON (kịch bản, phân tích, suggest) — không thuộc luồng ảnh/video.
 * Quota dùng checkRequestLimit / reserveRequestSlots ở route; worker luôn pickup được.
 */
import { MediaGenerationJobType } from "../../libs/dal/mediaGenerationJob";

export const AI_TEXT_JOB_TYPES: ReadonlyArray<MediaGenerationJobType> = [
  MediaGenerationJobType.GENERATION_SCENE,
  MediaGenerationJobType.GENERATION_REVIEW_SCENE,
  MediaGenerationJobType.STORYBOARD_ANALYSIS,
  MediaGenerationJobType.SUGGEST_CONFIG,
  MediaGenerationJobType.COPY_VIDEO_ANALYSIS,
  MediaGenerationJobType.GENERATION_TRENDING,
  MediaGenerationJobType.VOICE_FREE_GEN_AUDIO,
  MediaGenerationJobType.GENERATE_TEXT,
];

export function isAiTextJobType(type: MediaGenerationJobType): boolean {
  return AI_TEXT_JOB_TYPES.includes(type);
}
