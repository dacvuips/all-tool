import { ElementFormConfig, ElementFormImage } from "../../constants";
import { ActionImageEnum, ServiceImageEnum } from "../constants";
import {
  pickAutoModeElementImageConfig,
  resolveActionImageType,
} from "./elementActionImageUtils";
import {
  elementFormImageToDataUrl,
  ELEMENT_COMPONENT_IMAGE_SLOT_COUNT,
  getArtStyleImages,
  getImageMatchToken,
  getOrderedElementImages,
  getSceneImageSlotCount,
  normalizeImageMatchToken,
  resolveElementSceneSlotCount,
} from "./elementFormImageUtils";

/** 3 vị trí ảnh tham chiếu trên scene row */
export const ELEMENT_IMAGE_SLOT_KEYS = ["artStyleImg", "objectImg", "itemImg"] as const;
export type ElementImageSlotKey = (typeof ELEMENT_IMAGE_SLOT_KEYS)[number];

const SCENE_SLOT_COUNT = 3;

/** Vị trí đầu tiên của tên ảnh trong prompt (từ trên xuống), -1 nếu không có. */
export function getTokenFirstIndexInPrompt(prompt: string, token: string): number {
  const t = normalizeImageMatchToken(token);
  if (!t) return -1;
  const lower = prompt.toLowerCase();
  if (/^\d+$/.test(t)) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Khớp số thuần hoặc số kèm đuôi file: 1, 1.png, 1.jpg, ...
    const re = new RegExp(`(^|[^\\d])${escaped}(?:\\.[a-z0-9*]+)?([^\\d]|$)`, "i");
    const m = lower.match(re);
    if (!m || m.index === undefined) return -1;
    return m.index + (m[1]?.length ?? 0);
  }
  if (t.length < 2) return -1;
  return lower.indexOf(t);
}

export function isImageNameInPrompt(prompt: string, img: ElementFormImage): boolean {
  return getTokenFirstIndexInPrompt(prompt, getImageMatchToken(img)) >= 0;
}

function findArtStyleImageByDisplayName(
  images: ElementFormImage[],
  name: string
): ElementFormImage | undefined {
  const target = normalizeImageMatchToken(name);
  return images.find((img) => getImageMatchToken(img) === target);
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
  config?: Pick<ElementFormConfig, "artStyleImg">
): (ElementFormImage | undefined)[] {
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

/**
 * Chế độ nạp tuần tự: mỗi nhóm ảnh gán vào 1 slot (1→slot1, 2→slot2, 3→slot3).
 * Cảnh N lấy ảnh thứ ((N-1) mod số ảnh nhóm) trong từng nhóm — lặp vòng khi hết ảnh.
 */
export function matchSequentialElementImagesForScene(
  sceneNumber: number,
  sequentialGroups?: (ElementFormImage[] | undefined)[],
  slotCount = ELEMENT_COMPONENT_IMAGE_SLOT_COUNT
): (ElementFormImage | undefined)[] {
  const sceneIndex = Math.max(0, sceneNumber - 1);
  return Array.from({ length: slotCount }, (_, slotIndex) => {
    const groupImages = (sequentialGroups?.[slotIndex] ?? []).filter(
      (img) => img.imageBytes || img.fifeUrl
    );
    if (!groupImages.length) return undefined;
    return groupImages[sceneIndex % groupImages.length];
  });
}

/** Auto-match slot ảnh theo chế độ nạp (auto / tuần tự) — hai nguồn ảnh tách biệt. */
export function matchElementImagesForScene(
  sceneNumber: number,
  prompt: string,
  config?: ElementFormConfig
): (ElementFormImage | undefined)[] {
  const slotCount = resolveElementSceneSlotCount(config);
  if (resolveActionImageType(config) === ActionImageEnum.sequential) {
    return matchSequentialElementImagesForScene(
      sceneNumber,
      config?.artStyleImgSequential,
      slotCount
    );
  }
  // Images to Video (auto): gán artStyleImg theo tên file số — không match prompt
  if (config?.serviceImageType) {
    return matchArtStyleImagesForScene(sceneNumber, config.serviceImageType, config);
  }
  // Tab Thành phần (auto): match tên ảnh trong prompt
  const matched = matchElementImagesInPrompt(prompt, pickAutoModeElementImageConfig(config));
  return matched.slice(0, slotCount);
}

/** Gộp ảnh đã lưu theo scene với kết quả auto-match (ưu tiên override thủ công). */
export function resolveSceneElementImageSlots(
  prompt: string,
  config: Pick<ElementFormConfig, ElementImageSlotKey | "actionImageType" | "artStyleImgSequential"> | undefined,
  savedSlots?: (ElementFormImage | undefined)[],
  sceneNumber = 1
): (ElementFormImage | undefined)[] {
  const auto = matchElementImagesForScene(sceneNumber, prompt, config as ElementFormConfig | undefined);
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
