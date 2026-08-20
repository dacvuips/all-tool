/**
 * Map film entity image fields → GeneratedImageData (SceneCardImageTab / download).
 * + Convert entity → FilmMediaImageRef cho enqueue generate.
 */
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import {
  getGeneratedImagePreviewSrc,
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

/**
 * Entity ảnh (blob / url) → ref gửi API generate (reference props + character).
 */
export async function filmEntityToMediaImageRef(entity: {
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
}): Promise<FilmMediaImageRef | null> {
  if (entity.imageBlob instanceof Blob && entity.imageBlob.size > 0) {
    const imageBytes = await blobToBase64Payload(entity.imageBlob);
    return {
      imageBytes,
      mimeType: entity.imageBlob.type || "image/jpeg",
    };
  }

  const src = getFilmEntityImageSrc(entity);
  if (!src) return null;

  const dataMatch = src.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return { imageBytes: dataMatch[2], mimeType: dataMatch[1] || "image/jpeg" };
  }

  try {
    const fetchUrl = /^https?:\/\//i.test(src) ? toDownloadProxyUrl(src, true) : src;
    const res = await fetch(fetchUrl, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        return {
          imageBytes: await blobToBase64Payload(blob),
          mimeType: blob.type || "image/jpeg",
        };
      }
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
