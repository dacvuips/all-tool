import {
  assertFlow2VideoImageCount,
  FLOW2_VIDEO_MODE,
  Flow2VideoMode,
  normalizeFlow2VideoMode,
} from "../../api-media/flow2/video-mode";

export const WOLF_IMAGE_REFERENCE_LIMIT = 10;
export const WOLF_COMPONENT_IMAGE_LIMIT = 3;
export const WOLF_FRAME_IMAGE_LIMIT = 2;

export const WOLF_ALLOWED_IMAGE_MODELS = new Set(["NANO_BANANA_PRO", "NANO_BANANA_2"]);
export const WOLF_ALLOWED_ASPECT_RATIOS = new Set(["16:9", "9:16"]);

export function countRequestImages(images?: unknown[] | null): number {
  if (!Array.isArray(images)) return 0;
  return images.filter(Boolean).length;
}

export function assertWolfImageRequest(body: {
  prompt?: string;
  images?: unknown[];
  config?: {
    numberOfImages?: number;
    aspectRatio?: string;
    imageModel?: string;
  };
}): void {
  if (!body?.prompt?.trim()) {
    const err: any = new Error("Thiếu prompt");
    err.statusCode = 400;
    throw err;
  }

  const imageCount = countRequestImages(body.images);
  if (imageCount > WOLF_IMAGE_REFERENCE_LIMIT) {
    const err: any = new Error(`Wolf chỉ hỗ trợ tối đa ${WOLF_IMAGE_REFERENCE_LIMIT} ảnh tham chiếu`);
    err.statusCode = 400;
    throw err;
  }

  const aspectRatio = body.config?.aspectRatio;
  if (aspectRatio && !WOLF_ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
    const err: any = new Error("Tỷ lệ ảnh Wolf chỉ hỗ trợ 16:9 hoặc 9:16");
    err.statusCode = 400;
    throw err;
  }

  const imageModel = body.config?.imageModel;
  if (imageModel && !WOLF_ALLOWED_IMAGE_MODELS.has(imageModel)) {
    const err: any = new Error("Model ảnh Wolf chỉ hỗ trợ NANO_BANANA_PRO hoặc NANO_BANANA_2");
    err.statusCode = 400;
    throw err;
  }

  const numberOfImages = body.config?.numberOfImages;
  if (numberOfImages != null && (numberOfImages < 1 || numberOfImages > 16)) {
    const err: any = new Error("Số lượng ảnh tạo phải từ 1 đến 16");
    err.statusCode = 400;
    throw err;
  }
}

export function assertWolfVideoRequest(body: {
  prompt?: string;
  images?: unknown[];
  video_mode?: string;
  config?: {
    prompt?: string;
    aspectRatio?: string;
    videoMode?: string;
  };
}): Flow2VideoMode | undefined {
  const prompt = (body.prompt || body.config?.prompt || "").trim();
  if (!prompt) {
    const err: any = new Error("Thiếu prompt");
    err.statusCode = 400;
    throw err;
  }

  const aspectRatio = body.config?.aspectRatio;
  if (aspectRatio && !WOLF_ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
    const err: any = new Error("Tỷ lệ video Wolf chỉ hỗ trợ 16:9 hoặc 9:16");
    err.statusCode = 400;
    throw err;
  }

  const imageCount = countRequestImages(body.images);
  const explicitMode = normalizeFlow2VideoMode(body.config?.videoMode ?? body.video_mode);
  const videoMode =
    explicitMode ??
    (imageCount >= WOLF_COMPONENT_IMAGE_LIMIT
      ? FLOW2_VIDEO_MODE.COMPONENT
      : imageCount > 0
        ? FLOW2_VIDEO_MODE.FRAME
        : undefined);

  if (videoMode) {
    assertFlow2VideoImageCount(videoMode, imageCount);
    return videoMode;
  }

  if (imageCount > WOLF_FRAME_IMAGE_LIMIT) {
    const err: any = new Error(
      `Wolf video cần chỉ định video_mode; tối đa ${WOLF_FRAME_IMAGE_LIMIT} ảnh cho khung hình hoặc ${WOLF_COMPONENT_IMAGE_LIMIT} ảnh cho thành phần`
    );
    err.statusCode = 400;
    throw err;
  }

  return undefined;
}
