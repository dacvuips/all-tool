import { base64ToBlob, triggerBlobDownload, uriToBlob } from "./videoDownloadUtils";

/** Shape tối thiểu của ảnh generate — hỗ trợ base64 hoặc URL Flow2. */
export type GeneratedImageLike = {
  imageBytes?: string;
  mimeType?: string;
  fifeUrl?: string;
  imageUrl?: string;
};

/** Shape tối thiểu của video generate — hỗ trợ URI hoặc base64. */
export type GeneratedVideoLike = {
  videoUri?: string | null;
  videoBytes?: string | null;
  mimeType?: string;
  aspectRatio?: string;
};

export type MediaPersistStorage<T> = {
  set: (key: string, value: T) => Promise<void>;
};

export function getGeneratedImageUrl(img: GeneratedImageLike): string {
  return (img.imageUrl || img.fifeUrl || "").trim();
}

export function hasGeneratedImageData(img: GeneratedImageLike | null | undefined): boolean {
  return !!(img && (img.imageBytes || getGeneratedImageUrl(img)));
}

/** Ưu tiên base64; fallback link (chỉ dùng hiển thị / preview). */
export function getGeneratedImagePreviewSrc(img: GeneratedImageLike): string {
  if (img.imageBytes) {
    return `data:${img.mimeType || "image/jpeg"};base64,${img.imageBytes}`;
  }
  return getGeneratedImageUrl(img);
}

/** Ưu tiên base64; fallback videoUri (chỉ dùng hiển thị / preview). */
export function getGeneratedVideoPreviewSrc(video: GeneratedVideoLike): string | null {
  if (video.videoBytes) {
    return `data:${video.mimeType || "video/mp4"};base64,${video.videoBytes}`;
  }
  return video.videoUri || null;
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
    return base64ToBlob(img.imageBytes, img.mimeType || "image/png");
  }
  const url = getGeneratedImageUrl(img);
  if (!url) {
    throw new Error("Thiếu dữ liệu ảnh (URL hoặc base64)");
  }
  return uriToBlob(url);
}

export async function downloadGeneratedImage(
  img: GeneratedImageLike,
  fileName: string
): Promise<void> {
  const blob = await generatedImageToBlob(img);
  triggerBlobDownload(blob, fileName);
}

/** Ưu tiên videoBytes (local); fallback videoUri (data URL hoặc HTTP + proxy). */
export async function generatedVideoToBlob(video: GeneratedVideoLike): Promise<Blob> {
  if (video.videoBytes) {
    return base64ToBlob(
      stripBase64Payload(video.videoBytes),
      video.mimeType || "video/mp4"
    );
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
