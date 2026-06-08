/**
 * Handler cho job loại `GENERATION_ELEMENT_VIDEO_TO_VIDEO`
 * (route POST /api/app/generation-element-video-to-video/).
 *
 * Khác `GENERATION_ELEMENT_VIDEO`: cần một video tham chiếu, dùng API video-to-video.
 */
import {
  incrementVideoCount,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { IMediaGenerationJob, MediaGenerationVideoResult } from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { runVideoPipeline } from "./_video-pipeline";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { buildVideoPromptFromPayload } from "./_video-prompt";

export type GenerationElementVideoToVideoPayload = {
  prompt?: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  noText?: boolean;
  voiceDisable?: boolean;
  video: {
    videoBytes: string | null;
    mimeType: string;
  };
  config?: {
    prompt?: string;
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
    noText?: boolean;
    voiceDisable?: boolean;
    artStyleId?: string;
    artStyle?: string;
    serviceImageType?: ServiceImageEnum;
  };
};

export async function handleGenerationElementVideoToVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<GenerationElementVideoToVideoPayload>(job);

  if (!payload?.video?.videoBytes) {
    const err: any = new Error("Thiếu video tham chiếu");
    err.statusCode = 400;
    throw err;
  }

  await emitter.progress(10, "Đang chuẩn bị tạo video...");

  // Resolve artStyle
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

  const result = await runVideoPipeline({
    customerId: job.customerId,
    prompt: videoPrompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    videoReference: payload.video,
    apiMode: "video-to-video",
    emitter,
    logPrefix: "generation-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
