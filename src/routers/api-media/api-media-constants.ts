/** Hằng số giới hạn đầu vào API Media — khớp UI hướng dẫn, tách khỏi luồng app. */

export const API_MEDIA_ASPECT_RATIOS = ["16:9", "9:16"] as const;
export type ApiMediaAspectRatio = (typeof API_MEDIA_ASPECT_RATIOS)[number];

export const API_MEDIA_IMAGE_MODELS = ["NANO_BANANA_PRO", "NANO_BANANA"] as const;

/** Image to Image — tối đa số ảnh reference upload */
export const API_MEDIA_IMAGE_INPUT_MAX = 3;

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
