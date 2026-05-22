import { ElementFormConfig, ElementFormImage } from "../../constants";
import {
  elementFormImageToDataUrl,
  getImageMatchToken,
  getOrderedElementImages,
} from "./elementFormImageUtils";

/** 3 vị trí ảnh tham chiếu trên scene row */
export const ELEMENT_IMAGE_SLOT_KEYS = ["artStyleImg", "objectImg", "itemImg"] as const;
export type ElementImageSlotKey = (typeof ELEMENT_IMAGE_SLOT_KEYS)[number];

const SCENE_SLOT_COUNT = 3;

export function isImageNameInPrompt(prompt: string, img: ElementFormImage): boolean {
  const token = getImageMatchToken(img);
  if (!token || token.length < 2) return false;
  return prompt.toLowerCase().includes(token);
}

/** Vị trí đầu tiên của token trong prompt (từ trên xuống), -1 nếu không có. */
function getTokenFirstIndex(prompt: string, token: string): number {
  if (!token || token.length < 2) return -1;
  return prompt.toLowerCase().indexOf(token);
}

/**
 * Trả về mảng 3 phần tử (slot 1–3).
 * Quét prompt từ trên xuống; ảnh khớp sớm nhất lần lượt gán slot 1→3.
 * Ảnh khớp từ thứ 4 trở đi (theo thứ tự xuất hiện trong prompt) không gán vào slot.
 */
export function matchElementImagesInPrompt(
  prompt: string,
  config?: Pick<ElementFormConfig, ElementImageSlotKey>
): (ElementFormImage | undefined)[] {
  const empty: (ElementFormImage | undefined)[] = [
    undefined,
    undefined,
    undefined,
  ];
  const trimmed = prompt.trim();
  if (!trimmed || !config) return empty;

  const matches = getOrderedElementImages(config)
    .map((img) => ({
      img,
      pos: getTokenFirstIndex(trimmed, getImageMatchToken(img)),
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
export function resolveSceneElementImageSlots(
  prompt: string,
  config: Pick<ElementFormConfig, ElementImageSlotKey> | undefined,
  savedSlots?: (ElementFormImage | undefined)[]
): (ElementFormImage | undefined)[] {
  const auto = matchElementImagesInPrompt(prompt, config);
  if (!savedSlots?.length) return auto;
  return auto.map((matched, i) => savedSlots[i] ?? matched);
}

/** Chuyển các slot có ảnh thành URL/data URL cho API generation. */
export function elementImageSlotsToUrls(
  slots: (ElementFormImage | undefined)[]
): string[] {
  return slots
    .filter((s): s is ElementFormImage => !!s && !!(s.imageBytes || s.fifeUrl))
    .map(elementFormImageToDataUrl);
}
