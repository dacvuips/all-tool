import { base64ToBlob, toDownloadProxyUrl, triggerBlobDownload, uriToBlob } from "./videoDownloadUtils";

/** Metadata Flow2 lưu sau gen_image — dùng upscale 4K. */
export type Flow2ImageMeta = {
  flow2RequestId?: string;
  mediaId?: string;
  projectId?: string;
  profileId?: string;
};

/** Shape tối thiểu của ảnh generate — hỗ trợ base64 hoặc URL Flow2. */
export type GeneratedImageLike = {
  imageBytes?: string;
  mimeType?: string;
  fifeUrl?: string;
  imageUrl?: string;
} & Flow2ImageMeta;

/** Metadata Flow2 lưu sau gen_video — dùng upscale 1080p. */
export type Flow2VideoMeta = {
  flow2RequestId?: string;
};

/** Shape tối thiểu của video generate — hỗ trợ URI hoặc base64. */
export type GeneratedVideoLike = {
  videoUri?: string | null;
  videoBytes?: string | null;
  mimeType?: string;
  aspectRatio?: string;
} & Flow2VideoMeta;

/** Độ phân giải tải video: 720p (gốc) hoặc 1080p (upsample Flow2). */
export type VideoDownloadResolution = "720p" | "1080p";

export type MediaPersistStorage<T> = {
  set: (key: string, value: T) => Promise<void>;
};

export function getGeneratedImageUrl(img: GeneratedImageLike): string {
  return (img.imageUrl || img.fifeUrl || "").trim();
}

export function hasGeneratedImageData(img: GeneratedImageLike | null | undefined): boolean {
  return !!(img && (img.imageBytes || getGeneratedImageUrl(img)));
}

/** Độ phân giải upscale qua Flow2. */
export type UpsampleResolution = "2K" | "4K";

/** Đủ metadata Flow2 để gọi upscale 2K (request_id). */
export function hasFlow2Upsample2kMeta(img: GeneratedImageLike | null | undefined): boolean {
  return !!img?.flow2RequestId?.trim();
}

/** Đủ metadata Flow2 để gọi upscale 4K (media_id + project_id + profile_id). */
export function hasFlow2Upsample4kMeta(img: GeneratedImageLike | null | undefined): boolean {
  return !!(img?.mediaId?.trim() && img?.projectId?.trim() && img?.profileId?.trim());
}

/** @deprecated Dùng hasFlow2Upsample4kMeta */
export function hasFlow2UpscaleMeta(img: GeneratedImageLike | null | undefined): boolean {
  return hasFlow2Upsample4kMeta(img);
}

export function hasFlow2UpsampleMeta(
  img: GeneratedImageLike | null | undefined,
  resolution: UpsampleResolution
): boolean {
  return resolution === "2K" ? hasFlow2Upsample2kMeta(img) : hasFlow2Upsample4kMeta(img);
}

/** Đủ metadata Flow2 để upscale video 1080p (request_id từ gen_video). */
export function hasFlow2Upsample1080pVideoMeta(
  video: GeneratedVideoLike | null | undefined
): boolean {
  return !!video?.flow2RequestId?.trim();
}

export function hasGeneratedVideoData(video: GeneratedVideoLike | null | undefined): boolean {
  return !!(video && (video.videoUri || video.videoBytes));
}

/** Ưu tiên base64; fallback link (chỉ dùng hiển thị / preview). */
export function getGeneratedImagePreviewSrc(img: GeneratedImageLike): string {
  if (img.imageBytes) {
    return `data:${img.mimeType || "image/jpeg"};base64,${img.imageBytes}`;
  }
  return getGeneratedImageUrl(img);
}

/** Ưu tiên base64; fallback videoUri qua download-proxy (tránh CORS flow2.viettheo.site). */
export function getGeneratedVideoPreviewSrc(video: GeneratedVideoLike): string | null {
  if (video.videoBytes) {
    return `data:${video.mimeType || "video/mp4"};base64,${video.videoBytes}`;
  }
  const uri = (video.videoUri || "").trim();
  if (!uri) return null;
  return toDownloadProxyUrl(uri, true);
}

function stripBase64Payload(value: string): string {
  const trimmed = value.trim();
  const dataMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/);
  return dataMatch ? dataMatch[1] : trimmed;
}

/**
 * Chuẩn hoá ảnh đã generate → payload API (luôn base64).
 * Nếu chưa có base64 (chỉ có link) sẽ fetch tại thời điểm gọi — tách biệt với enrich nền sau generate.
 */
export async function generatedImageToApiBase64Input(
  img: GeneratedImageLike
): Promise<{ imageBytes: string; mimeType: string }> {
  if (img.imageBytes) {
    return {
      imageBytes: stripBase64Payload(img.imageBytes),
      mimeType: img.mimeType || "image/jpeg",
    };
  }

  const url = getGeneratedImageUrl(img);
  if (!url) {
    throw new Error("Thiếu dữ liệu ảnh (base64 hoặc link)");
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
 * Dùng cho video-to-video khi nguồn là kết quả generate (videoUri + videoBytes).
 */
export async function generatedVideoToApiBase64Input(
  video: GeneratedVideoLike
): Promise<{ videoBytes: string; mimeType: string }> {
  if (video.videoBytes) {
    return {
      videoBytes: stripBase64Payload(video.videoBytes),
      mimeType: video.mimeType || "video/mp4",
    };
  }

  const uri = (video.videoUri || "").trim();
  if (!uri) {
    throw new Error("Thiếu dữ liệu video (base64 hoặc link)");
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
  if (!item.imageBytes && !url) return undefined;
  return {
    ...item,
    imageBytes: item.imageBytes || "",
    mimeType: item.mimeType || "image/jpeg",
    fifeUrl: item.fifeUrl || url,
    imageUrl: item.imageUrl || url,
  } as T;
}

export function normalizeGeneratedVideoFromApi<T extends GeneratedVideoLike>(
  item: Partial<T> | undefined | null
): T | undefined {
  if (!item) return undefined;
  const videoUri = item.videoUri ?? null;
  if (!videoUri && !item.videoBytes) return undefined;
  return {
    ...item,
    videoUri,
    videoBytes: item.videoBytes ?? null,
    mimeType: item.mimeType || "video/mp4",
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

export async function enrichGeneratedImageWithBase64<T extends GeneratedImageLike>(
  imageData: T
): Promise<T> {
  if (imageData.imageBytes) return imageData;

  const url = getGeneratedImageUrl(imageData);
  if (!url) return imageData;

  const fetched = await fetchUrlToBase64Payload(url, imageData.mimeType || "image/jpeg");
  if (!fetched) return imageData;

  return {
    ...imageData,
    imageBytes: fetched.bytes,
    mimeType: fetched.mimeType || imageData.mimeType || "image/jpeg",
    fifeUrl: imageData.fifeUrl || url,
    imageUrl: imageData.imageUrl || url,
  };
}

export async function enrichGeneratedVideoWithBase64<T extends GeneratedVideoLike>(
  videoData: T
): Promise<T> {
  if (videoData.videoBytes) return videoData;

  const uri = (videoData.videoUri || "").trim();
  if (!uri) return videoData;

  const fetched = await fetchUrlToBase64Payload(uri, videoData.mimeType || "video/mp4");
  if (!fetched) return videoData;

  return {
    ...videoData,
    videoBytes: fetched.bytes,
    mimeType: fetched.mimeType || videoData.mimeType || "video/mp4",
    videoUri: uri,
  };
}

/**
 * Lưu link vào IndexedDB ngay (hiển thị trước).
 * Enrich base64 chạy ngầm — không block caller; API gửi sau dùng `*ToApiBase64Input`.
 */
export async function persistGeneratedImageWithEnrichment<T extends GeneratedImageLike>(
  sceneId: string,
  raw: Partial<T> | undefined | null,
  storage: MediaPersistStorage<T>,
  options?: { onUpdate?: (data: T) => void }
): Promise<T | undefined> {
  const preview = normalizeGeneratedImageFromApi(raw);
  if (!preview) return undefined;

  await storage.set(sceneId, preview);
  options?.onUpdate?.(preview);

  void (async () => {
    try {
      const enriched = await enrichGeneratedImageWithBase64(preview);
      if (!enriched.imageBytes || enriched.imageBytes === preview.imageBytes) return;
      await storage.set(sceneId, enriched);
      options?.onUpdate?.(enriched);
    } catch (err) {
      console.warn("[persistGeneratedImageWithEnrichment]", err);
    }
  })();

  return preview;
}

/** Lưu link trước; enrich base64 chạy ngầm (xem persistGeneratedImageWithEnrichment). */
export async function persistGeneratedVideoWithEnrichment<T extends GeneratedVideoLike>(
  sceneId: string,
  raw: Partial<T> | undefined | null,
  storage: MediaPersistStorage<T>,
  options?: { onUpdate?: (data: T) => void }
): Promise<T | undefined> {
  const preview = normalizeGeneratedVideoFromApi(raw);
  if (!preview) return undefined;

  await storage.set(sceneId, preview);
  options?.onUpdate?.(preview);

  void (async () => {
    try {
      const enriched = await enrichGeneratedVideoWithBase64(preview);
      if (!enriched.videoBytes || enriched.videoBytes === preview.videoBytes) return;
      await storage.set(sceneId, enriched);
      options?.onUpdate?.(enriched);
    } catch (err) {
      console.warn("[persistGeneratedVideoWithEnrichment]", err);
    }
  })();

  return preview;
}

export async function generatedImageToBlob(img: GeneratedImageLike): Promise<Blob> {
  if (img.imageBytes) {
    return base64ToBlob(
      stripBase64Payload(img.imageBytes),
      img.mimeType || "image/png"
    );
  }
  const url = getGeneratedImageUrl(img);
  if (!url) {
    throw new Error("Thiếu dữ liệu ảnh (URL hoặc base64)");
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

/** Upscale ảnh đã generate qua Flow2 và trả Blob. */
export async function fetchUpsampledImageBlob(
  img: GeneratedImageLike,
  resolution: UpsampleResolution
): Promise<Blob> {
  if (!hasFlow2UpsampleMeta(img, resolution)) {
    const missing =
      resolution === "2K"
        ? "flow2RequestId"
        : "mediaId, projectId, profileId";
    throw new Error(`Thiếu metadata Flow2 (${missing}) để upscale ${resolution}`);
  }

  const body: Record<string, string> = { resolution };
  if (resolution === "2K") {
    body.flow2RequestId = img.flow2RequestId!.trim();
  } else {
    body.mediaId = img.mediaId!.trim();
    body.projectId = img.projectId!.trim();
    body.profileId = img.profileId!.trim();
  }

  const res = await fetch("/api/app/upsample-image/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string })?.message || `Lỗi upscale ${resolution} (${res.status})`
    );
  }

  return res.blob();
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

/** Ưu tiên videoBytes (local); fallback videoUri (data URL hoặc HTTP + proxy). */
export async function generatedVideoToBlob(video: GeneratedVideoLike): Promise<Blob> {
  if (video.videoBytes) {
    return base64ToBlob(stripBase64Payload(video.videoBytes), video.mimeType || "video/mp4");
  }

  const uri = (video.videoUri || "").trim();
  if (!uri) {
    throw new Error("Thiếu dữ liệu video (URI hoặc base64)");
  }
  return uriToBlob(uri);
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
    const blob = await fetchUpsampled1080pVideoBlob(video);
    const ext = mimeTypeToFileExtension(blob.type || video.mimeType, "mp4");
    const downloadName = buildUpsampledVideoFileName(fileName, resolution).replace(
      /\.[^.]+$/,
      `.${ext}`
    );
    triggerBlobDownload(blob, downloadName);
    return;
  }

  await downloadGeneratedVideo(video, fileName);
}
