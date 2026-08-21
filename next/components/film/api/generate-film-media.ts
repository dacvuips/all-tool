/**
 * Client API Film: enqueue generate image/video qua job queue riêng
 * (`FILM_GENERATION_IMAGE` / `FILM_GENERATION_VIDEO`).
 *
 * Dùng chung useMediaGenerationJob pattern (REST enqueue → poll/sub job).
 */
import { MediaGenerationJobService } from "../../../lib/repo/media-generation-job/media-generation-job.repo";
import {
  isStreamLimitHttpStatus,
  MAX_STREAM_ENQUEUE_ATTEMPTS,
  parseRetryAfterMs,
  STREAM_ENQUEUE_MAX_WAIT_MS,
  waitBeforeStreamEnqueueRetry,
} from "../../../lib/media/enqueue-stream-backoff";
import { getOrCreateBlobPreviewUrl } from "../../app/affiliate-video/shared/generatedMediaUtils";
import {
  base64ToBlob,
  dataUrlToBlob,
  toDownloadProxyUrl,
  uriToBlob,
} from "../../app/affiliate-video/shared/videoDownloadUtils";
import type { FilmSceneRecord } from "../film-types";

export type FilmMediaAssetKind =
  | "character"
  | "prop"
  | "scene_location"
  | "shot_frame"
  | "shot_video";

export type FilmMediaImageRef = string | { imageBytes: string; mimeType?: string };

export type FilmGenerateImageParams = {
  prompt: string;
  images?: FilmMediaImageRef[];
  aspectRatio?: "16:9" | "9:16";
  numberOfImages?: number;
  imageModel?: string;
  noText?: boolean;
  filmProjectId?: string;
  filmEpisodeId?: string;
  filmSceneId?: string;
  filmCharacterId?: string;
  filmPropId?: string;
  filmSceneImageId?: string;
  filmAssetKind?: FilmMediaAssetKind;
  onProgress?: (progress: number, message?: string) => void;
};

export type FilmGenerateVideoParams = {
  prompt: string;
  images?: FilmMediaImageRef[];
  aspectRatio?: "16:9" | "9:16";
  videoMode?: string;
  serviceImageType?: string;
  generateAudio?: boolean;
  /**
   * Giọng Flow2 (vd. achernar). Backend chỉ gắn khi videoMode=component và có ≥1 ảnh.
   */
  voice?: string;
  noText?: boolean;
  filmProjectId?: string;
  filmEpisodeId?: string;
  filmSceneId?: string;
  filmAssetKind?: FilmMediaAssetKind;
  onProgress?: (progress: number, message?: string) => void;
};

export type FilmGeneratedImage = {
  imageBytes?: string;
  mimeType?: string;
  fifeUrl?: string;
  imageUrl?: string;
  mediaId?: string;
};

export type FilmGenerateImageResult = {
  jobId: string;
  type: "FILM_GENERATION_IMAGE";
  images: FilmGeneratedImage[];
};

export type FilmGenerateVideoResult = {
  jobId: string;
  type: "FILM_GENERATION_VIDEO";
  videoUri?: string | null;
  mimeType?: string;
  videoUris?: string[];
};

const POLL_MS = 2500;
const MAX_WAIT_MS = 15 * 60 * 1000;
/** Job đã xóa khỏi Mongo (SUCCEEDED/cleanup) — không poll vô hạn, UI sẽ thoát trạng thái 0%. */
const JOB_MISSING_POLL_THRESHOLD = 3;

/** Job đang poll trên client (module-level) — đổi tab / đóng dialog không mất track. */
const inflightWait = new Map<string, Promise<unknown>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickApiErrorMessage(body: any, status: number, fallback: string): string {
  const msg =
    (typeof body?.message === "string" && body.message.trim()) ||
    (typeof body?.error === "string" && body.error.trim()) ||
    (typeof body?.error?.message === "string" && body.error.message.trim()) ||
    "";
  if (msg) return msg;
  if (status === 429) {
    return "Đã đạt giới hạn luồng tạo media. Đang chờ slot trống…";
  }
  return `${fallback} (${status})`;
}

/** POST enqueue; tự retry khi 429 (chờ luồng ảnh/video, global backoff). */
async function postFilmEnqueue(
  url: string,
  payload: Record<string, unknown>,
  failLabel: string
): Promise<{ jobId: string }> {
  const started = Date.now();
  let lastMessage = failLabel;
  let attempt = 0;

  while (Date.now() - started < STREAM_ENQUEUE_MAX_WAIT_MS) {
    if (attempt >= MAX_STREAM_ENQUEUE_ATTEMPTS) {
      break;
    }

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({} as any));

    if (res.ok) {
      const jobId = String(body?.jobId || "");
      if (!jobId) throw new Error("Backend không trả jobId");
      return { jobId };
    }

    lastMessage = pickApiErrorMessage(body, res.status, failLabel);

    if (isStreamLimitHttpStatus(res.status, lastMessage)) {
      await waitBeforeStreamEnqueueRetry(attempt++, {
        retryAfterMs: parseRetryAfterMs(res),
      });
      continue;
    }

    throw new Error(lastMessage);
  }

  throw new Error(
    lastMessage ||
      "Hết thời gian chờ slot tạo media. Thử lại khi job hiện tại xong."
  );
}

/** Poll job đến SUCCEEDED/FAILED. Cùng jobId chỉ 1 waiter (resume an toàn). */
export function waitFilmMediaJob<T>(
  jobId: string,
  onProgress?: (progress: number, message?: string) => void
): Promise<T> {
  const existing = inflightWait.get(jobId);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    const started = Date.now();
    let lastProgress = -1;
    let missingPollCount = 0;

    while (Date.now() - started < MAX_WAIT_MS) {
      const job = await MediaGenerationJobService.getJob<T>(jobId);
      if (!job) {
        missingPollCount += 1;
        if (missingPollCount >= JOB_MISSING_POLL_THRESHOLD) {
          throw new Error(
            "Job không còn trên server (đã xong hoặc hết hạn). Vui lòng tạo lại."
          );
        }
        await sleep(POLL_MS);
        continue;
      }
      missingPollCount = 0;

      if (typeof job.progress === "number" && job.progress >= lastProgress) {
        lastProgress = job.progress;
        onProgress?.(job.progress, job.message ?? undefined);
      }

      if (job.status === "SUCCEEDED") {
        return (job.resultData as T) ?? ({} as T);
      }
      if (job.status === "FAILED") {
        throw new Error(job.errorMessage || "Job film thất bại");
      }
      if (job.status === "CANCELLED") {
        throw new Error("Đã dừng");
      }
      await sleep(POLL_MS);
    }
    throw new Error("Job film hết thời gian chờ");
  })().finally(() => {
    inflightWait.delete(jobId);
  });

  inflightWait.set(jobId, p);
  return p;
}

export function isFilmMediaJobWatching(jobId: string): boolean {
  return inflightWait.has(jobId);
}

/** Huỷ job film (nút Dừng) — worker dừng ở milestone kế; waiter nhận CANCELLED. */
export async function cancelFilmMediaJob(jobId: string): Promise<void> {
  const id = String(jobId || "").trim();
  if (!id) return;
  await MediaGenerationJobService.cancelJob(id);
}

/** Chỉ enqueue — trả jobId để UI đóng sớm / persist IDB; poll ở `waitFilmMediaJob`. */
export async function enqueueFilmImage(
  params: Omit<FilmGenerateImageParams, "onProgress">
): Promise<{ jobId: string }> {
  const prompt = String(params.prompt || "").trim();
  if (!prompt) throw new Error("Thiếu prompt");

  return postFilmEnqueue(
    "/api/app/film/generate-image/",
    {
      prompt,
      images: params.images,
      aspectRatio: params.aspectRatio || "16:9",
      numberOfImages: params.numberOfImages || 1,
      imageModel: params.imageModel,
      noText: params.noText === true,
      filmProjectId: params.filmProjectId,
      filmEpisodeId: params.filmEpisodeId,
      filmSceneId: params.filmSceneId,
      filmCharacterId: params.filmCharacterId,
      filmPropId: params.filmPropId,
      filmSceneImageId: params.filmSceneImageId,
      filmAssetKind: params.filmAssetKind || "character",
      _metadata: {
        module: "film",
        filmAssetKind: params.filmAssetKind || "character",
      },
    },
    "Enqueue film image thất bại"
  );
}

/** Chỉ enqueue video job. */
export async function enqueueFilmVideo(
  params: Omit<FilmGenerateVideoParams, "onProgress">
): Promise<{ jobId: string }> {
  const prompt = String(params.prompt || "").trim();
  if (!prompt) throw new Error("Thiếu prompt");

  return postFilmEnqueue(
    "/api/app/film/generate-video/",
    {
      prompt,
      images: params.images,
      aspectRatio: params.aspectRatio || "9:16",
      videoMode: params.videoMode,
      serviceImageType: params.serviceImageType,
      generateAudio: params.generateAudio,
      voice: params.voice,
      noText: params.noText === true,
      filmProjectId: params.filmProjectId,
      filmEpisodeId: params.filmEpisodeId,
      filmSceneId: params.filmSceneId,
      filmAssetKind: params.filmAssetKind || "shot_video",
      _metadata: {
        module: "film",
        filmAssetKind: params.filmAssetKind || "shot_video",
      },
    },
    "Enqueue film video thất bại"
  );
}

/** Enqueue + đợi job FILM_GENERATION_IMAGE (blocking — dùng khi cần result ngay). */
export async function generateFilmImage(
  params: FilmGenerateImageParams
): Promise<FilmGenerateImageResult> {
  const { jobId } = await enqueueFilmImage(params);
  params.onProgress?.(5, "Đã enqueue job film image...");

  const resultData = await waitFilmMediaJob<{ images?: FilmGeneratedImage[] }>(
    jobId,
    params.onProgress
  );
  const images = Array.isArray(resultData?.images) ? resultData.images : [];
  if (!images.length) throw new Error("Job film không trả về ảnh");

  return { jobId, type: "FILM_GENERATION_IMAGE", images };
}

/** Enqueue + đợi job FILM_GENERATION_VIDEO */
export async function generateFilmVideo(
  params: FilmGenerateVideoParams
): Promise<FilmGenerateVideoResult> {
  const { jobId } = await enqueueFilmVideo(params);
  params.onProgress?.(5, "Đã enqueue job film video...");

  const resultData = await waitFilmMediaJob<{
    videoUri?: string | null;
    mimeType?: string;
    videoUris?: string[];
  }>(jobId, params.onProgress);

  const videoUri = resultData?.videoUri || resultData?.videoUris?.[0] || null;
  if (!videoUri) throw new Error("Job film không trả về video");

  return {
    jobId,
    type: "FILM_GENERATION_VIDEO",
    videoUri,
    mimeType: resultData?.mimeType || "video/mp4",
    videoUris: resultData?.videoUris,
  };
}

/** Lấy URL hiển thị từ kết quả generate image (raw, chưa normalize). */
export function pickFilmImageDisplayUrl(img: FilmGeneratedImage | undefined): string {
  if (!img) return "";
  if (img.imageUrl?.trim()) return img.imageUrl.trim();
  if (img.fifeUrl?.trim()) return img.fifeUrl.trim();
  if (img.imageBytes?.trim()) {
    const mime = img.mimeType || "image/png";
    const payload = stripBase64Payload(img.imageBytes);
    if (!payload) return "";
    return `data:${mime};base64,${payload}`;
  }
  return "";
}

function stripBase64Payload(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // data:image/...;base64,XXXX
  const dataMatch = trimmed.match(/^data:[^;]+;base64,([\s\S]+)$/i);
  if (dataMatch) return dataMatch[1].replace(/\s/g, "");
  // một số response đã là raw base64
  return trimmed.replace(/\s/g, "");
}

/** URL HTTP Flow2 → download-proxy inline; data/base64/blob giữ nguyên. */
export function normalizeFilmImageSrc(src: string | undefined | null): string {
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return toDownloadProxyUrl(s, true);
  // raw base64 (không prefix)
  if (s.length > 64 && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 80))) {
    return `data:image/jpeg;base64,${s.replace(/\s/g, "")}`;
  }
  return s;
}

/** Lấy mảng images từ resultData job (nhiều shape GraphQL/backend). */
export function extractFilmImagesFromJobResult(resultData: unknown): FilmGeneratedImage[] {
  if (!resultData || typeof resultData !== "object") return [];
  const r = resultData as Record<string, unknown>;

  if (Array.isArray(r.images)) {
    return r.images
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          if (item.startsWith("data:") || item.startsWith("http")) {
            return item.startsWith("http")
              ? { imageUrl: item, fifeUrl: item }
              : { imageBytes: item };
          }
          return { imageBytes: item };
        }
        if (typeof item === "object") {
          return item as FilmGeneratedImage;
        }
        return null;
      })
      .filter(Boolean) as FilmGeneratedImage[];
  }

  // resultData bản thân là 1 ảnh
  if (r.imageBytes || r.imageUrl || r.fifeUrl) {
    return [r as FilmGeneratedImage];
  }
  return [];
}

export type FilmStoredImage = {
  /** URL persist (proxy/http hoặc data:) — backup khi không có blob */
  imageUrl: string;
  /** Binary local — ưu tiên hiển thị (tránh CORS / URL hết hạn) */
  imageBlob?: Blob;
};

function normalizeFilmCleanMime(mime?: string): string {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpg") return "image/jpeg";
  if (m.startsWith("image/")) return m;
  return "image/png";
}

async function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Không đọc được ảnh gốc"));
    reader.readAsDataURL(blob);
  });
}

async function resolveFilmStoredImageBlob(
  stored: FilmStoredImage
): Promise<{ blob: Blob; mime: string }> {
  if (stored.imageBlob instanceof Blob && stored.imageBlob.size > 0) {
    return {
      blob: stored.imageBlob,
      mime: normalizeFilmCleanMime(stored.imageBlob.type),
    };
  }
  const url = String(stored.imageUrl || "").trim();
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    if (blob.size > 0) {
      return { blob, mime: normalizeFilmCleanMime(blob.type) };
    }
  }
  if (url) {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        return { blob, mime: normalizeFilmCleanMime(blob.type) };
      }
    }
  }
  throw new Error("Không có dữ liệu ảnh gốc để xóa watermark");
}

/**
 * Gửi ảnh generate gốc → /api/app/clean-watermark/ rồi trả blob đã xóa logo.
 */
async function cleanFilmGeneratedImageWatermark(
  stored: FilmStoredImage
): Promise<FilmStoredImage> {
  const { blob, mime } = await resolveFilmStoredImageBlob(stored);
  const payload = await blobToBase64Payload(blob);
  if (!payload) throw new Error("Không encode được ảnh gốc");

  const resp = await fetch("/api/app/clean-watermark/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          clientId: "film-image",
          kind: "image",
          mediaBase64: `data:${mime};base64,${payload}`,
          mimeType: mime,
          name: "film-generated",
        },
      ],
      returnMode: "both",
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as {
    message?: string;
    processed?: Array<{ mediaBase64?: string; mimeType?: string }>;
    skipped?: Array<{ reason?: string }>;
  };

  const processed = Array.isArray(data.processed) ? data.processed[0] : undefined;
  const cleanedRaw = String(processed?.mediaBase64 || "").trim();
  if (!resp.ok || !cleanedRaw) {
    const skippedReason = data.skipped?.[0]?.reason;
    throw new Error(
      skippedReason || data.message || `Xóa watermark thất bại (${resp.status})`
    );
  }

  const cleanedMime = normalizeFilmCleanMime(processed?.mimeType || mime);
  const cleanedPayload = stripBase64Payload(cleanedRaw);
  const cleanedBlob = base64ToBlob(cleanedPayload, cleanedMime);
  if (!cleanedBlob.size) throw new Error("Ảnh sau khi xóa watermark rỗng");

  return {
    imageUrl: `data:${cleanedMime};base64,${cleanedPayload}`,
    imageBlob: cleanedBlob,
  };
}

async function materializeFilmImageOriginalFromJobResult(
  resultData: unknown
): Promise<FilmStoredImage> {
  const images = extractFilmImagesFromJobResult(resultData);
  const img = images[0];
  if (!img) throw new Error("Job film không trả về ảnh");

  // 1) imageBytes → Blob
  if (img.imageBytes?.trim()) {
    const mime = img.mimeType || "image/png";
    const payload = stripBase64Payload(img.imageBytes);
    if (!payload) throw new Error("Ảnh base64 rỗng");
    try {
      const blob = base64ToBlob(payload, mime);
      if (blob.size > 0) {
        return {
          imageUrl: `data:${mime};base64,${payload}`,
          imageBlob: blob,
        };
      }
    } catch (err) {
      console.warn("[film] base64→Blob fail, fallback data URL", err);
      return { imageUrl: `data:${mime};base64,${payload}` };
    }
  }

  // 2) Remote URL → proxy + thử tải blob
  const remote = (img.imageUrl || img.fifeUrl || "").trim();
  if (remote) {
    const proxied = toDownloadProxyUrl(remote, true);
    try {
      const res = await fetch(proxied, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) {
          return { imageUrl: proxied, imageBlob: blob };
        }
      }
    } catch (err) {
      console.warn("[film] fetch proxy image fail, dùng URL proxy", err);
    }
    return { imageUrl: proxied };
  }

  throw new Error("Không lấy được URL ảnh");
}

/**
 * Materialize ảnh job → xóa watermark → lưu IDB + render blob đã clean.
 */
export async function materializeFilmImageFromJobResult(
  resultData: unknown
): Promise<FilmStoredImage> {
  const original = await materializeFilmImageOriginalFromJobResult(resultData);
  return cleanFilmGeneratedImageWatermark(original);
}

/** Src hiển thị từ entity film (blob → object URL, else normalize URL). */
export function getFilmEntityImageSrc(entity: {
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
}): string {
  if (entity.imageBlob instanceof Blob && entity.imageBlob.size > 0) {
    return getOrCreateBlobPreviewUrl(entity.imageBlob);
  }
  const urls = (entity.imageUrls || []).filter((u) => !!u && String(u).trim());
  if (!urls.length && entity.imageUrl?.trim()) urls.push(entity.imageUrl.trim());
  for (const u of urls) {
    const n = normalizeFilmImageSrc(u);
    if (n) return n;
  }
  return "";
}

/** Legacy sync pick — giữ cho chỗ còn gọi; ưu tiên materialize async khi lưu. */
export function pickFilmImageDisplayUrlLegacy(img: FilmGeneratedImage | undefined): string {
  return normalizeFilmImageSrc(pickFilmImageDisplayUrl(img));
}

/** URL video từ job result (proxy HTTP; giữ blob/data). */
export function normalizeFilmVideoUrl(uri: string | undefined | null): string {
  const s = String(uri || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  // HTTP gốc hoặc đã proxy (có thể dính &amp;) → luôn normalize + inline
  if (/^https?:\/\//i.test(s) || s.includes("/api/file/download-proxy")) {
    return toDownloadProxyUrl(s, true);
  }
  return s;
}

/** Lấy URL video hiển thị từ resultData job film. */
export function extractFilmVideoUrlFromJobResult(resultData: unknown): string {
  if (!resultData || typeof resultData !== "object") return "";
  const r = resultData as Record<string, unknown>;
  const direct = String(r.videoUri || "").trim();
  if (direct) return normalizeFilmVideoUrl(direct);
  if (Array.isArray(r.videoUris)) {
    for (const u of r.videoUris) {
      const s = String(u || "").trim();
      if (s) return normalizeFilmVideoUrl(s);
    }
  }
  return "";
}

export type FilmStoredVideo = {
  /** URL persist (proxy/http hoặc data/blob) */
  videoUrl: string;
  /** Binary local — ưu tiên preview / Studio / export */
  videoBlob?: Blob;
};

/**
 * Materialize video job → tải blob về client (giống ảnh).
 * Giữ videoUrl proxy làm backup nếu fetch blob thất bại.
 */
export async function materializeFilmVideoFromJobResult(
  resultData: unknown
): Promise<FilmStoredVideo> {
  if (!resultData || typeof resultData !== "object") {
    throw new Error("Job film không trả về video");
  }
  const r = resultData as Record<string, unknown>;

  // 1) videoBytes base64 (nếu job trả)
  const bytesRaw = String(r.videoBytes || "").trim();
  if (bytesRaw) {
    const mime = String(r.mimeType || "video/mp4").trim() || "video/mp4";
    const payload = stripBase64Payload(bytesRaw);
    if (payload) {
      try {
        const blob = base64ToBlob(payload, mime);
        if (blob.size > 0) {
          return {
            videoUrl: `data:${mime};base64,${payload}`,
            videoBlob: blob,
          };
        }
      } catch (err) {
        console.warn("[film] video base64→Blob fail", err);
      }
    }
  }

  // 2) Remote / proxy URL → fetch blob
  const videoUrl = extractFilmVideoUrlFromJobResult(resultData);
  if (!videoUrl) throw new Error("Job film không trả về video");

  if (videoUrl.startsWith("data:")) {
    try {
      const blob = dataUrlToBlob(videoUrl);
      if (blob.size > 0) return { videoUrl, videoBlob: blob };
    } catch (err) {
      console.warn("[film] video dataURL→Blob fail", err);
    }
    return { videoUrl };
  }

  if (videoUrl.startsWith("blob:")) {
    try {
      const res = await fetch(videoUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return { videoUrl, videoBlob: blob };
      }
    } catch (err) {
      console.warn("[film] video blob URL fetch fail", err);
    }
    return { videoUrl };
  }

  try {
    const res = await fetch(videoUrl, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        return { videoUrl, videoBlob: blob };
      }
    }
  } catch (err) {
    console.warn("[film] fetch proxy video fail, dùng URL proxy", err);
  }
  return { videoUrl };
}

/** Src hiển thị video scene (blob → object URL, else normalize URL). */
export function getFilmEntityVideoSrc(entity: {
  videoBlob?: Blob | null;
  videoUrl?: string | null;
}): string {
  if (entity.videoBlob instanceof Blob && entity.videoBlob.size > 0) {
    return getOrCreateBlobPreviewUrl(entity.videoBlob);
  }
  return normalizeFilmVideoUrl(entity.videoUrl);
}

/**
 * Tải lại blob video từ URL (proxy) cho từng scene — dùng nút Làm lại Studio.
 * Giữ blob cũ nếu fetch thất bại.
 */
export async function rematerializeFilmSceneVideos(
  scenes: FilmSceneRecord[],
  options?: {
    onProgress?: (done: number, total: number) => void;
  }
): Promise<FilmSceneRecord[]> {
  const list = scenes || [];
  const out: FilmSceneRecord[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const scene = list[i];
    const url = normalizeFilmVideoUrl(scene.videoUrl);
    if (!url) {
      out.push(scene);
      options?.onProgress?.(i + 1, list.length);
      continue;
    }
    // blob: session-local — không fetch lại remote
    if (url.startsWith("blob:")) {
      out.push(scene);
      options?.onProgress?.(i + 1, list.length);
      continue;
    }
    try {
      const blob = await uriToBlob(url);
      if (blob && blob.size > 0) {
        out.push({
          ...scene,
          videoUrl: url,
          videoBlob: blob,
          updatedAt: new Date().toISOString(),
        });
      } else {
        out.push(scene);
      }
    } catch (err) {
      console.warn("[film] rematerialize video fail", scene.id, err);
      out.push(scene);
    }
    options?.onProgress?.(i + 1, list.length);
  }
  return out;
}
