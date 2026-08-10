/**
 * Chuẩn bị ảnh gửi generate video Shopee — giống affiliate-video:
 * nén/resize rồi trả `{ imageBytes, mimeType }`.
 */
import { compressUploadImage } from "../../lib/helpers/image";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 72;

/** Flow2 video_mode=component: tối đa 3 ảnh tham chiếu. */
export const MAX_SHOPEE_VIDEO_REFERENCE_IMAGES = 3;

/**
 * Ghép ảnh nhân vật (tùy chọn) + ảnh sản phẩm cho request generate.
 * Luôn giữ product ở cuối; số ảnh nhân vật bị cắt để tổng ≤ 3.
 * Không có ảnh nhân vật → chỉ gửi ảnh sản phẩm.
 */
export function buildShopeeVideoImages<T>(
  characterImages: T[],
  productImage: T
): T[] {
  const maxChars = Math.max(0, MAX_SHOPEE_VIDEO_REFERENCE_IMAGES - 1);
  const chars = characterImages.filter(Boolean).slice(0, maxChars);
  return [...chars, productImage];
}

export type ShopeeGenerationImage = {
  imageBytes: string;
  mimeType: string;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) reject(new Error("Không đọc được base64 ảnh"));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function compressBlobToGenerationImage(blob: Blob, fileName: string): Promise<ShopeeGenerationImage> {
  const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
  let prepared: File | Blob = file;
  try {
    if (file.type !== "image/gif") {
      prepared = (await compressUploadImage(file, {
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        quality: JPEG_QUALITY,
        type: "JPEG",
      })) as File;
    }
  } catch (err) {
    console.warn("[shopee-image] Compress failed, using original", err);
  }
  const imageBytes = await readBlobAsBase64(prepared);
  const mimeType =
    (prepared as File).type ||
    blob.type ||
    "image/jpeg";
  return { imageBytes, mimeType };
}

/** Chấp nhận data URL, blob:, __idb_media__:, hoặc http(s) → imageBytes nén. */
export async function prepareShopeeImageInput(input: string): Promise<ShopeeGenerationImage> {
  const value = (input || "").trim();
  if (!value) throw new Error("Thiếu ảnh");

  if (value.startsWith("data:")) {
    return compressBlobToGenerationImage(dataUrlToBlob(value), "character.jpg");
  }

  if (value.startsWith("blob:")) {
    const res = await fetch(value);
    if (!res.ok) throw new Error(`Không đọc được blob ảnh (${res.status})`);
    const blob = await res.blob();
    return compressBlobToGenerationImage(blob, "character.jpg");
  }

  // Ref IndexedDB media-blobs (ảnh nhân vật đã migrate khỏi data:)
  if (value.startsWith("__idb_media__:")) {
    const { resolveMediaToBlob } = await import("./media-blob-store");
    const blob = await resolveMediaToBlob(value);
    if (!blob || blob.size <= 0) {
      throw new Error("Không tìm thấy ảnh nhân vật trong IndexedDB");
    }
    return compressBlobToGenerationImage(blob, "character.jpg");
  }

  if (/^https?:\/\//i.test(value)) {
    const res = await fetch(value);
    if (!res.ok) throw new Error(`Không tải được ảnh sản phẩm (${res.status})`);
    const blob = await res.blob();
    return compressBlobToGenerationImage(blob, "product.jpg");
  }

  // raw base64 (chuỗi ngắn hơn data URL) — không chấp nhận blob: prefix sai
  if (value.length > 2048 || value.includes("://")) {
    throw new Error("Định dạng ảnh không hỗ trợ");
  }
  return {
    imageBytes: value.replace(/^data:[^;]+;base64,/, ""),
    mimeType: "image/jpeg",
  };
}
