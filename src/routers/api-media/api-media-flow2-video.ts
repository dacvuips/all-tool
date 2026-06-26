/**
 * Flow2 video pipeline chỉ dùng cho API Media publish (hỗ trợ Omni: duration, video_base64s).
 * Không thay đổi flow2/video-generation.ts dùng chung bởi app.
 */
import logger from "../../helpers/logger";
import { isHttpUrl, looksLikeRawBase64 } from "./flow2/_shared";
import { createFlow2Request, runFlow2WithRetry, safeProgress } from "./flow2/_shared";
import {
  Flow2ImageInput,
  normalizeImageToDataUrl,
} from "./flow2/image-generation";
import {
  GeneratedVideo,
  waitForFlow2VideoResult,
} from "./flow2/video-generation";
import { Flow2VideoMode } from "./flow2/video-mode";
import { ApiMediaVideoRequest } from "./api-media-validate";

function looksLikeRawBase64Video(value: string): boolean {
  return looksLikeRawBase64(value, 256);
}

async function normalizeVideoToDataUrl(
  input: string | { imageBytes: string; mimeType?: string }
): Promise<string> {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Video đầu vào rỗng");
    if (trimmed.startsWith("data:video/")) return trimmed;
    if (isHttpUrl(trimmed)) {
      throw new Error("API Media chưa hỗ trợ video URL — gửi base64 hoặc data:video/...");
    }
    if (looksLikeRawBase64Video(trimmed)) {
      return `data:video/mp4;base64,${trimmed.replace(/\s/g, "")}`;
    }
    throw new Error("Không nhận diện được định dạng video đầu vào");
  }

  const bytes = input.imageBytes?.trim();
  if (!bytes) throw new Error("Video đầu vào thiếu bytes");
  const mime = input.mimeType || "video/mp4";
  if (bytes.startsWith("data:video/")) return bytes;
  return `data:${mime};base64,${bytes.replace(/\s/g, "")}`;
}

export type CreateApiMediaFlow2VideoParams = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  videoQuality?: string;
  videoDurationS?: number;
  imageInputs?: Flow2ImageInput[];
  videoInputs?: Array<string | { imageBytes: string; mimeType?: string }>;
  videoMode?: Flow2VideoMode;
};

export async function createApiMediaFlow2VideoRequest(
  params: CreateApiMediaFlow2VideoParams
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const aspect_ratio = params.aspectRatio || "16:9";
  const video_quality = params.videoQuality || "lite_relaxed";
  const imageInputs = params.imageInputs || [];
  const videoInputs = params.videoInputs || [];

  const durationFields =
    params.videoDurationS != null ? { video_duration_s: params.videoDurationS } : {};

  if (imageInputs.length === 0 && videoInputs.length === 0) {
    return createFlow2Request({
      type: "gen_text_video",
      params: {
        prompt: params.prompt,
        aspect_ratio,
        video_quality,
        ...durationFields,
      },
    });
  }

  if (!params.videoMode) {
    throw new Error("Thiếu video_mode khi tạo video có media đầu vào");
  }

  const image_base64s = await Promise.all(imageInputs.map(normalizeImageToDataUrl));
  const video_base64s =
    videoInputs.length > 0
      ? await Promise.all(videoInputs.map(normalizeVideoToDataUrl))
      : undefined;

  return createFlow2Request({
    type: "gen_image_video",
    params: {
      prompt: params.prompt,
      aspect_ratio,
      image_base64s,
      video_mode: params.videoMode,
      video_quality,
      ...durationFields,
      ...(video_base64s?.length ? { video_base64s } : {}),
    },
  });
}

export async function generateApiMediaVideoWithFlow2(
  params: CreateApiMediaFlow2VideoParams & {
    onProgress?: (progress: number, message?: string) => void | Promise<void>;
  }
): Promise<{ requestId: string; video: GeneratedVideo }> {
  const result = await runFlow2WithRetry({
    logTag: "api-media-video",
    onProgress: params.onProgress,
    createProgressMessage: "Đang gửi request tạo video lên Flow2...",
    createdProgressMessage: () => "",
    retryProgressMessage: (attempt) => `Flow2 gặp lỗi tạm thời, đang retry lần ${attempt}...`,
    runOnce: async () => {
      const created = await createApiMediaFlow2VideoRequest(params);
      await safeProgress(
        params.onProgress,
        55,
        `Đã tạo request Flow2 (${created.requestId}), đang chờ kết quả...`
      );
      const videos = await waitForFlow2VideoResult({
        requestId: created.requestId,
        onProgress: params.onProgress,
      });
      return { requestId: created.requestId, video: videos[0] };
    },
  });
  return result;
}

export function buildApiMediaFlow2VideoParams(
  payload: ApiMediaVideoRequest
): CreateApiMediaFlow2VideoParams {
  return {
    prompt: payload.prompt,
    aspectRatio: payload.config?.aspectRatio,
    videoQuality: payload.config?.videoQuality,
    videoDurationS: payload.config?.videoDurationS,
    imageInputs: payload.images,
    videoInputs: payload.videos,
    videoMode: payload.video_mode as Flow2VideoMode | undefined,
  };
}

export async function runApiMediaVideoFlow2(
  payload: ApiMediaVideoRequest,
  options: {
    customerId: string;
    onProgress?: (progress: number, message?: string) => void | Promise<void>;
    logPrefix?: string;
  }
): Promise<{ videoUri: string; mimeType: string; flow2RequestId: string }> {
  const { customerId, onProgress, logPrefix = "api-media-video" } = options;
  const flow2Params = buildApiMediaFlow2VideoParams(payload);
  const imageCount = flow2Params.imageInputs?.length ?? 0;
  const videoCount = flow2Params.videoInputs?.length ?? 0;

  await safeProgress(onProgress, 20, "Đang chuẩn hoá media tham chiếu...");
  logger.info(
    `[${logPrefix}] Flow2 video (user ${customerId}, mode=${flow2Params.videoMode ?? "text"}, images=${imageCount}, videos=${videoCount}, quality=${flow2Params.videoQuality})`
  );

  const { requestId, video } = await generateApiMediaVideoWithFlow2({
    ...flow2Params,
    onProgress,
  });

  logger.info(`[${logPrefix}] Flow2 request ${requestId} hoàn tất (user ${customerId})`);
  await safeProgress(onProgress, 95, "Đang hoàn tất dữ liệu video...");

  return {
    videoUri: video.videoUri,
    mimeType: video.mimeType,
    flow2RequestId: requestId,
  };
}
