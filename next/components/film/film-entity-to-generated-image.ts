/**
 * Map film entity image fields → GeneratedImageData (SceneCardImageTab / download).
 * + Convert entity → FilmMediaImageRef cho enqueue generate.
 */
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { prepareGenerationImageFile } from "../app/affiliate-video/shared/compressGenerationImage";
import {
  getGeneratedImagePreviewSrc,
  getGeneratedVideoPreviewSrc,
} from "../app/affiliate-video/shared/generatedMediaUtils";
import { toDownloadProxyUrl } from "../app/affiliate-video/shared/videoDownloadUtils";
import {
  getFilmEntityImageSrc,
  type FilmMediaImageRef,
} from "./api/generate-film-media";

export function filmEntityToGeneratedImage(entity: {
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
}): GeneratedImageData | null {
  const src = getFilmEntityImageSrc(entity);
  if (!src) return null;
  return {
    mimeType: entity.imageBlob?.type || "image/jpeg",
    fifeUrl: src,
    imageUrl: entity.imageUrl || src,
    previewUrl: src,
    mediaBlob: entity.imageBlob || undefined,
  };
}

export function generatedImageDataToFilmStored(image: GeneratedImageData): {
  imageUrl: string;
  imageBlob?: Blob;
} {
  let imageBlob = image.mediaBlob;
  if (!imageBlob && (image.imageBytes || "").trim()) {
    try {
      const pure = image.imageBytes!.replace(/^data:[^;]+;base64,/, "").trim();
      const binary = atob(pure);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      imageBlob = new Blob([bytes], { type: image.mimeType || "image/jpeg" });
    } catch {
      // fallback data-url
    }
  }
  const imageUrl =
    getGeneratedImagePreviewSrc(image) ||
    image.previewUrl ||
    image.imageUrl ||
    image.fifeUrl ||
    "";
  return { imageUrl: imageBlob ? "" : imageUrl, imageBlob: imageBlob || undefined };
}

export function generatedVideoDataToFilmStored(video: {
  videoUri?: string | null;
  videoBytes?: string | null;
  mediaBlob?: Blob;
  previewUrl?: string;
  mimeType?: string;
}): {
  videoUrl: string;
  videoBlob?: Blob;
} {
  let videoBlob = video.mediaBlob;
  if (!videoBlob && (video.videoBytes || "").trim()) {
    try {
      const pure = String(video.videoBytes).replace(/^data:[^;]+;base64,/, "").trim();
      const binary = atob(pure);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      videoBlob = new Blob([bytes], { type: video.mimeType || "video/mp4" });
    } catch {
      // ignore
    }
  }
  if (videoBlob) {
    return { videoUrl: "", videoBlob };
  }
  const videoUrl = String(
    getGeneratedVideoPreviewSrc(video as any) ||
      video.previewUrl ||
      video.videoUri ||
      ""
  ).trim();
  return { videoUrl, videoBlob: undefined };
}

async function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("read blob fail"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType?: string): Blob | null {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || match[1] || "image/jpeg" });
  } catch {
    return null;
  }
}

/** Resize ≤1920 + JPEG 72% (GIF giữ nguyên). */
async function blobToCompressedMediaRef(blob: Blob, fileName = "film-ref.jpg"): Promise<FilmMediaImageRef> {
  const type = blob.type || "image/jpeg";
  const file =
    blob instanceof File
      ? blob
      : new File([blob], fileName, { type });
  const prepared = await prepareGenerationImageFile(file);
  return {
    imageBytes: await blobToBase64Payload(prepared),
    mimeType: prepared.type || type || "image/jpeg",
  };
}

/**
 * Entity ảnh (blob / url) → ref gửi API generate (reference props + character).
 * Nén trước khi encode base64 — cùng chuẩn affiliate (1920px / JPEG 72).
 */
export async function filmEntityToMediaImageRef(entity: {
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
}): Promise<FilmMediaImageRef | null> {
  if (entity.imageBlob instanceof Blob && entity.imageBlob.size > 0) {
    return blobToCompressedMediaRef(entity.imageBlob);
  }

  const src = getFilmEntityImageSrc(entity);
  if (!src) return null;

  const dataMatch = src.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    const blob = dataUrlToBlob(src, dataMatch[1]);
    if (blob && blob.size > 0) return blobToCompressedMediaRef(blob);
    return { imageBytes: dataMatch[2], mimeType: dataMatch[1] || "image/jpeg" };
  }

  try {
    const fetchUrl = /^https?:\/\//i.test(src) ? toDownloadProxyUrl(src, true) : src;
    const res = await fetch(fetchUrl, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) return blobToCompressedMediaRef(blob);
    }
  } catch {
    // fall through
  }

  return src;
}

/** Lấy tối đa `limit` ảnh reference từ entity list. */
export async function collectFilmMediaImageRefs(
  entities: Array<{
    imageBlob?: Blob | null;
    imageUrl?: string;
    imageUrls?: string[];
  }>,
  limit = 10
): Promise<FilmMediaImageRef[]> {
  const out: FilmMediaImageRef[] = [];
  for (const e of entities) {
    if (out.length >= limit) break;
    const ref = await filmEntityToMediaImageRef(e);
    if (ref) out.push(ref);
  }
  return out;
}

/**
 * Slot Tạo video → images[] theo thứ tự slot (bỏ slot trống).
 * Không bắt buộc đủ ảnh — chỉ prompt bắt buộc ở caller.
 * (Start: 0–1; Start-End: 0–2 start/end; Thành phần: 0–3 refs).
 */
export async function collectFilmVideoRefSlotImageRefs(
  slots: Array<{
    imageBlob?: Blob | null;
    imageUrl?: string;
    name?: string;
  } | null | undefined>,
  maxCount: number
): Promise<FilmMediaImageRef[]> {
  const list = Array.from({ length: maxCount }, (_, i) => slots?.[i] || null);
  const out: FilmMediaImageRef[] = [];
  for (let i = 0; i < maxCount; i++) {
    const slot = list[i];
    if (
      !slot ||
      (!(slot.imageBlob instanceof Blob && slot.imageBlob.size > 0) &&
        !(slot.imageUrl || "").trim())
    ) {
      continue;
    }
    const ref = await filmEntityToMediaImageRef(slot);
    if (ref) out.push(ref);
  }
  return out;
}
