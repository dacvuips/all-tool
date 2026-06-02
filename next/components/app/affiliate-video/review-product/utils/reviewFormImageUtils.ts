import { ReviewFormConfig, ReviewFormImage, ReviewFormVideo, ServiceImageEnum } from "../constants";

/** Chuẩn hóa artStyleImg (hỗ trợ dữ liệu cũ lưu 1 ảnh đơn). */
export function getArtStyleImages(
  config?:
    | Pick<ReviewFormConfig, "artStyleImg">
    | { artStyleImg?: ReviewFormImage | ReviewFormImage[] }
): ReviewFormImage[] {
  const raw = config?.artStyleImg;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Tên hiển thị (bỏ phần mở rộng file, giữ nguyên hoa thường). */
export function getImageDisplayName(img: ReviewFormImage): string {
  const raw = (img.name || "").trim();
  if (!raw) return "";
  return raw.replace(/\.[^./\\]+$/, "").trim();
}

/** Tên dùng để match trong prompt (bỏ phần mở rộng file). */
export function getImageMatchToken(img: ReviewFormImage): string {
  return getImageDisplayName(img).toLowerCase();
}

/** Số ô ảnh trên mỗi scene theo chế độ nạp ảnh (Images to Video). */
export function getSceneImageSlotCount(serviceImageType?: string): number {
  return serviceImageType === ServiceImageEnum.imageOnly ? 1 : 2;
}

/** Danh sách ảnh tham chiếu theo thứ tự sidebar (artStyle → nhân hoá → object → item). */
export function getOrderedReviewImages(
  config?: Pick<
    ReviewFormConfig,
    "artStyleImg" | "objectToPersonifyImage" | "objectImg" | "itemImg"
  >
): ReviewFormImage[] {
  if (!config) return [];
  const images: ReviewFormImage[] = [];
  for (const img of getArtStyleImages(config)) {
    if (img.imageBytes || img.fifeUrl) images.push(img);
  }
  if (config.objectToPersonifyImage?.imageBytes || config.objectToPersonifyImage?.fifeUrl) {
    images.push(config.objectToPersonifyImage);
  }
  if (config.objectImg?.imageBytes || config.objectImg?.fifeUrl) {
    images.push(config.objectImg);
  }
  if (config.itemImg?.imageBytes || config.itemImg?.fifeUrl) {
    images.push(config.itemImg);
  }
  return images;
}

export function reviewFormImageToDataUrl(img: ReviewFormImage): string {
  if (img.fifeUrl) return img.fifeUrl;
  const mime = img.mimeType || "image/png";
  return `data:${mime};base64,${img.imageBytes}`;
}

export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function getReviewFormImagePreviewSrc(img: ReviewFormImage): string | null {
  if (!img.imageBytes && !img.fifeUrl) return null;
  if (img.fifeUrl) return img.fifeUrl;
  return base64ToBlobUrl(img.imageBytes, img.mimeType || "image/png");
}

/** Chuyển URL/data URL ảnh tham chiếu (cùng nguồn tab Ảnh) thành payload API. */
export async function productImageUrlsToApiImages(
  urls: string[] | undefined
): Promise<{ imageBytes: string; mimeType: string }[]> {
  if (!urls?.length) return [];
  const out: { imageBytes: string; mimeType: string }[] = [];
  for (const imgUrl of urls) {
    try {
      const dataMatch = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (dataMatch) {
        out.push({ mimeType: dataMatch[1], imageBytes: dataMatch[2] });
        continue;
      }
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      out.push({ mimeType: blob.type || "image/png", imageBytes: base64 });
    } catch (err) {
      console.warn("[productImageUrlsToApiImages] Failed to convert image:", imgUrl, err);
    }
  }
  return out;
}

/** Số ô ảnh tham chiếu trên mỗi scene row */
export const REVIEW_SCENE_IMAGE_SLOT_COUNT = 3;

/**
 * Ảnh tham chiếu cho API video.
 * Luôn đọc từ 3 ô slot trước (đúng thứ tự UI); chỉ fallback URL khi slot trống.
 */
export async function resolveReviewReferenceImagesForApi(options: {
  urls?: string[];
  slots?: (ReviewFormImage | undefined)[];
}): Promise<{ imageBytes: string; mimeType: string }[]> {
  const fromSlots = await reviewImageSlotsToApiImages(options.slots);
  if (fromSlots.length > 0) return fromSlots;
  return productImageUrlsToApiImages(options.urls);
}

/** Ảnh nhân hoá đồ vật (tab Ảnh) → payload cho generation-image / copy-video-generate-image. */
export async function objectToPersonifyImageToApiImages(
  image?: ReviewFormImage
): Promise<{ imageBytes: string; mimeType: string }[]> {
  if (!image) return [];
  const payload = await reviewFormImageToApiPayload(image);
  return payload ? [payload] : [];
}

export function hasObjectToPersonifyImage(image?: ReviewFormImage): boolean {
  return !!(image?.imageBytes || image?.fifeUrl);
}

export type ObjectToPersonifyMode = "image" | "prompt" | "none";

/** Có ảnh → mode ảnh (ưu tiên); không ảnh nhưng có prompt/code → mode prompt. */
export function getObjectToPersonifyMode(opts: {
  objectToPersonify?: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImage?: ReviewFormImage;
}): ObjectToPersonifyMode {
  if (hasObjectToPersonifyImage(opts.objectToPersonifyImage)) return "image";
  if (opts.objectToPersonify?.trim() || opts.objectToPersonifyCode?.trim()) return "prompt";
  return "none";
}

export type ObjectToPersonifyApiFields = {
  objectToPersonify?: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImages?: ReviewFormImage[];
};

/** Payload API: chỉ ảnh HOẶC chỉ prompt, không gửi cả hai. */
export function buildObjectToPersonifyApiFields(opts: {
  objectToPersonify?: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImage?: ReviewFormImage;
}): ObjectToPersonifyApiFields {
  const mode = getObjectToPersonifyMode(opts);
  if (mode === "image") {
    return { objectToPersonifyImages: [opts.objectToPersonifyImage!] };
  }
  if (mode === "prompt") {
    return {
      objectToPersonify: opts.objectToPersonify?.trim() || undefined,
      objectToPersonifyCode: opts.objectToPersonify?.trim()
        ? opts.objectToPersonifyCode
        : undefined,
    };
  }
  return {};
}

/** Config cho generation-scene: xoá prompt khi dùng ảnh. */
export function stripObjectToPersonifyPromptFromConfig<
  T extends {
    objectToPersonify?: string;
    objectToPersonifyCode?: string;
  }
>(data: T): T {
  return { ...data, objectToPersonify: "", objectToPersonifyCode: undefined };
}

/** Ảnh tham chiếu khi generate scene image – chỉ khi mode = image. */
export function resolveObjectToPersonifyImageForApi(opts: {
  objectToPersonify?: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImage?: ReviewFormImage;
  fallbackImage?: ReviewFormImage;
}): ReviewFormImage | undefined {
  const image = opts.objectToPersonifyImage ?? opts.fallbackImage;
  if (getObjectToPersonifyMode({ ...opts, objectToPersonifyImage: image }) !== "image") {
    return undefined;
  }
  return image;
}

/** Tách base64 thuần khỏi data URL trước khi gửi API upload. */
export function stripDataUrlFromImageBytes(
  input: string,
  fallbackMimeType = "image/png"
): { imageBytes: string; mimeType: string } {
  const trimmed = input.trim();
  const base64Marker = ";base64,";
  if (trimmed.startsWith("data:")) {
    const idx = trimmed.indexOf(base64Marker);
    if (idx !== -1) {
      return {
        mimeType: trimmed.slice(5, idx) || fallbackMimeType,
        imageBytes: trimmed.slice(idx + base64Marker.length),
      };
    }
  }
  return { imageBytes: trimmed, mimeType: fallbackMimeType };
}

/** Convert một ElementFormImage → payload API (hoặc undefined nếu thiếu dữ liệu). */
async function reviewFormImageToApiPayload(
  img: ReviewFormImage
): Promise<{ imageBytes: string; mimeType: string } | undefined> {
  if (!img.imageBytes && !img.fifeUrl) return undefined;
  try {
    if (img.imageBytes) {
      return stripDataUrlFromImageBytes(img.imageBytes, img.mimeType || "image/png");
    }
    const url = img.fifeUrl;
    if (url.startsWith("data:")) {
      return stripDataUrlFromImageBytes(url, img.mimeType || "image/png");
    }
    const resp = await fetch(url);
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { mimeType: blob.type || img.mimeType || "image/png", imageBytes: base64 };
  } catch (err) {
    console.warn("[elementFormImageToApiPayload] Failed to convert image:", img.name, err);
    return undefined;
  }
}

/**
 * Chuyển 3 ô ảnh tham chiếu (theo thứ tự slot 1→3) thành payload cho API generation-video.
 * Duyệt đủ 3 index — không bỏ slot giữa khi compact mảng URL.
 */
export async function reviewImageSlotsToApiImages(
  slots: (ReviewFormImage | undefined)[] | undefined,
  slotCount = REVIEW_SCENE_IMAGE_SLOT_COUNT
): Promise<{ imageBytes: string; mimeType: string }[]> {
  if (!slots?.length) return [];
  const out: { imageBytes: string; mimeType: string }[] = [];
  for (let i = 0; i < slotCount; i++) {
    const img = slots[i];
    if (!img || (!img.imageBytes && !img.fifeUrl)) continue;
    const payload = await reviewFormImageToApiPayload(img);
    if (payload) out.push(payload);
  }
  return out;
}

/** Convert một ElementFormVideo → payload API (hoặc undefined nếu thiếu dữ liệu). */
async function reviewFormVideoToApiPayload(
  vid: ReviewFormVideo
): Promise<{ videoBytes: string; mimeType: string } | undefined> {
  if (!vid.videoBytes && !vid.fifeUrl) return undefined;
  try {
    if (vid.videoBytes) {
      return {
        videoBytes: vid.videoBytes,
        mimeType: vid.mimeType || "video/mp4",
      };
    }
    const url = vid.fifeUrl;
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return { mimeType: dataMatch[1], videoBytes: dataMatch[2] };
    }
    const resp = await fetch(url);
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { mimeType: blob.type || vid.mimeType || "video/mp4", videoBytes: base64 };
  } catch (err) {
    console.warn("[reviewFormVideoToApiPayload] Failed to convert video:", vid.name, err);
    return undefined;
  }
}

/**
 * Video tham chiếu (ô slot 0) cho API generation-element-video-to-video.
 */
export async function resolveReviewReferenceVideoForApi(options: {
  slots?: (ReviewFormVideo | undefined)[];
}): Promise<{ videoBytes: string; mimeType: string } | undefined> {
  const slot = options.slots?.[0];
  if (!slot) return undefined;
  return reviewFormVideoToApiPayload(slot);
}
