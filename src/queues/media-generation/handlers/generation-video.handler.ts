/**
 * Handler cho job loại `GENERATION_VIDEO`
 * (route POST /api/app/generation-video/).
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
import { buildVideoPrompt, getVideoPromptOptionsFromPayload } from "./_video-prompt";

export type GenerationVideoPayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  noText?: boolean;
  voiceDisable?: boolean;
  /** Alias top-level — ưu tiên thấp hơn config.videoMode */
  video_mode?: Flow2VideoMode | string;
  config?: {
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
    noText?: boolean;
    voiceDisable?: boolean;
    /** frame = startImage/endImage; component = Reference */
    videoMode?: Flow2VideoMode | string;
    serviceImageType?: ServiceImageEnum;
  };
};

export async function handleGenerationVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<GenerationVideoPayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  const fullPrompt = buildVideoPrompt(
    payload.prompt,
    getVideoPromptOptionsFromPayload(payload)
  );

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt: fullPrompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    videoMode: payload.config?.videoMode ?? payload.video_mode,
    serviceImageType: payload.config?.serviceImageType,
    emitter,
    logPrefix: "generation-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
