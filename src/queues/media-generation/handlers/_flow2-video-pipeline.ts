/**
 * Pipeline tạo video qua Flow2 (text-to-video / multi-image-to-video).
 *
 *   chuẩn hoá ảnh base64/url → gọi Flow2 create request → poll status → trả videoUri
 */
import logger from "../../../helpers/logger";
import { PollVideoResult } from "../../../routers/api-media/handle-video-generation";
import { generateVideoWithFlow2 } from "../../../routers/api-media/flow2/video-generation";
import { MediaJobEmitter } from "../job-emitter";

export type RunFlow2VideoPipelineArgs = {
  customerId: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  videoQuality?: string;
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
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
    emitter,
    logPrefix = "generation-video",
  } = args;

  await emitter.progress(20, "Đang chuẩn hoá ảnh tham chiếu...");
  logger.info(`[${logPrefix}] Bắt đầu gọi Flow2 tạo video (user ${customerId})`);

  const { requestId, video } = await generateVideoWithFlow2({
    prompt,
    aspectRatio,
    videoQuality,
    imageInputs: images,
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
  };
}
