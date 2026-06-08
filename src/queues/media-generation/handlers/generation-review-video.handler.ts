/**
 * Handler cho job loại `GENERATION_REVIEW_VIDEO`
 * (review product — cùng API element video, pipeline Flow2).
 */
import {
  IMediaGenerationJob,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { Flow2VideoMode } from "../../../routers/api-media/flow2/video-generation";
import {
  incrementVideoCount,
  MediaImageBytes,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runFlow2VideoPipeline } from "./_flow2-video-pipeline";
import { buildVideoPromptFromPayload } from "./_video-prompt";

export type GenerationReviewVideoPayload = {
  prompt?: string;
  images?: Array<string | MediaImageBytes>;
  noText?: boolean;
  voiceDisable?: boolean;
  video_mode?: Flow2VideoMode | string;
  config?: {
    prompt?: string;
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
    noText?: boolean;
    voiceDisable?: boolean;
    artStyleId?: string;
    artStyle?: string;
    serviceImageType?: ServiceImageEnum;
    videoMode?: Flow2VideoMode | string;
  };
};

export async function handleGenerationReviewVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<GenerationReviewVideoPayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
    await resolveArtStylePrompt({
      artStyleId: payload.config?.artStyleId,
      artStyle: payload.config?.artStyle,
    });
  let artStyleText = payload.config?.artStyle || "";
  if (resolvedArtStylePrompt && resolvedArtStyleName === payload.config?.artStyle) {
    artStyleText = resolvedArtStylePrompt;
  }

  const videoPrompt = buildVideoPromptFromPayload(payload, { prepend: artStyleText });

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt: videoPrompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    videoMode: payload.config?.videoMode,
    serviceImageType: payload.config?.serviceImageType,
    emitter,
    logPrefix: "generation-review-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
