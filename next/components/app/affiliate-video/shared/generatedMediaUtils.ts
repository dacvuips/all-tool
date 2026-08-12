import { requestCleanWatermark } from "../remove-logo/hook/cleanWatermarkClient";
import { base64ToBlob as watermarkBase64ToBlob, stripToPureBase64 } from "../remove-logo/constants";
import { notifyGeneratedMediaReplaced } from "./generatedMediaReplaceBus";
import { base64ToBlob, toDownloadProxyUrl, triggerBlobDownload, uriToBlob } from "./videoDownloadUtils";

/** Metadata Flow2 lưu sau gen_image — dùng upscale 4K. */
export type Flow2ImageMeta = {
  flow2RequestId?: string;
  mediaId?: string;
  projectId?: string;
  profileId?: string;
};

/**
 * Shape tối thiểu của ảnh generate.
 * - IDB: ưu tiên `mediaBlob` (URL hết hạn → enrich binary local)
 * - React UI: `previewUrl` (blob:) + metadata; không giữ chuỗi base64 lớn
 * - `imageBytes`: legacy / input upload — convert sang mediaBlob rồi xoá khỏi state
 */
export type GeneratedImageLike = {
  imageBytes?: string;
  /** Binary local (IndexedDB + state) — thay base64 để tránh phình heap/DOM */
  mediaBlob?: Blob;
  /** Object URL hoặc remote URL để preview — không persist blob: */
  previewUrl?: string;
  mimeType?: string;
  fifeUrl?: string;
  imageUrl?: string;
} & Flow2ImageMeta;

/** Metadata Flow2 lưu sau gen_video — dùng upscale 1080p. */
export type Flow2VideoMeta = {
  flow2RequestId?: string;
};

/** Shape tối thiểu của video generate — URI / Blob local / legacy base64. */
export type GeneratedVideoLike = {
  videoUri?: string | null;
  videoBytes?: string | null;
  mediaBlob?: Blob;
  previewUrl?: string;
  mimeType?: string;
  aspectRatio?: string;
} & Flow2VideoMeta;

/** Cache Object URL theo Blob — tránh tạo lại mỗi lần render. */
const blobPreviewUrlCache = new WeakMap<Blob, string>();

export function getOrCreateBlobPreviewUrl(blob: Blob): string {
  const cached = blobPreviewUrlCache.get(blob);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  blobPreviewUrlCache.set(blob, url);
  return url;
}

function revokeBlobPreviewUrl(url?: string | null) {
  if (url?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

/** Độ phân giải tải video: 720p (gốc) hoặc 1080p (upsample Flow2). */
export type VideoDownloadResolution = "720p" | "1080p";

/** Độ phân giải tải ảnh: 1K (gốc), 2K hoặc 4K (upsample Flow2). */
export type AutoDownloadImageResolution = "1K" | "2K" | "4K";

export type MediaPersistStorage<T> = {
  set: (key: string, value: T) => Promise<void>;
};

export function getGeneratedImageUrl(img: GeneratedImageLike): string {
  return (img.imageUrl || img.fifeUrl || "").trim();
}

export function hasStoredGeneratedImageBinary(
  img: GeneratedImageLike | null | undefined
): boolean {
  if (!img) return false;
  if (img.mediaBlob) return true;
  return !!(img.imageBytes || "").trim();
}

export function hasGeneratedImageData(img: GeneratedImageLike | null | undefined): boolean {
  return !!(
    img &&
    (img.mediaBlob ||
      img.previewUrl ||
      (img.imageBytes || "").trim() ||
      getGeneratedImageUrl(img))
  );
}

/** Độ phân giải upscale qua Flow2. */
export type UpsampleResolution = "2K" | "4K";

/** Đủ metadata Flow2 để gọi upscale 2K/4K (request_id). */
export function hasFlow2Upsample2kMeta(img: GeneratedImageLike | null | undefined): boolean {
  return !!img?.flow2RequestId?.trim();
}

/** @deprecated Dùng hasFlow2Upsample2kMeta — 4K cũng chỉ cần flow2RequestId */
export function hasFlow2Upsample4kMeta(img: GeneratedImageLike | null | undefined): boolean {
  return hasFlow2Upsample2kMeta(img);
}

/** @deprecated Dùng hasFlow2Upsample4kMeta */
export function hasFlow2UpscaleMeta(img: GeneratedImageLike | null | undefined): boolean {
  return hasFlow2Upsample4kMeta(img);
}

export function hasFlow2UpsampleMeta(
  img: GeneratedImageLike | null | undefined,
  _resolution: UpsampleResolution
): boolean {
  return hasFlow2Upsample2kMeta(img);
}

/** Đủ metadata Flow2 để upscale video 1080p (request_id từ gen_video). */
export function hasFlow2Upsample1080pVideoMeta(
  video: GeneratedVideoLike | null | undefined
): boolean {
  return !!video?.flow2RequestId?.trim();
}

export function hasGeneratedVideoData(video: GeneratedVideoLike | null | undefined): boolean {
  return !!(
    video &&
    (video.mediaBlob ||
      video.previewUrl ||
      (video.videoBytes || "").trim() ||
      (video.videoUri || "").trim())
  );
}

/**
 * Preview ảnh: blob:/previewUrl → mediaBlob Object URL → remote URL → legacy data: (cuối).
 * Không ưu tiên data:base64 để tránh DOM/heap phình khi nhiều phân cảnh.
 */
export function getGeneratedImagePreviewSrc(img: GeneratedImageLike): string {
  if (img.mediaBlob) return getOrCreateBlobPreviewUrl(img.mediaBlob);
  if (img.previewUrl) return img.previewUrl;
  const remote = getGeneratedImageUrl(img);
  if (remote) return remote;
  if ((img.imageBytes || "").trim()) {
    return `data:${img.mimeType || "image/jpeg"};base64,${stripBase64Payload(img.imageBytes!)}`;
  }
  return "";
}

/**
 * Preview video: blob:/previewUrl → mediaBlob → proxy(HTTP) → legacy data:.
 */
export function getGeneratedVideoPreviewSrc(video: GeneratedVideoLike): string | null {
  if (video.mediaBlob) return getOrCreateBlobPreviewUrl(video.mediaBlob);
  if (video.previewUrl) return video.previewUrl;
  if ((video.videoBytes || "").trim()) {
    // Legacy — tránh khi đã hydrate; giữ để bản IDB cũ còn chạy
    return `data:${video.mimeType || "video/mp4"};base64,${stripBase64Payload(video.videoBytes!)}`;
  }
  const uri = (video.videoUri || "").trim();
  if (!uri) return null;
  if (uri.startsWith("blob:") || uri.startsWith("data:")) return uri;
  return toDownloadProxyUrl(uri, true);
}

function stripBase64Payload(value: string): string {
  const trimmed = value.trim();
  const dataMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/);
  return dataMatch ? dataMatch[1] : trimmed;
}

async function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Fetch URL / data URL → Blob (không qua base64 trung gian khi HTTP). */
export async function fetchUrlToBlob(
  url: string,
  fallbackMimeType: string
): Promise<Blob | null> {
  try {
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return base64ToBlob(dataMatch[2], dataMatch[1] || fallbackMimeType);
    }
    const blob = await uriToBlob(url);
    if (!blob) return null;
    if (blob.type) return blob;
    return new Blob([blob], { type: fallbackMimeType });
  } catch (err) {
    console.warn("[fetchUrlToBlob] Failed:", url, err);
    return null;
  }
}

/** Đưa imageBytes legacy → mediaBlob; giữ mediaBlob nếu đã có. */
export async function ensureGeneratedImageBinary<T extends GeneratedImageLike>(
  imageData: T
): Promise<T> {
  if (imageData.mediaBlob) {
    return { ...imageData, imageBytes: "" } as T;
  }
  const bytes = (imageData.imageBytes || "").trim();
  if (!bytes) return imageData;
  const mimeType = imageData.mimeType || "image/jpeg";
  return {
    ...imageData,
    mediaBlob: base64ToBlob(stripBase64Payload(bytes), mimeType),
    imageBytes: "",
    mimeType,
  } as T;
}

export async function ensureGeneratedVideoBinary<T extends GeneratedVideoLike>(
  videoData: T
): Promise<T> {
  if (videoData.mediaBlob) {
    return { ...videoData, videoBytes: null } as T;
  }
  const bytes = (videoData.videoBytes || "").trim();
  if (bytes) {
    const mimeType = videoData.mimeType || "video/mp4";
    return {
      ...videoData,
      mediaBlob: base64ToBlob(stripBase64Payload(bytes), mimeType),
      videoBytes: null,
      mimeType,
    } as T;
  }
  const uri = (videoData.videoUri || "").trim();
  if (uri.startsWith("data:")) {
    const blob = await fetchUrlToBlob(uri, videoData.mimeType || "video/mp4");
    if (!blob) return videoData;
    return {
      ...videoData,
      mediaBlob: blob,
      videoBytes: null,
      mimeType: blob.type || videoData.mimeType || "video/mp4",
    } as T;
  }
  return videoData;
}

/** Bản ghi IDB: có mediaBlob, không lưu previewUrl / chuỗi base64 lớn. */
export function toPersistGeneratedImage<T extends GeneratedImageLike>(img: T): T {
  const { previewUrl: _p, ...rest } = img as T & { previewUrl?: string };
  return {
    ...rest,
    previewUrl: undefined,
    imageBytes: img.mediaBlob ? "" : img.imageBytes || "",
  } as T;
}

export function toPersistGeneratedVideo<T extends GeneratedVideoLike>(video: T): T {
  const { previewUrl: _p, ...rest } = video as T & { previewUrl?: string };
  return {
    ...rest,
    previewUrl: undefined,
    videoBytes: video.mediaBlob ? null : video.videoBytes ?? null,
  } as T;
}

/**
 * Bản nhẹ cho React state: bỏ imageBytes/videoBytes, gắn previewUrl từ Blob.
 * Giữ mediaBlob (tham chiếu) để gọi API / download không phải đọc lại IDB.
 */
export function toUiGeneratedImage<T extends GeneratedImageLike>(
  img: T,
  previous?: T | null
): T {
  const ensured =
    img.mediaBlob || !(img.imageBytes || "").trim()
      ? img
      : ({
          ...img,
          mediaBlob: base64ToBlob(
            stripBase64Payload(img.imageBytes!),
            img.mimeType || "image/jpeg"
          ),
          imageBytes: "",
        } as T);

  let previewUrl = ensured.previewUrl;
  if (ensured.mediaBlob) {
    previewUrl = getOrCreateBlobPreviewUrl(ensured.mediaBlob);
  } else {
    previewUrl = getGeneratedImageUrl(ensured) || previous?.previewUrl;
    if (previous?.previewUrl?.startsWith("blob:") && previous.previewUrl !== previewUrl) {
      revokeBlobPreviewUrl(previous.previewUrl);
    }
  }

  return {
    ...ensured,
    imageBytes: "",
    previewUrl,
  } as T;
}

export function toUiGeneratedVideo<T extends GeneratedVideoLike>(
  video: T,
  previous?: T | null
): T {
  let ensured = video;
  if (!video.mediaBlob && (video.videoBytes || "").trim()) {
    ensured = {
      ...video,
      mediaBlob: base64ToBlob(
        stripBase64Payload(video.videoBytes!),
        video.mimeType || "video/mp4"
      ),
      videoBytes: null,
    } as T;
  }

  let previewUrl = ensured.previewUrl;
  if (ensured.mediaBlob) {
    previewUrl = getOrCreateBlobPreviewUrl(ensured.mediaBlob);
  } else {
    const uri = (ensured.videoUri || "").trim();
    previewUrl = uri
      ? uri.startsWith("blob:") || uri.startsWith("data:")
        ? uri
        : toDownloadProxyUrl(uri, true)
      : previous?.previewUrl;
    if (previous?.previewUrl?.startsWith("blob:") && previous.previewUrl !== previewUrl) {
      revokeBlobPreviewUrl(previous.previewUrl);
    }
  }

  return {
    ...ensured,
    videoBytes: null,
    previewUrl,
  } as T;
}

export async function prepareGeneratedImageForIdb<T extends GeneratedImageLike>(
  img: T
): Promise<T> {
  return toPersistGeneratedImage(await ensureGeneratedImageBinary(img));
}

export async function prepareGeneratedVideoForIdb<T extends GeneratedVideoLike>(
  video: T
): Promise<T> {
  return toPersistGeneratedVideo(await ensureGeneratedVideoBinary(video));
}

/**
 * Chuẩn hoá ảnh đã generate → payload API (luôn base64).
 * Ưu tiên mediaBlob → imageBytes → fetch URL.
 */
export async function generatedImageToApiBase64Input(
  img: GeneratedImageLike
): Promise<{ imageBytes: string; mimeType: string }> {
  if (img.mediaBlob) {
    return {
      imageBytes: await blobToBase64Payload(img.mediaBlob),
      mimeType: img.mimeType || img.mediaBlob.type || "image/jpeg",
    };
  }

  if ((img.imageBytes || "").trim()) {
    return {
      imageBytes: stripBase64Payload(img.imageBytes!),
      mimeType: img.mimeType || "image/jpeg",
    };
  }

  const url = getGeneratedImageUrl(img);
  if (!url) {
    throw new Error("Thiếu dữ liệu ảnh (blob, base64 hoặc link)");
  }

  const fetched = await fetchUrlToBase64Payload(url, img.mimeType || "image/jpeg");
  if (!fetched?.bytes) {
    throw new Error("Không thể chuyển ảnh sang base64 để gửi API");
  }

  return { imageBytes: fetched.bytes, mimeType: fetched.mimeType };
}

/** @deprecated Dùng `generatedImageToApiBase64Input` (async, luôn base64). */
export async function generatedImageToVideoApiInput(
  img: GeneratedImageLike
): Promise<{ imageBytes: string; mimeType: string }> {
  return generatedImageToApiBase64Input(img);
}

/**
 * Chuẩn hoá video đã generate → payload API (luôn base64).
 */
export async function generatedVideoToApiBase64Input(
  video: GeneratedVideoLike
): Promise<{ videoBytes: string; mimeType: string }> {
  if (video.mediaBlob) {
    return {
      videoBytes: await blobToBase64Payload(video.mediaBlob),
      mimeType: video.mimeType || video.mediaBlob.type || "video/mp4",
    };
  }

  if ((video.videoBytes || "").trim()) {
    return {
      videoBytes: stripBase64Payload(video.videoBytes!),
      mimeType: video.mimeType || "video/mp4",
    };
  }

  const uri = (video.videoUri || "").trim();
  if (!uri) {
    throw new Error("Thiếu dữ liệu video (blob, base64 hoặc link)");
  }

  const fetched = await fetchUrlToBase64Payload(uri, video.mimeType || "video/mp4");
  if (!fetched?.bytes) {
    throw new Error("Không thể chuyển video sang base64 để gửi API");
  }

  return { videoBytes: fetched.bytes, mimeType: fetched.mimeType };
}

export function normalizeGeneratedImageFromApi<T extends GeneratedImageLike>(
  item: Partial<T> | undefined | null
): T | undefined {
  if (!item) return undefined;
  const url = (item.imageUrl || item.fifeUrl || "").trim();
  if (!item.imageBytes && !item.mediaBlob && !url) return undefined;
  return {
    ...item,
    imageBytes: item.imageBytes || "",
    mimeType: item.mimeType || item.mediaBlob?.type || "image/jpeg",
    fifeUrl: item.fifeUrl || url,
    imageUrl: item.imageUrl || url,
  } as T;
}

export function normalizeGeneratedVideoFromApi<T extends GeneratedVideoLike>(
  item: Partial<T> & { videoUrl?: string | null } | undefined | null
): T | undefined {
  if (!item) return undefined;
  const videoUri = (item.videoUri ?? item.videoUrl ?? null) as string | null;
  if (!videoUri && !item.videoBytes && !item.mediaBlob) return undefined;
  return {
    ...item,
    videoUri,
    videoBytes: item.videoBytes ?? null,
    mimeType: item.mimeType || item.mediaBlob?.type || "video/mp4",
  } as T;
}

/** Fetch URL / data URL → base64 (logic tương tự code cũ trên server). */
export async function fetchUrlToBase64Payload(
  url: string,
  fallbackMimeType: string
): Promise<{ bytes: string; mimeType: string } | null> {
  try {
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return { mimeType: dataMatch[1], bytes: dataMatch[2] };
    }

    let blob: Blob;
    try {
      blob = await uriToBlob(url);
    } catch (err) {
      console.warn("[fetchUrlToBase64Payload] Failed:", url, err);
      return null;
    }
    const mimeType = blob.type || fallbackMimeType;
    const bytes = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (!bytes) return null;
    return { bytes, mimeType };
  } catch (err) {
    console.warn("[fetchUrlToBase64Payload] Failed:", url, err);
    return null;
  }
}

/**
 * Enrich local binary từ URL hết hạn.
 * Lưu `mediaBlob` (không nhét chuỗi base64) — tên hàm giữ để tương thích call site.
 */
export async function enrichGeneratedImageWithBase64<T extends GeneratedImageLike>(
  imageData: T
): Promise<T> {
  const ensured = await ensureGeneratedImageBinary(imageData);
  if (ensured.mediaBlob) return ensured;

  const url = getGeneratedImageUrl(ensured);
  if (!url) return ensured;

  const blob = await fetchUrlToBlob(url, ensured.mimeType || "image/jpeg");
  if (!blob) return ensured;

  return {
    ...ensured,
    mediaBlob: blob,
    imageBytes: "",
    mimeType: blob.type || ensured.mimeType || "image/jpeg",
    fifeUrl: ensured.fifeUrl || url,
    imageUrl: ensured.imageUrl || url,
  } as T;
}

export async function enrichGeneratedVideoWithBase64<T extends GeneratedVideoLike>(
  videoData: T
): Promise<T> {
  const ensured = await ensureGeneratedVideoBinary(videoData);
  if (hasStoredGeneratedVideoBase64(ensured)) return ensured;

  const uri = (ensured.videoUri || "").trim();
  if (!uri || !isHttpVideoUri(uri)) return ensured;

  const blob = await fetchUrlToBlob(uri, ensured.mimeType || "video/mp4");
  if (!blob) return ensured;

  return {
    ...ensured,
    mediaBlob: blob,
    videoBytes: null,
    mimeType: blob.type || ensured.mimeType || "video/mp4",
    videoUri: uri,
  } as T;
}

function isHttpVideoUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri.trim());
}

/** Đã có binary local (mediaBlob / legacy bytes / data: URI). */
export function hasStoredGeneratedVideoBase64(
  video: GeneratedVideoLike | null | undefined
): boolean {
  if (!video) return false;
  if (video.mediaBlob) return true;
  if ((video.videoBytes || "").trim()) return true;
  const uri = (video.videoUri || "").trim();
  return uri.startsWith("data:");
}

/** Video còn link HTTP chưa có binary local — cần enrich khi refresh / load lại trang. */
export function hasPendingGeneratedVideoBase64(
  video: GeneratedVideoLike | null | undefined
): boolean {
  if (!video || hasStoredGeneratedVideoBase64(video)) return false;
  const uri = (video.videoUri || "").trim();
  return isHttpVideoUri(uri);
}

/**
 * Tiếp tục chuyển link → Blob nếu lần trước bị kẹt.
 * Hiển thị link trước; gọi hàm này khi load scene / refresh trang.
 */
export async function resumePendingGeneratedVideoBase64<T extends GeneratedVideoLike>(
  sceneId: string,
  video: T,
  storage: MediaPersistStorage<T>,
  options?: { onUpdate?: (data: T) => void }
): Promise<T> {
  if (!hasPendingGeneratedVideoBase64(video)) {
    const ensured = await ensureGeneratedVideoBinary(video);
    if (ensured.mediaBlob && (video.videoBytes || "").trim()) {
      try {
        await storage.set(sceneId, toPersistGeneratedVideo(ensured));
      } catch (err) {
        console.warn("[resumePendingGeneratedVideoBase64] migrate failed", err);
      }
    }
    const ui = toUiGeneratedVideo(ensured);
    options?.onUpdate?.(ui);
    return ui;
  }

  try {
    const enriched = await enrichGeneratedVideoWithBase64(video);
    if (!enriched.mediaBlob) return toUiGeneratedVideo(video);
    await storage.set(sceneId, toPersistGeneratedVideo(enriched));
    const ui = toUiGeneratedVideo(enriched);
    options?.onUpdate?.(ui);
    return ui;
  } catch (err) {
    console.warn("[resumePendingGeneratedVideoBase64]", err);
    return toUiGeneratedVideo(video);
  }
}

/** Queue ClearWatermark 1 ảnh / lần — sau gen image. */
let clearGeneratedImageQueue: Promise<void> = Promise.resolve();
/** Job clear theo scene — tránh resumePending chạy lại với snapshot URL cũ. */
const inflightImageClearJobs = new Map<string, Promise<any>>();

function enqueueClearGeneratedImage<T>(fn: () => Promise<T>): Promise<T> {
  const run = clearGeneratedImageQueue.then(fn, fn);
  clearGeneratedImageQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function rememberClearedGeneratedImage<T>(sceneId: string, ui: T): void {
  inflightImageClearJobs.set(sceneId, Promise.resolve(ui));
}

async function tryClearGeneratedImageWatermark<T extends GeneratedImageLike>(
  image: T,
  clientId: string
): Promise<T | null> {
  try {
    const input = await generatedImageToApiBase64Input(image);
    const result = await requestCleanWatermark([
      {
        clientId,
        kind: "image",
        mediaBase64: input.imageBytes,
        mimeType: input.mimeType,
        name: `${clientId}.jpg`,
      },
    ]);
    const processed =
      result.processed.find((p) => p.clientId === clientId) || result.processed[0];
    if (!processed) {
      if (result.skipped[0]?.reason) {
        console.warn("[tryClearGeneratedImageWatermark] skip:", result.skipped[0].reason);
      }
      return null;
    }

    let blob: Blob | null = null;
    if (processed.mediaBase64) {
      blob = watermarkBase64ToBlob(
        stripToPureBase64(processed.mediaBase64),
        processed.mimeType || input.mimeType
      );
    }
    if (!blob?.size && processed.url) {
      blob = await fetchUrlToBlob(processed.url, processed.mimeType || input.mimeType);
    }
    if (!blob?.size) return null;

    return toUiGeneratedImage({
      ...image,
      mediaBlob: blob,
      mimeType: processed.mimeType || blob.type || input.mimeType,
      imageBytes: "",
      previewUrl: undefined,
    } as T);
  } catch (err) {
    console.warn("[tryClearGeneratedImageWatermark]", err);
    return null;
  }
}

/** Link gốc / binary hiện có → blob UI. Dùng khi ClearWatermark lỗi. */
async function fallbackOriginalImageToBlob<T extends GeneratedImageLike>(image: T): Promise<T> {
  const fromLocal = await ensureGeneratedImageBinary(image);
  if (fromLocal.mediaBlob) {
    return toUiGeneratedImage({
      ...fromLocal,
      imageBytes: "",
      previewUrl: undefined,
    } as T);
  }

  const fromUrl = await enrichGeneratedImageWithBase64(image);
  if (fromUrl.mediaBlob) {
    return toUiGeneratedImage({
      ...fromUrl,
      imageBytes: "",
      previewUrl: undefined,
    } as T);
  }

  return toUiGeneratedImage(image);
}

async function persistResolvedGeneratedImage<T extends GeneratedImageLike>(
  sceneId: string,
  image: T,
  storage: MediaPersistStorage<T>,
  onUpdate?: (data: T) => void
): Promise<T> {
  const ui = hasStoredGeneratedImageBinary(image)
    ? toUiGeneratedImage(image)
    : await fallbackOriginalImageToBlob(image);

  if (hasStoredGeneratedImageBinary(ui)) {
    await storage.set(sceneId, toPersistGeneratedImage(ui));
  }
  onUpdate?.(ui);
  notifyGeneratedMediaReplaced({ sceneId, kind: "image", image: ui });
  return ui;
}

/**
 * Sau gen: ClearWatermark rồi lưu blob đã xóa. Lỗi/hết hạn mức → fallback blob gốc.
 */
async function persistImageAfterClearWatermark<T extends GeneratedImageLike>(
  sceneId: string,
  image: T,
  storage: MediaPersistStorage<T>,
  onUpdate?: (data: T) => void
): Promise<T> {
  const existing = inflightImageClearJobs.get(sceneId);
  if (existing) {
    const ui = (await existing) as T;
    onUpdate?.(ui);
    return ui;
  }

  const job = enqueueClearGeneratedImage(async () => {
    try {
      const source = hasStoredGeneratedImageBinary(image)
        ? await ensureGeneratedImageBinary(image)
        : await enrichGeneratedImageWithBase64(image);

      let cleared: T | null = null;
      try {
        if (hasStoredGeneratedImageBinary(source)) {
          cleared = await tryClearGeneratedImageWatermark(source, sceneId);
        }
      } catch (err) {
        console.warn("[persistImageAfterClearWatermark] clear failed", err);
      }

      if (cleared && hasStoredGeneratedImageBinary(cleared)) {
        return persistResolvedGeneratedImage(sceneId, cleared, storage, onUpdate);
      }

      // Clear lỗi / skip / hết hạn mức → lấy link gốc chuyển blob
      const originalBlob = await fallbackOriginalImageToBlob(
        source.mediaBlob ? source : image
      );
      return persistResolvedGeneratedImage(sceneId, originalBlob, storage, onUpdate);
    } catch (err) {
      console.warn("[persistImageAfterClearWatermark] fallback original url → blob", err);
      const originalBlob = await fallbackOriginalImageToBlob(image);
      return persistResolvedGeneratedImage(sceneId, originalBlob, storage, onUpdate);
    }
  });

  inflightImageClearJobs.set(sceneId, job);
  try {
    return await job;
  } catch (err) {
    inflightImageClearJobs.delete(sceneId);
    throw err;
  }
}

/** Ảnh còn link HTTP chưa có binary local — cần enrich khi refresh. */
export function hasPendingGeneratedImageBinary(
  img: GeneratedImageLike | null | undefined
): boolean {
  if (!img || hasStoredGeneratedImageBinary(img)) return false;
  return !!getGeneratedImageUrl(img);
}

/**
 * Tiếp tục chuyển link ảnh → Blob nếu lần trước bị kẹt.
 */
export async function resumePendingGeneratedImageBinary<T extends GeneratedImageLike>(
  sceneId: string,
  image: T,
  storage: MediaPersistStorage<T>,
  options?: { onUpdate?: (data: T) => void }
): Promise<T> {
  const inflight = inflightImageClearJobs.get(sceneId);
  if (inflight) {
    const ui = (await inflight) as T;
    options?.onUpdate?.(ui);
    return ui;
  }

  if (!hasPendingGeneratedImageBinary(image)) {
    const ensured = await ensureGeneratedImageBinary(image);
    // Migrate legacy base64 → mediaBlob trong IDB
    if (ensured.mediaBlob && (image.imageBytes || "").trim()) {
      try {
        await storage.set(sceneId, toPersistGeneratedImage(ensured));
      } catch (err) {
        console.warn("[resumePendingGeneratedImageBinary] migrate failed", err);
      }
    }
    const ui = toUiGeneratedImage(ensured);
    options?.onUpdate?.(ui);
    return ui;
  }

  try {
    return await persistImageAfterClearWatermark(
      sceneId,
      image,
      storage,
      options?.onUpdate
    );
  } catch (err) {
    console.warn("[resumePendingGeneratedImageBinary]", err);
    try {
      const fallback = await fallbackOriginalImageToBlob(image);
      if (hasStoredGeneratedImageBinary(fallback)) {
        await storage.set(sceneId, toPersistGeneratedImage(fallback));
        options?.onUpdate?.(fallback);
        notifyGeneratedMediaReplaced({ sceneId, kind: "image", image: fallback });
        return fallback;
      }
    } catch (fallbackErr) {
      console.warn("[resumePendingGeneratedImageBinary] fallback blob", fallbackErr);
    }
    return toUiGeneratedImage(image);
  }
}

/**
 * Lưu link vào IndexedDB ngay (hiển thị trước).
 * ClearWatermark chạy ngầm — xong thì thay blob + blob URL ảnh đã xóa logo.
 */
export async function persistGeneratedImageWithEnrichment<T extends GeneratedImageLike>(
  sceneId: string,
  raw: Partial<T> | undefined | null,
  storage: MediaPersistStorage<T>,
  options?: {
    onUpdate?: (data: T) => void;
    /** Sau khi clear/fallback có blob — dùng auto-download ảnh đã xóa logo */
    onReady?: (data: T) => void;
    /** true: chờ clear xong mới return (Wolf asset). Mặc định false — hiện link trước */
    waitForClear?: boolean;
  }
): Promise<T | undefined> {
  const preview = normalizeGeneratedImageFromApi(raw);
  if (!preview) return undefined;

  inflightImageClearJobs.delete(sceneId);

  const initial = await ensureGeneratedImageBinary(preview);
  await storage.set(sceneId, toPersistGeneratedImage(initial));
  const initialUi = toUiGeneratedImage(initial);
  options?.onUpdate?.(initialUi);

  const runClear = persistImageAfterClearWatermark(
    sceneId,
    initial,
    storage,
    (data) => {
      options?.onUpdate?.(data);
      options?.onReady?.(data);
    }
  ).catch(async (err) => {
    console.warn("[persistGeneratedImageWithEnrichment]", err);
    try {
      const fallback = await fallbackOriginalImageToBlob(initial);
      if (hasStoredGeneratedImageBinary(fallback)) {
        await storage.set(sceneId, toPersistGeneratedImage(fallback));
      }
      options?.onUpdate?.(fallback);
      options?.onReady?.(fallback);
      rememberClearedGeneratedImage(sceneId, fallback);
      notifyGeneratedMediaReplaced({ sceneId, kind: "image", image: fallback });
      return fallback;
    } catch (fallbackErr) {
      console.warn("[persistGeneratedImageWithEnrichment] fallback blob", fallbackErr);
      return initialUi;
    }
  });

  if (options?.waitForClear) {
    return await runClear;
  }

  void runClear;
  return initialUi;
}

/** Lưu link trước; enrich Blob chạy ngầm (xem persistGeneratedImageWithEnrichment). */
export async function persistGeneratedVideoWithEnrichment<T extends GeneratedVideoLike>(
  sceneId: string,
  raw: Partial<T> | undefined | null,
  storage: MediaPersistStorage<T>,
  options?: { onUpdate?: (data: T) => void }
): Promise<T | undefined> {
  const preview = normalizeGeneratedVideoFromApi(raw);
  if (!preview) return undefined;

  const initial = await ensureGeneratedVideoBinary(preview);
  await storage.set(sceneId, toPersistGeneratedVideo(initial));
  const initialUi = toUiGeneratedVideo(initial);
  options?.onUpdate?.(initialUi);

  void (async () => {
    try {
      if (!hasPendingGeneratedVideoBase64(initial)) return;
      const enriched = await enrichGeneratedVideoWithBase64(initial);
      if (!enriched.mediaBlob) return;
      await storage.set(sceneId, toPersistGeneratedVideo(enriched));
      options?.onUpdate?.(toUiGeneratedVideo(enriched));
    } catch (err) {
      console.warn("[persistGeneratedVideoWithEnrichment]", err);
    }
  })();

  return initialUi;
}

export async function generatedImageToBlob(img: GeneratedImageLike): Promise<Blob> {
  if (img.mediaBlob) return img.mediaBlob;
  if ((img.imageBytes || "").trim()) {
    return base64ToBlob(
      stripBase64Payload(img.imageBytes!),
      img.mimeType || "image/png"
    );
  }
  const url = getGeneratedImageUrl(img);
  if (!url) {
    throw new Error("Thiếu dữ liệu ảnh (URL hoặc blob)");
  }
  return uriToBlob(url);
}

/** Chuyển mimeType → extension file (vd. image/jpeg → jpg). */
export function mimeTypeToFileExtension(mimeType?: string, fallback = "png"): string {
  if (!mimeType) return fallback;
  const sub = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0]?.toLowerCase();
  if (!sub) return fallback;
  if (sub === "jpeg") return "jpg";
  if (sub === "quicktime") return "mov";
  return sub;
}

/** Tên file ảnh theo số phân cảnh kèm extension, vd. `1.png`, `2.jpg`. */
export function buildSceneImageFileName(sceneNumber: number, mimeType?: string): string {
  const ext = mimeTypeToFileExtension(mimeType);
  return `${sceneNumber}.${ext}`;
}

/** Tên file video theo số phân cảnh, vd. `scene-1-video.mp4`. */
export function buildSceneVideoFileName(sceneNumber: number, mimeType?: string): string {
  const ext = mimeTypeToFileExtension(mimeType, "mp4");
  return `scene-${sceneNumber}-video.${ext}`;
}

export async function downloadGeneratedImage(
  img: GeneratedImageLike,
  fileName: string
): Promise<void> {
  const blob = await generatedImageToBlob(img);
  triggerBlobDownload(blob, fileName);
}

/** Tải ảnh đã generate về máy — tên file = số phân cảnh (vd. `3.png`). */
export async function downloadSceneImage(
  img: GeneratedImageLike,
  sceneNumber: number
): Promise<void> {
  const blob = await generatedImageToBlob(img);
  const mime = img.mimeType || blob.type || "image/png";
  triggerBlobDownload(blob, buildSceneImageFileName(sceneNumber, mime));
}

/** Tải ảnh theo độ phân giải — 1K gốc hoặc upscale 2K/4K; thiếu metadata thì fallback 1K. */
export async function downloadSceneImageAtResolution(
  img: GeneratedImageLike,
  sceneNumber: number,
  resolution: AutoDownloadImageResolution
): Promise<void> {
  if (resolution === "1K") {
    return downloadSceneImage(img, sceneNumber);
  }
  const upsampleRes = resolution as UpsampleResolution;
  if (!hasFlow2UpsampleMeta(img, upsampleRes)) {
    console.warn(`[autoDownload] Thiếu metadata ${resolution}, tải 1K thay thế`);
    return downloadSceneImage(img, sceneNumber);
  }
  const mime = img.mimeType || "image/png";
  const fileName = buildSceneImageFileName(sceneNumber, mime);
  return downloadUpsampledImage(img, fileName, upsampleRes);
}

/** Upscale ảnh đã generate qua Flow2 (SSE + download token) và trả Blob. */
type UpsampleImageSSEEvent = {
  type?: string;
  progress?: number;
  message?: string;
  downloadToken?: string;
  mimeType?: string;
};

function parseUpsampleImageSSELine(line: string): UpsampleImageSSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as UpsampleImageSSEEvent;
  } catch {
    return null;
  }
}

async function consumeUpsampleImageSSE(
  res: Response,
  onProgress?: (progress: number, message?: string) => void
): Promise<{ downloadToken: string }> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Không đọc được stream upscale ảnh");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let downloadToken: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const evt = parseUpsampleImageSSELine(line);
      if (!evt?.type) continue;

      if (evt.type === "progress" && typeof evt.progress === "number") {
        onProgress?.(evt.progress, evt.message);
      }
      if (evt.type === "done" && evt.downloadToken) {
        downloadToken = evt.downloadToken;
      }
      if (evt.type === "error") {
        throw new Error(evt.message || "Lỗi upscale ảnh");
      }
    }
  }

  const tail = parseUpsampleImageSSELine(buffer);
  if (tail?.type === "error") {
    throw new Error(tail.message || "Lỗi upscale ảnh");
  }
  if (tail?.type === "done" && tail.downloadToken) {
    downloadToken = tail.downloadToken;
  }

  if (!downloadToken) {
    throw new Error("Không nhận được token tải ảnh upscale");
  }

  return { downloadToken };
}

export async function fetchUpsampledImageBlob(
  img: GeneratedImageLike,
  resolution: UpsampleResolution,
  options?: { onProgress?: (progress: number, message?: string) => void }
): Promise<Blob> {
  if (!hasFlow2UpsampleMeta(img, resolution)) {
    throw new Error(`Thiếu metadata Flow2 (flow2RequestId) để upscale ${resolution}`);
  }

  const res = await fetch("/api/app/upsample-image/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resolution,
      flow2RequestId: img.flow2RequestId!.trim(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string })?.message || `Lỗi upscale ${resolution} (${res.status})`
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("event-stream")) {
    throw new Error(`Phản hồi upscale ${resolution} không hợp lệ`);
  }

  const { downloadToken } = await consumeUpsampleImageSSE(res, options?.onProgress);

  const dlRes = await fetch(
    `/api/app/upsample-image/download/?token=${encodeURIComponent(downloadToken)}`
  );
  if (!dlRes.ok) {
    const err = await dlRes.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string })?.message || `Lỗi tải ảnh ${resolution} (${dlRes.status})`
    );
  }

  return dlRes.blob();
}

/** Upscale ảnh đã generate qua Flow2 và tải về. */
export async function downloadUpsampledImage(
  img: GeneratedImageLike,
  fileName: string,
  resolution: UpsampleResolution
): Promise<void> {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const suffix = resolution.toLowerCase();
  const blob = await fetchUpsampledImageBlob(img, resolution);
  const ext = mimeTypeToFileExtension(blob.type || img.mimeType, "jpg");
  triggerBlobDownload(blob, `${baseName}-${suffix}.${ext}`);
}

/** @deprecated Dùng downloadUpsampledImage(..., "4K") */
export async function downloadUpsampled4kImage(
  img: GeneratedImageLike,
  fileName: string
): Promise<void> {
  return downloadUpsampledImage(img, fileName, "4K");
}

/** Ưu tiên mediaBlob; legacy videoBytes; remote URI; hết hạn → blob:/previewUrl. */
export async function generatedVideoToBlob(video: GeneratedVideoLike): Promise<Blob> {
  if (video.mediaBlob && video.mediaBlob.size > 0) return video.mediaBlob;
  if ((video.videoBytes || "").trim()) {
    return base64ToBlob(stripBase64Payload(video.videoBytes!), video.mimeType || "video/mp4");
  }

  const remote = (video.videoUri || "").trim();
  const preview = (video.previewUrl || "").trim();
  const fromSrc = getGeneratedVideoPreviewSrc(video) || "";
  const candidates: string[] = [];
  const push = (u: string) => {
    if (u && candidates.indexOf(u) < 0) candidates.push(u);
  };
  if (remote && !remote.startsWith("blob:") && !remote.startsWith("data:")) {
    push(remote);
  }
  push(preview);
  push(fromSrc);
  push(remote);

  let lastErr: Error | null = null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      const blob = await uriToBlob(candidates[i]);
      if (blob && blob.size > 0) return blob;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn("[generatedVideoToBlob] miss, thử blob/preview", lastErr.message);
    }
  }

  throw lastErr || new Error("Thiếu dữ liệu video (URI hoặc blob)");
}

export async function downloadGeneratedVideo(
  video: GeneratedVideoLike,
  fileName: string
): Promise<void> {
  const blob = await generatedVideoToBlob(video);
  triggerBlobDownload(blob, fileName);
}

/** Upscale video đã generate lên 1080p qua Flow2 và trả Blob. */
type UpsampleVideoSSEEvent = {
  type?: string;
  progress?: number;
  message?: string;
  downloadToken?: string;
  mimeType?: string;
};

function parseUpsampleVideoSSELine(line: string): UpsampleVideoSSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as UpsampleVideoSSEEvent;
  } catch {
    return null;
  }
}

async function consumeUpsampleVideoSSE(
  res: Response,
  onProgress?: (progress: number, message?: string) => void
): Promise<{ downloadToken: string }> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Không đọc được stream upscale video 1080p");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let downloadToken: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const evt = parseUpsampleVideoSSELine(line);
      if (!evt?.type) continue;

      if (evt.type === "progress" && typeof evt.progress === "number") {
        onProgress?.(evt.progress, evt.message);
      }
      if (evt.type === "done" && evt.downloadToken) {
        downloadToken = evt.downloadToken;
      }
      if (evt.type === "error") {
        throw new Error(evt.message || "Lỗi upscale video 1080p");
      }
    }
  }

  const tail = parseUpsampleVideoSSELine(buffer);
  if (tail?.type === "error") {
    throw new Error(tail.message || "Lỗi upscale video 1080p");
  }
  if (tail?.type === "done" && tail.downloadToken) {
    downloadToken = tail.downloadToken;
  }

  if (!downloadToken) {
    throw new Error("Không nhận được token tải video 1080p");
  }

  return { downloadToken };
}

export async function fetchUpsampled1080pVideoBlob(
  video: GeneratedVideoLike,
  options?: { onProgress?: (progress: number, message?: string) => void }
): Promise<Blob> {
  if (!hasFlow2Upsample1080pVideoMeta(video)) {
    throw new Error("Thiếu metadata Flow2 (flow2RequestId) để upscale video 1080p");
  }

  const res = await fetch("/api/app/upsample-video/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow2RequestId: video.flow2RequestId!.trim() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string })?.message || `Lỗi upscale video 1080p (${res.status})`
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("event-stream")) {
    throw new Error("Phản hồi upscale video 1080p không hợp lệ");
  }

  const { downloadToken } = await consumeUpsampleVideoSSE(res, options?.onProgress);

  const dlRes = await fetch(
    `/api/app/upsample-video/download/?token=${encodeURIComponent(downloadToken)}`
  );
  if (!dlRes.ok) {
    const err = await dlRes.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string })?.message || `Lỗi tải video 1080p (${dlRes.status})`
    );
  }

  return dlRes.blob();
}

function buildUpsampledVideoFileName(baseName: string, resolution: VideoDownloadResolution): string {
  const stem = baseName.replace(/\.[^.]+$/, "");
  return `${stem}-${resolution}.mp4`;
}

/**
 * Tải video đã generate — 720p (gốc) hoặc 1080p (upsample Flow2).
 * Hàm dùng chung cho nút tải từng scene và batch download.
 */
export async function downloadVideoAtResolution(
  video: GeneratedVideoLike,
  fileName: string,
  resolution: VideoDownloadResolution
): Promise<void> {
  if (resolution === "1080p") {
    try {
      const blob = await fetchUpsampled1080pVideoBlob(video);
      const ext = mimeTypeToFileExtension(blob.type || video.mimeType, "mp4");
      const downloadName = buildUpsampledVideoFileName(fileName, resolution).replace(
        /\.[^.]+$/,
        `.${ext}`
      );
      triggerBlobDownload(blob, downloadName);
      return;
    } catch (err) {
      console.warn("[downloadVideoAtResolution] 1080p miss → blob/720p", err);
    }
  }

  await downloadGeneratedVideo(video, fileName);
}
