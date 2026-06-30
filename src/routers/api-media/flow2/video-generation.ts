import logger from "../../../helpers/logger";
import {
  buildFlow2DerivedVideoUrl,
  collectFlow2VideoUrls,
  createFlow2Request,
  Flow2StatusResponse,
  formatFlow2StatusResponseForLog,
  getFlow2Config,
  isHttpUrl,
  looksLikeRawBase64,
  normalizeFlow2MediaUrl,
  pickFlow2RequestId,
  pickFlow2ResultPayload,
  runFlow2WithRetry,
  safeProgress,
  waitForFlow2Result,
} from "./_shared";
import { Flow2ImageInput, normalizeImageToDataUrl } from "./image-generation";
import {
  Flow2VideoMode,
  resolveFlow2VideoMode,
} from "./video-mode";

export type { Flow2VideoMode } from "./video-mode";
export {
  FLOW2_VIDEO_MODE,
  normalizeFlow2VideoMode,
  resolveFlow2VideoMode,
  mapServiceImageTypeToFlow2VideoMode,
} from "./video-mode";

export type Flow2VideoQuality = "lite_relaxed" | string;

export type Flow2CreateVideoRequestParams = {
  prompt: string;
  /**
   * Ảnh đầu vào:
   * - 0 ảnh → `gen_text_video`
   * - 1–3 ảnh → `gen_image_video` kèm `videoMode`
   */
  imageInputs?: Flow2ImageInput[];
  aspectRatio?: "16:9" | "9:16";
  videoQuality?: Flow2VideoQuality;
  /**
   * Chế độ ảnh trên Flow2 (`video_mode`):
   * - `frame` — prompt-only, startImage (1 ảnh) hoặc startImage + endImage (2 ảnh)
   * - `component` — Reference (1–3 ảnh)
   */
  videoMode?: Flow2VideoMode;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  onRequestCreated?: (requestId: string) => void | Promise<void>;
};

export type GeneratedVideo = {
  videoUri: string;
  mimeType: string;
};

const DEFAULT_VIDEO_QUALITY: Flow2VideoQuality = "lite_relaxed";
const MAX_FLOW2_VIDEO_IMAGES = 3;

function looksLikeVideoUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes(".mov") ||
    lower.includes("/video") ||
    lower.includes("video") ||
    lower.includes("flow-content.google") ||
    lower.includes("googleusercontent.com") ||
    lower.includes("storage.googleapis.com") ||
    lower.includes("fife")
  );
}

function looksLikeRawBase64Video(value: string): boolean {
  return looksLikeRawBase64(value, 256);
}

function collectVideoLikeStrings(value: unknown, out: string[], forceDive = false): void {
  const tryCollect = (input: string) => {
    const trimmed = input.trim();
    if (
      trimmed.startsWith("data:video/") ||
      isHttpUrl(trimmed) ||
      looksLikeVideoUrl(trimmed) ||
      looksLikeRawBase64Video(trimmed)
    ) {
      out.push(trimmed);
    }
  };

  if (typeof value === "string") {
    tryCollect(value);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectVideoLikeStrings(item, out, forceDive);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const candidateKeys = [
    "video",
    "videos",
    "videoUri",
    "video_uri",
    "videoUrl",
    "video_url",
    "videoBytes",
    "video_bytes",
    "videoBase64",
    "video_base64",
    "file_url",
    "fileUrl",
    "url",
    "urls",
    "uri",
    "fifeUrl",
    "fife_url",
    "downloadUri",
    "download_uri",
    "media",
    "mediaContent",
    "artifact",
    "artifacts",
    "content",
    "payload",
    "response",
    "body",
    "output",
    "outputs",
    "result",
    "results",
    "data",
  ];

  for (const [key, val] of Object.entries(record)) {
    const shouldDive =
      forceDive ||
      candidateKeys.includes(key) ||
      key.toLowerCase().includes("video") ||
      key.toLowerCase().includes("file") ||
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("uri") ||
      key.toLowerCase().includes("media") ||
      key.toLowerCase().includes("fife") ||
      key.toLowerCase().includes("result") ||
      key.toLowerCase().includes("output");

    if (!shouldDive) continue;

    if (typeof val === "string") {
      tryCollect(val);
      continue;
    }

    collectVideoLikeStrings(val, out, true);
  }
}

async function normalizeResultVideo(value: string): Promise<GeneratedVideo> {
  if (value.startsWith("data:video/")) {
    const mimeMatch = value.match(/^data:(video\/[^;]+);base64,/i);
    return { videoUri: value, mimeType: mimeMatch?.[1] || "video/mp4" };
  }
  if (isHttpUrl(value)) {
    return { videoUri: value, mimeType: "video/mp4" };
  }
  if (looksLikeRawBase64Video(value)) {
    return { videoUri: `data:video/mp4;base64,${value.replace(/\s/g, "")}`, mimeType: "video/mp4" };
  }
  throw new Error("Không nhận diện được định dạng video từ Flow2");
}

export async function extractFlow2Videos(
  statusData: Flow2StatusResponse
): Promise<GeneratedVideo[]> {
  const requestId = pickFlow2RequestId(statusData);
  const resultPayload = pickFlow2ResultPayload(statusData);
  if (resultPayload) {
    const structuredUrls = collectFlow2VideoUrls(resultPayload);
    if (structuredUrls.length > 0) {
      const normalizedUrls = structuredUrls.map(normalizeFlow2MediaUrl);
      logger.info(
        `[flow2-video] Trích video_urls từ result requestId=${requestId ?? "n/a"} urls=${normalizedUrls.length}`
      );
      return normalizedUrls.map((url) => ({ videoUri: url, mimeType: "video/mp4" }));
    }

    const canDeriveVideoUrl =
      requestId &&
      (resultPayload.poll_mode === "media" || resultPayload.poll_mode === "get_media_fallback");

    if (canDeriveVideoUrl) {
      const { baseUrl } = await getFlow2Config();
      const derivedUrl = buildFlow2DerivedVideoUrl(baseUrl, requestId);
      logger.info(
        `[flow2-video] poll_mode=${resultPayload.poll_mode}, derive video URL requestId=${requestId} media_ids=${JSON.stringify(
          resultPayload.media_ids ?? []
        )} url=${derivedUrl}`
      );
      return [{ videoUri: derivedUrl, mimeType: "video/mp4" }];
    }
  }

  const found: string[] = [];
  collectVideoLikeStrings(statusData, found);
  const deduped = Array.from(new Set(found)).slice(0, 3);
  if (deduped.length === 0) {
    logger.warn(
      `[flow2-video] Không trích được video requestId=${requestId ?? "n/a"} poll_mode=${
        resultPayload?.poll_mode ?? "n/a"
      } media_ids=${JSON.stringify(resultPayload?.media_ids ?? [])} fullResponse=${formatFlow2StatusResponseForLog(
        statusData
      )}`
    );
    return [];
  }
  return Promise.all(deduped.map(normalizeResultVideo));
}

export async function createFlow2VideoRequest(
  params: Flow2CreateVideoRequestParams
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const imageInputs = (params.imageInputs || []).slice(0, MAX_FLOW2_VIDEO_IMAGES);
  const aspect_ratio = params.aspectRatio || "16:9";
  const video_quality = params.videoQuality || DEFAULT_VIDEO_QUALITY;

  // Text-to-video — không cần ảnh, không có video_mode
  if (imageInputs.length === 0) {
    return createFlow2Request({
      type: "gen_text_video",
      params: {
        prompt: params.prompt,
        aspect_ratio,
        video_quality,
      },
    });
  }

  // Image-to-video — bắt buộc có video_mode (frame | component)
  const video_mode =
    params.videoMode ??
    resolveFlow2VideoMode({
      imageCount: imageInputs.length,
    });

  if (!video_mode) {
    throw new Error("Thiếu video_mode khi tạo video có ảnh tham chiếu");
  }

  const image_base64s = await Promise.all(imageInputs.map(normalizeImageToDataUrl));

  return createFlow2Request({
    type: "gen_image_video",
    params: {
      prompt: params.prompt,
      aspect_ratio,
      image_base64s,
      video_mode,
      video_quality,
    },
  });
}

export async function waitForFlow2VideoResult(params: {
  requestId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
}): Promise<GeneratedVideo[]> {
  return waitForFlow2Result({
    requestId: params.requestId,
    timeoutMs: params.timeoutMs ?? 900_000,
    pollIntervalMs: params.pollIntervalMs,
    onProgress: params.onProgress,
    extract: extractFlow2Videos,
    emptyResultMessage: "Flow2 hoàn tất nhưng không có video đầu ra",
    waitingProgressMessage: "Đang chờ Flow2 xử lý video...",
    doneProgressMessage: "Flow2 đã tạo video xong, đang xử lý kết quả...",
    logTag: "video",
  });
}

export async function generateVideoWithFlow2(
  params: Flow2CreateVideoRequestParams
): Promise<{ requestId: string; video: GeneratedVideo }> {
  const result = await runFlow2WithRetry({
    logTag: "video",
    onProgress: params.onProgress,
    createProgressMessage: "Đang gửi request tạo video lên Flow2...",
    createdProgressMessage: () => "",
    retryProgressMessage: (attempt) => `Flow2 gặp lỗi tạm thời, đang retry lần ${attempt}...`,
    runOnce: async () => {
      const created = await createFlow2VideoRequest(params);
      await params.onRequestCreated?.(created.requestId);
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
