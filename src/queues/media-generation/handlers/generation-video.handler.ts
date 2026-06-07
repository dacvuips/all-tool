/**
 * Handler cho job loại `GENERATION_VIDEO`
 * (route POST /api/app/generation-video/).
 */
import { incrementVideoCount } from "../../../routers/app/affiliate-scene/_shared";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { Flow2VideoMode } from "../../../routers/api-media/flow2/video-generation";
import { IMediaGenerationJob, MediaGenerationVideoResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runFlow2VideoPipeline } from "./_flow2-video-pipeline";

export type GenerationVideoPayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  /** Alias top-level — ưu tiên thấp hơn config.videoMode */
  video_mode?: Flow2VideoMode | string;
  config?: {
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
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

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt: payload.prompt,
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
