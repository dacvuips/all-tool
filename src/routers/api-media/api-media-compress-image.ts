/**
 * Nén + resize ảnh API Media — khớp next/components/app/affiliate-video/shared/compressGenerationImage.ts
 * Luôn nén mọi ảnh (trừ GIF), output ≤ API_MEDIA_IMAGE_MAX_BYTES.
 */
import Jimp from "jimp";
import {
  API_MEDIA_IMAGE_ACCEPTED_MIMES,
  API_MEDIA_IMAGE_JPEG_QUALITY,
  API_MEDIA_IMAGE_MAX_BYTES,
  API_MEDIA_IMAGE_MAX_DIMENSION,
} from "./api-media-constants";
import { badRequest } from "./api-media-validate.shared";

function isGifMime(mime: string): boolean {
  return mime.toLowerCase() === "image/gif";
}

function isAcceptedImageMime(mime: string): boolean {
  return (API_MEDIA_IMAGE_ACCEPTED_MIMES as readonly string[]).includes(mime.toLowerCase());
}

/** Scale ảnh nằm trong hộp maxDim × maxDim (giữ tỉ lệ) — tương đương react-image-file-resizer contain. */
function containMaxDimension(image: Jimp, maxDim: number): Jimp {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  if (w <= maxDim && h <= maxDim) {
    return image.clone();
  }
  const scale = Math.min(maxDim / w, maxDim / h);
  return image.clone().resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
}

async function encodeJpeg(image: Jimp, quality: number): Promise<Buffer> {
  return image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
}

/**
 * Nén chuẩn generate: resize max 1920, JPEG quality 72.
 * GIF giữ nguyên (tránh mất animation).
 */
export async function compressApiMediaImageBuffer(
  buffer: Buffer,
  mime: string,
  fieldLabel: string
): Promise<{ buffer: Buffer; mime: string }> {
  const normalizedMime = mime.toLowerCase();

  if (!isAcceptedImageMime(normalizedMime)) {
    badRequest(
      `${fieldLabel}: định dạng không hỗ trợ. Chấp nhận: ${API_MEDIA_IMAGE_ACCEPTED_MIMES.join(", ")}`
    );
  }

  if (isGifMime(normalizedMime)) {
    if (buffer.length > API_MEDIA_IMAGE_MAX_BYTES) {
      badRequest(
        `${fieldLabel}: GIF vượt ${Math.round(API_MEDIA_IMAGE_MAX_BYTES / 1024 / 1024)}MB — vui lòng giảm kích thước`
      );
    }
    return { buffer, mime: normalizedMime };
  }

  let image: Jimp;
  try {
    image = await Jimp.read(buffer);
  } catch {
    badRequest(`${fieldLabel}: không đọc được dữ liệu ảnh`);
  }

  let working = containMaxDimension(image, API_MEDIA_IMAGE_MAX_DIMENSION);
  let quality = API_MEDIA_IMAGE_JPEG_QUALITY;
  let out = await encodeJpeg(working, quality);

  if (out.length <= API_MEDIA_IMAGE_MAX_BYTES) {
    return { buffer: out, mime: "image/jpeg" };
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    if (quality > 40) {
      quality -= 8;
      out = await encodeJpeg(working, quality);
      if (out.length <= API_MEDIA_IMAGE_MAX_BYTES) {
        return { buffer: out, mime: "image/jpeg" };
      }
      continue;
    }

    const ratio = Math.sqrt(API_MEDIA_IMAGE_MAX_BYTES / out.length) * 0.92;
    if (ratio >= 0.98) break;
    const w = Math.max(256, Math.floor(working.bitmap.width * ratio));
    const h = Math.max(256, Math.floor(working.bitmap.height * ratio));
    working = working.resize(w, h, Jimp.RESIZE_BILINEAR);
    quality = API_MEDIA_IMAGE_JPEG_QUALITY;
    out = await encodeJpeg(working, quality);
    if (out.length <= API_MEDIA_IMAGE_MAX_BYTES) {
      return { buffer: out, mime: "image/jpeg" };
    }
  }

  badRequest(
    `${fieldLabel}: ảnh vẫn vượt ${Math.round(API_MEDIA_IMAGE_MAX_BYTES / 1024 / 1024)}MB sau khi nén — vui lòng giảm kích thước ảnh đầu vào`
  );
}
