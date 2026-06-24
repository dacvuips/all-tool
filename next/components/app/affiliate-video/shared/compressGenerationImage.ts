/**
 * Nén + resize ảnh upload dùng cho generate image/video trong affiliate-video.
 * Luôn nén (trừ GIF) để giảm RAM / IndexedDB / payload API.
 */
import { compressUploadImage } from "../../../../lib/helpers/image";

export const GENERATION_IMAGE_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const GENERATION_IMAGE_ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";

/** Max cạnh dài khi resize — đủ cho model generate, tránh ảnh 4K gây OOM. */
export const GENERATION_IMAGE_MAX_DIMENSION = 1920;
export const GENERATION_IMAGE_JPEG_QUALITY = 72;

const COMPRESS_OPTIONS = {
  width: GENERATION_IMAGE_MAX_DIMENSION,
  height: GENERATION_IMAGE_MAX_DIMENSION,
  quality: GENERATION_IMAGE_JPEG_QUALITY,
  type: "JPEG" as const,
};

export function isAcceptedGenerationImageFile(file: File): boolean {
  return (
    GENERATION_IMAGE_ACCEPTED_TYPES.includes(file.type) ||
    /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

/** Resize + nén file ảnh. GIF giữ nguyên (tránh mất animation). */
export async function prepareGenerationImageFile(file: File): Promise<File> {
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) {
    return file;
  }
  try {
    const compressed = await compressUploadImage(file, COMPRESS_OPTIONS);
    return compressed as File;
  } catch (err) {
    console.warn("[compressGenerationImage] Compress failed, using original:", err);
    return file;
  }
}

export function readFileAsBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type GenerationImageBase64 = {
  imageBytes: string;
  mimeType: string;
};

/** Nén ảnh rồi đọc base64 — dùng cho mọi upload ảnh generate. */
export async function fileToGenerationImageBase64(file: File): Promise<GenerationImageBase64> {
  const prepared = await prepareGenerationImageFile(file);
  const imageBytes = await readFileAsBase64(prepared);
  const mimeType =
    prepared.type ||
    (prepared.name?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  return { imageBytes, mimeType };
}
