import { ElementFormConfig, ElementFormImage } from "../../constants";
import { elementFormImageToDataUrl, getImageMatchToken } from "./elementFormImageUtils";

/** 3 vị trí ảnh tham chiếu: phong cách → đối tượng → sản phẩm */
export const ELEMENT_IMAGE_SLOT_KEYS = ["artStyleImg", "objectImg", "itemImg"] as const;
export type ElementImageSlotKey = (typeof ELEMENT_IMAGE_SLOT_KEYS)[number];

export function isImageNameInPrompt(prompt: string, img: ElementFormImage): boolean {
  const token = getImageMatchToken(img);
  if (!token || token.length < 2) return false;
  return prompt.toLowerCase().includes(token);
}

/**
 * Trả về mảng 3 phần tử (slot 1–3).
 * Mỗi slot chỉ gán ảnh từ config khi tên ảnh xuất hiện trong prompt.
 */
export function matchElementImagesInPrompt(
  prompt: string,
  config?: Pick<ElementFormConfig, ElementImageSlotKey>
): (ElementFormImage | undefined)[] {
  const trimmed = prompt.trim();
  if (!trimmed || !config) return [undefined, undefined, undefined];

  return ELEMENT_IMAGE_SLOT_KEYS.map((key) => {
    const img = config[key];
    if (!img?.imageBytes && !img?.fifeUrl) return undefined;
    return isImageNameInPrompt(trimmed, img) ? img : undefined;
  });
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
