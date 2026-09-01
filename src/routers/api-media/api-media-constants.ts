/** Hằng số giới hạn đầu vào API Media — khớp UI hướng dẫn, tách khỏi luồng app. */

export const API_MEDIA_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
export type ApiMediaAspectRatio = (typeof API_MEDIA_ASPECT_RATIOS)[number];

/** Chuẩn hóa aspect ratio Flow2 — fallback khi client gửi giá trị lạ. */
export function normalizeApiMediaAspectRatio(
  value: unknown,
  fallback: ApiMediaAspectRatio = "16:9"
): ApiMediaAspectRatio {
  const ratio = String(value ?? "").trim();
  return (API_MEDIA_ASPECT_RATIOS as readonly string[]).includes(ratio)
    ? (ratio as ApiMediaAspectRatio)
    : fallback;
}

export const API_MEDIA_IMAGE_MODELS = ["NANO_BANANA_PRO", "NANO_BANANA"] as const;

/** Image to Image — tối đa số ảnh reference upload */
export const API_MEDIA_IMAGE_INPUT_MAX = 3;
/** Dung lượng tối đa mỗi ảnh sau nén (bytes) — khớp payload generate */
export const API_MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Max cạnh dài khi resize — khớp compressGenerationImage.ts */
export const API_MEDIA_IMAGE_MAX_DIMENSION = 1920;
export const API_MEDIA_IMAGE_JPEG_QUALITY = 72;

export const API_MEDIA_IMAGE_ACCEPTED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const API_MEDIA_VIDEO_QUALITIES = [
  "lite",
  "fast",
  "lite_relaxed",
  "omni_flash",
] as const;
export type ApiMediaVideoQuality = (typeof API_MEDIA_VIDEO_QUALITIES)[number];

export const API_MEDIA_OMNI_DURATIONS = [4, 6, 8, 10] as const;
export type ApiMediaOmniDuration = (typeof API_MEDIA_OMNI_DURATIONS)[number];

export const API_MEDIA_VEO_COMPONENT_IMAGE_MAX = 3;
export const API_MEDIA_VEO_FRAME_IMAGE_MAX = 2;

export const API_MEDIA_OMNI_FRAME_IMAGE_MAX = 1;
export const API_MEDIA_OMNI_COMPONENT_IMAGE_MAX = 7;
export const API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_IMAGE_MAX = 5;
export const API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_COUNT = 1;
/** Omni Thành phần + có video: thời lượng cố định 8 giây */
export const API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_DURATION_S = 8;

export function isApiMediaOmniQuality(quality?: string | null): boolean {
  return String(quality || "").trim().toLowerCase() === "omni_flash";
}
