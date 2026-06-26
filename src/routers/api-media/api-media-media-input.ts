/**
 * Chuẩn hoá ảnh API Media: bắt buộc base64, luôn nén (khớp compressGenerationImage), output ≤ 5MB.
 */
import { compressApiMediaImageBuffer } from "./api-media-compress-image";
import { ApiMediaNormalizedImage } from "./api-media-validate";
import { badRequest, ApiMediaMediaInput } from "./api-media-validate.shared";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function decodeBase64Payload(raw: string): Buffer | null {
  try {
    const cleaned = raw.replace(/\s/g, "");
    const buf = Buffer.from(cleaned, "base64");
    if (!buf.length) return null;
    return buf;
  } catch {
    return null;
  }
}

function parseImageBase64Input(
  input: string,
  fieldLabel: string
): { buffer: Buffer; mime: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    badRequest(`${fieldLabel} rỗng`);
  }
  if (isHttpUrl(trimmed)) {
    badRequest(`${fieldLabel} phải là base64 (data:image/... hoặc chuỗi base64), không hỗ trợ URL`);
  }

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) {
      badRequest(`${fieldLabel} data URL không hợp lệ — cần data:image/...;base64,...`);
    }
    const buffer = decodeBase64Payload(match[2]);
    if (!buffer) {
      badRequest(`${fieldLabel} base64 không hợp lệ`);
    }
    return { buffer, mime: match[1] };
  }

  const buffer = decodeBase64Payload(trimmed);
  if (!buffer || buffer.length < 32) {
    badRequest(`${fieldLabel} phải là chuỗi base64 hợp lệ`);
  }
  return { buffer, mime: "image/jpeg" };
}

function toNormalizedImage(buffer: Buffer, mime: string): ApiMediaNormalizedImage {
  const b64 = buffer.toString("base64");
  return {
    imageBytes: `data:${mime};base64,${b64}`,
    mimeType: mime,
  };
}

export async function normalizeApiMediaImageInput(
  item: ApiMediaMediaInput,
  fieldLabel: string
): Promise<ApiMediaNormalizedImage> {
  if (typeof item === "string") {
    const parsed = parseImageBase64Input(item, fieldLabel);
    const compressed = await compressApiMediaImageBuffer(parsed.buffer, parsed.mime, fieldLabel);
    return toNormalizedImage(compressed.buffer, compressed.mime);
  }

  const raw = item.imageBytes || item.videoBytes;
  if (!raw?.trim()) {
    badRequest(`${fieldLabel} thiếu imageBytes`);
  }
  const parsed = parseImageBase64Input(raw, fieldLabel);
  const compressed = await compressApiMediaImageBuffer(parsed.buffer, parsed.mime, fieldLabel);
  return toNormalizedImage(compressed.buffer, compressed.mime);
}

export async function normalizeApiMediaImageInputs(
  items: ApiMediaMediaInput[] | undefined,
  fieldName: string
): Promise<ApiMediaNormalizedImage[]> {
  if (!items?.length) return [];
  const results: ApiMediaNormalizedImage[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await normalizeApiMediaImageInput(items[i], `${fieldName}[${i}]`));
  }
  return results;
}
