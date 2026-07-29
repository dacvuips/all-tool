/**
 * Handler job `GENERATION_SHOPEE_VIDEO`
 * (video-affiliate-plus — gen_image_video, video_mode=component).
 *
 * Ảnh (1–3): tùy chọn ảnh nhân vật trước, ảnh sản phẩm cuối (bắt buộc).
 * variant_count = videosPerJob từ config.
 * Nối video + lưu IndexedDB do client xử lý sau khi nhận videoUris.
 */
import {
  IMediaGenerationJob,
  MediaGenerationVideoResult,
} from "../../../libs/dal/mediaGenerationJob";
import { FLOW2_VIDEO_MODE } from "../../../routers/api-media/flow2/video-mode";
import { incrementVideoCount, MediaImageBytes } from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";
import { runFlow2VideoPipeline } from "./_flow2-video-pipeline";

export type GenerationShopeeVideoPayload = {
  prompt?: string;
  images?: Array<string | MediaImageBytes>;
  variantCount?: number;
  videosPerJob?: number;
  videoQuality?: string;
  video_mode?: string;
  config?: {
    prompt?: string;
    aspectRatio?: "16:9" | "9:16";
    variantCount?: number;
    videosPerJob?: number;
    videoQuality?: string;
    videoMode?: string;
  };
};

export async function handleGenerationShopeeVideo(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationVideoResult> {
  const payload = await loadMediaJobPayload<GenerationShopeeVideoPayload>(job);

  await emitter.progress(10, "Đang chuẩn bị tạo video Shopee...");

  const prompt = (payload.prompt ?? payload.config?.prompt ?? "").trim();
  /** Flow2 component: 1–3 ảnh tham chiếu (có thể chỉ ảnh sản phẩm) */
  const images = (payload.images || []).slice(0, 3);

  if (images.length < 1) {
    throw Object.assign(new Error("Thiếu ảnh sản phẩm"), { statusCode: 400 });
  }
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt"), { statusCode: 400 });
  }

  const variantCount = Math.max(
    1,
    Math.min(
      5,
      Math.round(
        payload.variantCount ??
          payload.videosPerJob ??
          payload.config?.variantCount ??
          payload.config?.videosPerJob ??
          1
      )
    )
  );
  const videoQuality =
    payload.videoQuality || payload.config?.videoQuality || "fast";

  const result = await runFlow2VideoPipeline({
    customerId: job.customerId,
    prompt,
    aspectRatio: payload.config?.aspectRatio || "9:16",
    videoQuality,
    variantCount,
    images,
    videoMode: FLOW2_VIDEO_MODE.COMPONENT,
    emitter,
    logPrefix: "generation-shopee-video",
  });

  await incrementVideoCount(job.customerId);

  const videoUris =
    result.videoUris?.length && result.videoUris.length > 1
      ? result.videoUris
      : result.videoUri
      ? [result.videoUri]
      : [];

  return {
    videoUri: result.videoUri,
    videoBytes: result.videoBytes,
    mimeType: result.mimeType,
    flow2RequestId: result.flow2RequestId,
    videoUris: videoUris.length ? videoUris : undefined,
  };
}

