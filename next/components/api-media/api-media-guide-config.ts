/** Logic cấu hình UI hướng dẫn API Media — khớp backend api-media-validate */

export type CreationType = "image" | "video";
export type InputSource = "text" | "image";
export type VideoMode = "frame" | "component";
export type FrameImageCount = "1" | "2";
export type OmniComponentInput = "images_only" | "with_video";
export type OmniDuration = 4 | 6 | 8 | 10;
export type ImageAspectRatio = "16:9" | "9:16";
export type VideoAspectRatio = "16:9" | "9:16";
export type ImageModelId = "NANO_BANANA_PRO" | "NANO_BANANA";
export type VideoQualityId = "lite" | "fast" | "lite_relaxed" | "omni_flash";
export type CodeLang = "curl" | "python";
export type UpsampleImageResolution = "2K" | "4K";

export type ApiMediaGuideConfig = {
  creationType: CreationType;
  inputSource: InputSource;
  imageInputCount: number;
  videoMode: VideoMode;
  frameImageCount: FrameImageCount;
  componentImageCount: number;
  omniComponentInput: OmniComponentInput;
  omniDuration: OmniDuration;
  imageAspectRatio: ImageAspectRatio;
  videoAspectRatio: VideoAspectRatio;
  imageModel: ImageModelId;
  videoQuality: VideoQualityId;
  upsampleImageResolution: UpsampleImageResolution;
};

export const IMAGE_INPUT_COUNT_MAX = 3;

export const DEFAULT_API_MEDIA_GUIDE_CONFIG: ApiMediaGuideConfig = {
  creationType: "image",
  inputSource: "text",
  imageInputCount: 1,
  videoMode: "frame",
  frameImageCount: "1",
  componentImageCount: 1,
  omniComponentInput: "images_only",
  omniDuration: 10,
  imageAspectRatio: "16:9",
  videoAspectRatio: "16:9",
  imageModel: "NANO_BANANA_PRO",
  videoQuality: "lite_relaxed",
  upsampleImageResolution: "4K",
};

export const IMAGE_MODEL_OPTIONS: { id: ImageModelId; label: string }[] = [
  { id: "NANO_BANANA_PRO", label: "Nano Banana Pro" },
  { id: "NANO_BANANA", label: "Nano Banana 2" },
];

export const VIDEO_MODEL_OPTIONS: { id: VideoQualityId; label: string; disabled?: boolean }[] = [
  { id: "lite", label: "Veo 3.1 - Lite", disabled: true },
  { id: "fast", label: "Veo 3.1 - Fast", disabled: true },
  { id: "lite_relaxed", label: "Veo 3.1 Lite [Lower Priority]" },
  { id: "omni_flash", label: "Omni Flash", disabled: true },
];

export const OMNI_DURATIONS: OmniDuration[] = [4, 6, 8, 10];
/** Omni Thành phần + Có video — cố định 8s (không chọn được) */
export const OMNI_WITH_VIDEO_DURATION_S = 8 as const;

export function isOmniQuality(quality: VideoQualityId): boolean {
  return quality === "omni_flash";
}

export function isOmniComponentWithVideo(config: ApiMediaGuideConfig): boolean {
  return (
    isOmniQuality(config.videoQuality) &&
    config.inputSource === "image" &&
    config.videoMode === "component" &&
    config.omniComponentInput === "with_video"
  );
}

export function resolveOmniDuration(config: ApiMediaGuideConfig): OmniDuration {
  if (isOmniComponentWithVideo(config)) {
    return OMNI_WITH_VIDEO_DURATION_S;
  }
  return config.omniDuration;
}

export function clampImageInputCount(count: number): number {
  return Math.min(IMAGE_INPUT_COUNT_MAX, Math.max(1, count));
}

export function getComponentImageCountRange(config: ApiMediaGuideConfig): {
  min: number;
  max: number;
} {
  if (config.videoQuality !== "omni_flash" || config.videoMode !== "component") {
    return { min: 1, max: 3 };
  }
  if (config.omniComponentInput === "with_video") {
    return { min: 1, max: 5 };
  }
  return { min: 1, max: 7 };
}

export function clampComponentImageCount(config: ApiMediaGuideConfig, count: number): number {
  const { min, max } = getComponentImageCountRange(config);
  return Math.min(max, Math.max(min, count));
}

export function getVideoModeHint(config: ApiMediaGuideConfig): string | null {
  if (config.creationType !== "video" || config.inputSource !== "image") return null;

  if (isOmniQuality(config.videoQuality)) {
    if (config.videoMode === "frame") {
      return "Omni Khung hình — tùy chọn 1 ảnh startImage, abra_i2v_{duration}s, không video/endImage";
    }
    if (config.omniComponentInput === "with_video") {
      return `Omni Thành phần — tối đa 5 ảnh + 1 video (${OMNI_WITH_VIDEO_DURATION_S}s cố định), abra_edit + videoInput`;
    }
    return "Omni Thành phần — tối đa 7 ảnh hoặc chỉ prompt, video_duration_s tùy chỉnh";
  }

  if (config.videoMode === "frame") {
    return config.frameImageCount === "1"
      ? 'video_mode: "frame" — ảnh 1 = startImage'
      : 'video_mode: "frame" — ảnh 1 = startImage, ảnh 2 = endImage';
  }
  return 'video_mode: "component" — 1-3 ảnh referenceImages';
}

export function showOmniDuration(config: ApiMediaGuideConfig): boolean {
  return (
    config.creationType === "video" &&
    isOmniQuality(config.videoQuality) &&
    !isOmniComponentWithVideo(config)
  );
}

export function showOmniDurationFixed(config: ApiMediaGuideConfig): boolean {
  return config.creationType === "video" && isOmniComponentWithVideo(config);
}

export function showOmniComponentInput(config: ApiMediaGuideConfig): boolean {
  return (
    config.creationType === "video" &&
    config.inputSource === "image" &&
    config.videoMode === "component" &&
    isOmniQuality(config.videoQuality)
  );
}

function placeholderImages(count: number, prefix: string): string[] {
  return Array.from(
    { length: count },
    (_, i) => `data:image/jpeg;base64,${prefix}_${i + 1}_BASE64_HERE`
  );
}

export function buildApiMediaRequestBody(config: ApiMediaGuideConfig): Record<string, unknown> {
  const aspectRatio =
    config.creationType === "image" ? config.imageAspectRatio : config.videoAspectRatio;

  const body: Record<string, unknown> = {
    prompt:
      config.creationType === "image"
        ? "A beautiful cinematic photo, ultra detailed, natural lighting"
        : "A cinematic realistic video, smooth camera movement",
    config: {
      aspectRatio,
    },
  };

  if (config.creationType === "image") {
    (body.config as Record<string, unknown>).imageModel = config.imageModel;
    if (config.inputSource === "image") {
      const count = clampImageInputCount(config.imageInputCount);
      body.images = placeholderImages(count, "IMAGE");
    }
    return body;
  }

  const cfg = body.config as Record<string, unknown>;
  cfg.videoQuality = config.videoQuality;

  const isOmni = isOmniQuality(config.videoQuality);

  if (isOmni) {
    cfg.videoDurationS = resolveOmniDuration(config);
  }

  if (config.inputSource === "image") {
    cfg.videoMode = config.videoMode;

    if (isOmni && config.videoMode === "component") {
      cfg.imagesOnly = config.omniComponentInput === "images_only";
    }

    if (config.videoMode === "frame") {
      if (isOmni) {
        body.images = ["data:image/jpeg;base64,IMAGE_1_BASE64_HERE"];
      } else if (config.frameImageCount === "1") {
        body.images = ["data:image/jpeg;base64,START_IMAGE_BASE64_HERE"];
      } else {
        body.images = [
          "data:image/jpeg;base64,START_IMAGE_BASE64_HERE",
          "data:image/jpeg;base64,END_IMAGE_BASE64_HERE",
        ];
      }
    } else {
      const count = clampComponentImageCount(config, config.componentImageCount);
      body.images = placeholderImages(count, "IMAGE");
      if (isOmni && config.omniComponentInput === "with_video") {
        body.videos = ["data:video/mp4;base64,VIDEO_BASE64_HERE"];
      }
    }
  }

  return body;
}

export function getCreateJobTitle(config: ApiMediaGuideConfig): string {
  if (config.creationType === "image") {
    return config.inputSource === "text"
      ? "Text to Image — POST /api/api-media"
      : "Image to Image — POST /api/api-media";
  }

  if (isOmniQuality(config.videoQuality)) {
    if (config.inputSource === "text") {
      return "Omni Flash — Text to Video — POST /api/api-media";
    }
    if (config.videoMode === "frame") {
      return "Omni Flash — Khung hình — POST /api/api-media";
    }
    return config.omniComponentInput === "with_video"
      ? "Omni Flash — Thành phần (ảnh + video) — POST /api/api-media"
      : "Omni Flash — Thành phần — POST /api/api-media";
  }

  if (config.inputSource === "text") {
    return "Text to Video — POST /api/api-media";
  }
  if (config.videoMode === "frame") {
    return config.frameImageCount === "1"
      ? "Image to Video (startImage) — POST /api/api-media"
      : "Image to Video (start + end) — POST /api/api-media";
  }
  return "Image to Video (referenceImages) — POST /api/api-media";
}

export function showImageInputCountDropdown(config: ApiMediaGuideConfig): boolean {
  return config.creationType === "image" && config.inputSource === "image";
}

export function showReferenceCountDropdown(config: ApiMediaGuideConfig): boolean {
  if (config.creationType !== "video" || config.inputSource !== "image") return false;
  if (config.videoMode === "component") return true;
  return config.videoMode === "frame" && !isOmniQuality(config.videoQuality);
}

export function showUpsampleImageCard(config: ApiMediaGuideConfig): boolean {
  return config.creationType === "image";
}

export function showUpsampleVideoCard(config: ApiMediaGuideConfig): boolean {
  return config.creationType === "video";
}
