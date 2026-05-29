import { ReviewFormConfig, ReviewFormImage, ServiceImageEnum } from "../constants";
import {
  getArtStyleImages,
  getImageDisplayName,
  getImageMatchToken,
  getOrderedReviewImages,
  getSceneImageSlotCount,
  reviewFormImageToDataUrl,
} from "./reviewFormImageUtils";

/** 3 vị trí ảnh tham chiếu trên scene row */
export const REVIEW_IMAGE_SLOT_KEYS = [
  "artStyleImg",
  "objectToPersonifyImage",
  "objectImg",
  "itemImg",
] as const;
export type ReviewImageSlotKey = typeof REVIEW_IMAGE_SLOT_KEYS[number];

const SCENE_SLOT_COUNT = 3;

/** Vị trí đầu tiên của tên ảnh trong prompt (từ trên xuống), -1 nếu không có. */
export function getTokenFirstIndexInPrompt(prompt: string, token: string): number {
  if (!token) return -1;
  const lower = prompt.toLowerCase();
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) {
    const re = new RegExp(`(^|[^\\d])${t}([^\\d]|$)`);
    const m = lower.match(re);
    if (!m || m.index === undefined) return -1;
    return m.index + (m[1]?.length ?? 0);
  }
  if (t.length < 2) return -1;
  return lower.indexOf(t);
}

export function isImageNameInPrompt(prompt: string, img: ReviewFormImage): boolean {
  return getTokenFirstIndexInPrompt(prompt, getImageMatchToken(img)) >= 0;
}

function findArtStyleImageByDisplayName(
  images: ReviewFormImage[],
  name: string
): ReviewFormImage | undefined {
  const target = name.toLowerCase();
  return images.find((img) => {
    const token = getImageMatchToken(img);
    return token === target || getImageDisplayName(img).toLowerCase() === target;
  });
}

/**
 * Images to Video: gán artStyleImg theo tên file (số), không dùng prompt cảnh.
 * - imageOnly: cảnh N → ảnh tên N
 * - startEnd / startAddEnd: cảnh N → slot 1 = ảnh (2N-1), slot 2 = ảnh (2N)
 *   (cảnh 1: 1–2, cảnh 2: 3–4, cảnh 3: 5–6, …)
 */
export function matchArtStyleImagesForScene(
  sceneNumber: number,
  serviceImageType: string | undefined,
  config?: Pick<ReviewFormConfig, "artStyleImg">
): (ReviewFormImage | undefined)[] {
  const slotCount = getSceneImageSlotCount(serviceImageType);
  const images = getArtStyleImages(config).filter((img) => img.imageBytes || img.fifeUrl);
  if (!images.length) {
    return Array.from({ length: slotCount }, () => undefined);
  }

  if (serviceImageType === ServiceImageEnum.imageOnly) {
    return [findArtStyleImageByDisplayName(images, String(sceneNumber))].slice(0, slotCount);
  }

  const n1 = String((sceneNumber - 1) * 2 + 1);
  const n2 = String((sceneNumber - 1) * 2 + 2);
  return [
    findArtStyleImageByDisplayName(images, n1),
    findArtStyleImageByDisplayName(images, n2),
  ].slice(0, slotCount);
}

/**
 * Trả về mảng 3 phần tử (slot 1–3).
 * Quét prompt từ trên xuống; ảnh khớp sớm nhất lần lượt gán slot 1→3.
 * Ảnh khớp từ thứ 4 trở đi (theo thứ tự xuất hiện trong prompt) không gán vào slot.
 */
export function matchReviewImagesInPrompt(
  prompt: string,
  config?: Pick<ReviewFormConfig, ReviewImageSlotKey>
): (ReviewFormImage | undefined)[] {
  const empty: (ReviewFormImage | undefined)[] = [undefined, undefined, undefined];
  const trimmed = prompt.trim();
  if (!trimmed || !config) return empty;

  const matches = getOrderedReviewImages(config)
    .map((img) => ({
      img,
      pos: getTokenFirstIndexInPrompt(trimmed, getImageMatchToken(img)),
    }))
    .filter((m) => m.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  const slots = [...empty];
  for (let i = 0; i < Math.min(SCENE_SLOT_COUNT, matches.length); i++) {
    slots[i] = matches[i].img;
  }
  return slots;
}

/** Gộp ảnh đã lưu theo scene với kết quả auto-match (ưu tiên override thủ công). */
export function resolveSceneReviewImageSlots(
  prompt: string,
  config: Pick<ReviewFormConfig, ReviewImageSlotKey> | undefined,
  savedSlots?: (ReviewFormImage | undefined)[]
): (ReviewFormImage | undefined)[] {
  const auto = matchReviewImagesInPrompt(prompt, config);
  if (!savedSlots?.length) return auto;
  return auto.map((matched, i) => savedSlots[i] ?? matched);
}

/** Chuyển các slot có ảnh thành URL/data URL cho API generation. */
export function reviewImageSlotsToUrls(slots: (ReviewFormImage | undefined)[]): string[] {
  return slots
    .filter((s): s is ReviewFormImage => !!s && !!(s.imageBytes || s.fifeUrl))
    .map(reviewFormImageToDataUrl);
}
