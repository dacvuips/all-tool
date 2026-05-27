/**
 * Handler cho job loại `GENERATION_ELEMENT_VIDEO`
 * (route POST /api/app/generation-element-video/).
 *
 * Khác `GENERATION_VIDEO` ở chỗ:
 *   - Có resolveArtStyle (artStyleId/artStyle DB lookup).
 *   - Dispatch API theo `serviceImageType` (start-image / start-end / reference / text).
 */
import {
  incrementVideoCount,
  resolveArtStylePrompt,
} from "../../../routers/app/affiliate-scene/_shared";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { IMediaGenerationJob, MediaGenerationVideoResult } from "../../../libs/dal/mediaGenerationJob";
import { MediaJobEmitter } from "../job-emitter";
import { runVideoPipeline, VideoApiMode } from "./_video-pipeline";

export type GenerationElementVideoPayload = {
  prompt: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  config?: {
    aspectRatio?: "16:9" | "9:16";
    generateAudio?: boolean;
    artStyleId?: string;
    artStyle?: string;
    serviceImageType?: ServiceImageEnum;
  };
};

/** Map ServiceImageEnum → VideoApiMode */
function mapServiceImageToMode(
  serviceType: ServiceImageEnum | undefined,
  imageCount: number
): VideoApiMode {
  switch (serviceType) {
    case ServiceImageEnum.imageOnly:
      return "start-image";
    case ServiceImageEnum.startEnd:
      return "start-end-image";
    case ServiceImageEnum.startAddEnd:
      return "reference-images";
    case ServiceImageEnum.video:
    default:
      return imageCount > 0 ? "reference-images" : "text-or-reference";
  }
}

export async function handleGenerationElementVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = (job.requestPayload || {}) as GenerationElementVideoPayload;

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

  const videoPrompt = `${artStyleText} ${payload.prompt}`;

  const imageCount = payload.images?.length || 0;
  const apiMode = mapServiceImageToMode(payload.config?.serviceImageType, imageCount);

  const result = await runVideoPipeline({
    customerId: job.customerId,
    prompt: videoPrompt,
    aspectRatio: payload.config?.aspectRatio,
    images: payload.images,
    apiMode,
    emitter,
    logPrefix: "generation-video",
  });

  await incrementVideoCount(job.customerId);
  return result;
}
