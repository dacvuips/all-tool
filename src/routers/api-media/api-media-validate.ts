import {
  assertFlow2VideoImageCount,
  Flow2VideoMode,
  FLOW2_VIDEO_MODE,
  normalizeFlow2VideoMode,
  resolveFlow2VideoMode,
} from "./flow2/video-mode";
import {
  API_MEDIA_ASPECT_RATIOS,
  API_MEDIA_IMAGE_INPUT_MAX,
  API_MEDIA_IMAGE_MODELS,
  API_MEDIA_OMNI_COMPONENT_IMAGE_MAX,
  API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_COUNT,
  API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_DURATION_S,
  API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_IMAGE_MAX,
  API_MEDIA_OMNI_DURATIONS,
  API_MEDIA_OMNI_FRAME_IMAGE_MAX,
  ApiMediaAspectRatio,
  ApiMediaOmniDuration,
  ApiMediaVideoQuality,
  isApiMediaOmniQuality,
} from "./api-media-constants";

export type ApiMediaMediaInput = string | { imageBytes?: string; videoBytes?: string; mimeType?: string };

export type ApiMediaNormalizedImage = string | { imageBytes: string; mimeType?: string };
export type ApiMediaNormalizedVideo = string | { imageBytes: string; mimeType?: string };

export function normalizeApiMediaImages(
  items?: ApiMediaMediaInput[]
): ApiMediaNormalizedImage[] {
  if (!items?.length) return [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    const bytes = item.imageBytes || item.videoBytes;
    if (!bytes?.trim()) {
      badRequest("Ảnh thiếu imageBytes");
    }
    return { imageBytes: bytes.trim(), mimeType: item.mimeType };
  });
}

export function normalizeApiMediaVideos(
  items?: ApiMediaMediaInput[]
): ApiMediaNormalizedVideo[] {
  if (!items?.length) return [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    const bytes = item.videoBytes || item.imageBytes;
    if (!bytes?.trim()) {
      badRequest("Video thiếu videoBytes");
    }
    return { imageBytes: bytes.trim(), mimeType: item.mimeType || "video/mp4" };
  });
}

export type ApiMediaImageConfig = {
  aspectRatio?: ApiMediaAspectRatio;
  imageModel?: string;
  noText?: boolean;
  numberOfImages?: number;
};

export type ApiMediaVideoConfig = {
  aspectRatio?: ApiMediaAspectRatio;
  videoQuality?: ApiMediaVideoQuality | string;
  videoMode?: Flow2VideoMode | string;
  videoDurationS?: number;
  /** Omni component: false = có kèm video đầu vào */
  imagesOnly?: boolean;
  generateAudio?: boolean;
  noText?: boolean;
};

export type ApiMediaImageRequest = {
  prompt: string;
  images?: ApiMediaNormalizedImage[];
  config?: ApiMediaImageConfig;
};

export type ApiMediaVideoRequest = {
  prompt: string;
  images?: ApiMediaNormalizedImage[];
  videos?: ApiMediaNormalizedVideo[];
  video_mode?: string;
  config?: ApiMediaVideoConfig;
};

function badRequest(message: string): never {
  const err: any = new Error(message);
  err.statusCode = 400;
  throw err;
}

function assertAspectRatio(value: unknown): ApiMediaAspectRatio | undefined {
  if (value == null || value === "") return undefined;
  const ratio = String(value).trim() as ApiMediaAspectRatio;
  if (!API_MEDIA_ASPECT_RATIOS.includes(ratio)) {
    badRequest(`aspectRatio không hợp lệ. Hỗ trợ: ${API_MEDIA_ASPECT_RATIOS.join(", ")}`);
  }
  return ratio;
}

function normalizeMediaArray(
  items: unknown,
  fieldName: string
): Array<string | { imageBytes: string; mimeType?: string }> {
  if (!items) return [];
  if (!Array.isArray(items)) {
    badRequest(`${fieldName} phải là mảng`);
  }
  return items.map((item, index) => {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) badRequest(`${fieldName}[${index}] rỗng`);
      return trimmed;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const bytes =
        (typeof record.imageBytes === "string" && record.imageBytes) ||
        (typeof record.videoBytes === "string" && record.videoBytes);
      if (!bytes?.trim()) {
        badRequest(`${fieldName}[${index}] thiếu imageBytes hoặc videoBytes`);
      }
      return {
        imageBytes: bytes.trim(),
        mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
      };
    }
    badRequest(`${fieldName}[${index}] không hợp lệ`);
  });
}

function parseOmniDuration(value: unknown, required: boolean): ApiMediaOmniDuration | undefined {
  if (value == null || value === "") {
    if (required) badRequest("Thiếu videoDurationS cho Omni Flash (4, 6, 8 hoặc 10 giây)");
    return undefined;
  }
  const n = Number(value);
  if (!API_MEDIA_OMNI_DURATIONS.includes(n as ApiMediaOmniDuration)) {
    badRequest(`videoDurationS không hợp lệ. Omni hỗ trợ: ${API_MEDIA_OMNI_DURATIONS.join(", ")} giây`);
  }
  return n as ApiMediaOmniDuration;
}

function resolveVideoMode(
  explicit: string | undefined,
  imageCount: number,
  isOmni: boolean,
  imagesOnly: boolean
): Flow2VideoMode | undefined {
  if (imageCount === 0) return undefined;

  const fromExplicit = normalizeFlow2VideoMode(explicit);
  if (fromExplicit) {
    if (isOmni && fromExplicit === FLOW2_VIDEO_MODE.FRAME) {
      if (imageCount > API_MEDIA_OMNI_FRAME_IMAGE_MAX) {
        badRequest("Omni Khung hình chỉ hỗ trợ tối đa 1 ảnh startImage");
      }
    } else if (isOmni && fromExplicit === FLOW2_VIDEO_MODE.COMPONENT) {
      const maxImages = imagesOnly
        ? API_MEDIA_OMNI_COMPONENT_IMAGE_MAX
        : API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_IMAGE_MAX;
      if (imageCount > maxImages) {
        badRequest(
          imagesOnly
            ? `Omni Thành phần (chỉ ảnh) hỗ trợ tối đa ${maxImages} ảnh`
            : `Omni Thành phần (có video) hỗ trợ tối đa ${maxImages} ảnh`
        );
      }
    } else {
      assertFlow2VideoImageCount(fromExplicit, imageCount);
    }
    return fromExplicit;
  }

  return resolveFlow2VideoMode({ explicitMode: explicit, imageCount });
}

export function validateApiMediaImageRequest(body: Record<string, unknown>): ApiMediaImageRequest {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) badRequest("Thiếu prompt");

  const configRaw = (body.config || {}) as Record<string, unknown>;
  const aspectRatio = assertAspectRatio(configRaw.aspectRatio) ?? "16:9";
  const imageModel =
    typeof configRaw.imageModel === "string" && configRaw.imageModel.trim()
      ? configRaw.imageModel.trim()
      : "NANO_BANANA_PRO";

  if (!API_MEDIA_IMAGE_MODELS.includes(imageModel as (typeof API_MEDIA_IMAGE_MODELS)[number])) {
    badRequest(`imageModel không hợp lệ. Hỗ trợ: ${API_MEDIA_IMAGE_MODELS.join(", ")}`);
  }

  const images = normalizeApiMediaImages(normalizeMediaArray(body.images, "images"));

  if (images.length > API_MEDIA_IMAGE_INPUT_MAX) {
    badRequest(`Image to Image hỗ trợ tối đa ${API_MEDIA_IMAGE_INPUT_MAX} ảnh`);
  }

  return {
    prompt,
    images: images.length ? images : undefined,
    config: {
      aspectRatio,
      imageModel,
      noText: configRaw.noText === true,
      numberOfImages:
        typeof configRaw.numberOfImages === "number" && configRaw.numberOfImages > 0
          ? Math.min(configRaw.numberOfImages, 4)
          : 1,
    },
  };
}

export function validateApiMediaVideoRequest(body: Record<string, unknown>): ApiMediaVideoRequest {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) badRequest("Thiếu prompt");

  const configRaw = (body.config || {}) as Record<string, unknown>;
  const aspectRatio = assertAspectRatio(configRaw.aspectRatio) ?? "16:9";
  const videoQuality = (
    typeof configRaw.videoQuality === "string" && configRaw.videoQuality.trim()
      ? configRaw.videoQuality.trim()
      : "lite_relaxed"
  ) as ApiMediaVideoQuality;

  const isOmni = isApiMediaOmniQuality(videoQuality);
  const imagesOnly = configRaw.imagesOnly !== false;
  const images = normalizeApiMediaImages(normalizeMediaArray(body.images, "images"));
  const videos = normalizeApiMediaVideos(normalizeMediaArray(body.videos, "videos"));

  const explicitMode =
    (typeof body.video_mode === "string" && body.video_mode) ||
    (typeof configRaw.videoMode === "string" && configRaw.videoMode) ||
    undefined;

  let videoDurationS: number | undefined;

  if (isOmni) {
    if (!imagesOnly) {
      if (
        configRaw.videoDurationS != null &&
        configRaw.videoDurationS !== "" &&
        Number(configRaw.videoDurationS) !== API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_DURATION_S
      ) {
        badRequest(
          `Omni Thành phần (có video) chỉ hỗ trợ ${API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_DURATION_S} giây`
        );
      }
      videoDurationS = API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_DURATION_S;

      const mode =
        normalizeFlow2VideoMode(explicitMode) ||
        (explicitMode === FLOW2_VIDEO_MODE.COMPONENT ? FLOW2_VIDEO_MODE.COMPONENT : undefined);
      if (mode === FLOW2_VIDEO_MODE.COMPONENT || videos.length > 0) {
        if (videos.length !== API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_COUNT) {
          badRequest(
            `Omni Thành phần (có video) yêu cầu đúng ${API_MEDIA_OMNI_COMPONENT_WITH_VIDEO_COUNT} video`
          );
        }
      }
    } else {
      videoDurationS = parseOmniDuration(configRaw.videoDurationS, true)!;
    }
  } else if (configRaw.videoDurationS != null && configRaw.videoDurationS !== "") {
    badRequest("videoDurationS chỉ áp dụng khi videoQuality = omni_flash");
  }

  if (videos.length > 0 && !isOmni) {
    badRequest("videos chỉ hỗ trợ khi videoQuality = omni_flash (Thành phần + Có video)");
  }

  const videoMode = resolveVideoMode(explicitMode, images.length, isOmni, imagesOnly);

  if (images.length > 0 && !videoMode) {
    badRequest("Thiếu videoMode khi gửi ảnh tham chiếu (frame hoặc component)");
  }

  if (!isOmni && images.length > 0 && videoMode) {
    assertFlow2VideoImageCount(videoMode, images.length);
  }

  return {
    prompt,
    images: images.length ? images : undefined,
    videos: videos.length ? videos : undefined,
    video_mode: videoMode,
    config: {
      aspectRatio,
      videoQuality,
      videoMode,
      videoDurationS,
      imagesOnly,
      generateAudio: configRaw.generateAudio !== false,
      noText: configRaw.noText === true,
    },
  };
}
