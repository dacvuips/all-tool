/**
 * Handler cho job loại `GENERATION_REVIEW_VIDEO`
 * (review product — cùng API element video, pipeline Flow2).
 */
import {
  IMediaGenerationJob,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { Flow2VideoMode } from "../../../routers/api-media/flow2/video-generation";
import { incrementVideoCount, MediaImageBytes } from "../../../routers/app/affiliate-scene/_shared";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";
import { runFlow2VideoPipeline } from "./_flow2-video-pipeline";

export type GenerationWolfVideoPayload = {
  prompt?: string;
  images?: Array<string | MediaImageBytes>;
  noText?: boolean;
  voiceDisable?: boolean;
  voice?: string;
  video_mode?: Flow2VideoMode | string;
  config?: {
    prompt?: string;
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
    noText?: boolean;
    voiceDisable?: boolean;
    voice?: string;
    artStyleId?: string;
    artStyle?: string;
    serviceImageType?: ServiceImageEnum;
    videoMode?: Flow2VideoMode | string;
  };
};

export async function handleGenerationWolfVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<GenerationWolfVideoPayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt: payload.prompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    videoMode: payload.config?.videoMode ?? payload.video_mode,
    voice: payload.config?.voice ?? payload.voice,
    emitter,
    logPrefix: "generation-wolf-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
