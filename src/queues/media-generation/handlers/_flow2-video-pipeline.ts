/**
 * Pipeline tạo video qua Flow2 (text-to-video / image-to-video).
 *
 *   chuẩn hoá ảnh base64/url → xác định video_mode → gọi Flow2 create request → poll status → trả videoUri
 */
import logger from "../../../helpers/logger";
import { PollVideoResult } from "../../../routers/api-media/handle-video-generation";
import {
  Flow2VideoMode,
  generateVideoWithFlow2,
  resolveFlow2VideoMode,
} from "../../../routers/api-media/flow2/video-generation";
import { ServiceImageEnum } from "../../../routers/app/constanst";
import { MediaJobEmitter } from "../job-emitter";

export type RunFlow2VideoPipelineArgs = {
  customerId: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  videoQuality?: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  /** Chế độ nạp ảnh — quyết định video_mode (image_only/start_end → frame; start_add_end → component) */
  serviceImageType?: ServiceImageEnum;
  /** Fallback: video_mode client gửi trực tiếp khi không có serviceImageType */
  videoMode?: Flow2VideoMode | string;
  emitter: MediaJobEmitter;
  logPrefix?: string;
};

export async function runFlow2VideoPipeline(
  args: RunFlow2VideoPipelineArgs
): Promise<PollVideoResult> {
  const {
    customerId,
    prompt,
    aspectRatio,
    videoQuality,
    images = [],
    videoMode,
    serviceImageType,
    emitter,
    logPrefix = "generation-video",
  } = args;

  const imageCount = images.length;
  const resolvedVideoMode = resolveFlow2VideoMode({
    serviceImageType,
    explicitMode: videoMode,
    imageCount,
  });

  await emitter.progress(20, "Đang chuẩn hoá ảnh tham chiếu...");
  logger.info(
    `[${logPrefix}] Bắt đầu gọi Flow2 tạo video (user ${customerId}, video_mode=${
      resolvedVideoMode ?? "text"
    }, images=${imageCount})`
  );

  const { requestId, video } = await generateVideoWithFlow2({
    prompt,
    aspectRatio,
    videoQuality,
    imageInputs: images,
    videoMode: resolvedVideoMode,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
  });

  logger.info(`[${logPrefix}] Flow2 request ${requestId} hoàn tất (user ${customerId})`);
  await emitter.progress(95, "Đang hoàn tất dữ liệu video...");

  return {
    videoUri: video.videoUri,
    videoBytes: null,
    mimeType: video.mimeType,
    flow2RequestId: requestId,
  };
}
