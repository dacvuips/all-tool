/**
 * Handler cho job loại `GENERATION_VIDEO`
 * (route POST /api/app/generation-video/).
 */
import { incrementVideoCount } from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationVideoResult } from "../../../libs/dal/mediaGenerationJob";
import { MediaJobEmitter } from "../job-emitter";
import { runVideoPipeline } from "./_video-pipeline";

export type GenerationVideoPayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  config?: {
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
  };
};

export async function handleGenerationVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = (job.requestPayload || {}) as GenerationVideoPayload;

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  const result = await runVideoPipeline({
    customerId: job.customerId,
    prompt: payload.prompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    apiMode: "text-or-reference",
    emitter,
    logPrefix: "generation-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
