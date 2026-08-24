/**
 * Chế độ ảnh tham chiếu khi Tạo video (Flow2 frame / component).
 * - Start: 1 slot (start frame)
 * - Start-End: 2 slot (start + end)
 * - Thành phần: 3 slot (reference)
 */
import type { FilmSceneRecord } from "./film-types";

export type FilmVideoRefMode = "start" | "start_end" | "component";

export type FilmVideoRefSlot = {
  imageUrl?: string;
  imageBlob?: Blob;
  name?: string;
};

export const FILM_VIDEO_REF_SLOT_COUNT: Record<FilmVideoRefMode, number> = {
  start: 1,
  start_end: 2,
  component: 3,
};

/** Map sang Flow2 video_mode */
export function filmVideoRefModeToFlow2(
  mode: FilmVideoRefMode
): "frame" | "component" {
  return mode === "component" ? "component" : "frame";
}

/** Map sang serviceImageType (affiliate / film generate-video).
 * - Start → image_only (1 startImage)
 * - Start-End → start_end (start + end)
 * - Thành phần → start_add_end (component refs)
 */
export function filmVideoRefModeToServiceImageType(
  mode: FilmVideoRefMode
): "image_only" | "start_end" | "start_add_end" {
  if (mode === "start_end") return "start_end";
  if (mode === "component") return "start_add_end";
  return "image_only";
}

export type FilmVideoRefModeOption = {
  id: FilmVideoRefMode;
  label: string;
  slotCount: number;
  /** Giải thích hover (popover / tooltip) */
  description: string;
};

export const FILM_VIDEO_REF_MODE_OPTIONS: FilmVideoRefModeOption[] = [
  {
    id: "component",
    label: "Thành Phần",
    slotCount: 3,
    description:
      "3 ảnh tham chiếu (reference / thành phần). Mặc định gắn ảnh khung phân cảnh vào slot đầu.",
  },
  {
    id: "start_end",
    label: "Start-End",
    slotCount: 2,
    description:
      "2 ảnh start + end frame. Mặc định gắn ảnh khung phân cảnh vào slot bắt đầu (slot 1).",
  },
  {
    id: "start",
    label: "Start",
    slotCount: 1,
    description:
      "1 ảnh khung bắt đầu (start image) → video. Mặc định gắn ảnh khung phân cảnh vào slot 1.",
  },
];

/** Mode mặc định khi mở Tạo video */
export const FILM_VIDEO_REF_MODE_DEFAULT: FilmVideoRefMode = "component";

/** Ảnh khung phân cảnh → slot tham chiếu (nếu có). */
export function sceneFrameToVideoRefSlot(
  scene: FilmSceneRecord
): FilmVideoRefSlot | null {
  if (scene.frameImageBlob instanceof Blob && scene.frameImageBlob.size > 0) {
    return {
      imageBlob: scene.frameImageBlob,
      imageUrl: (scene.frameImageUrl || "").trim() || undefined,
      name: `scene-${scene.index}-frame`,
    };
  }
  const url = (scene.frameImageUrl || "").trim();
  if (!url) return null;
  return {
    imageUrl: url,
    name: `scene-${scene.index}-frame`,
  };
}

/** Tạo mảng slot theo mode; mặc định gắn ảnh phân cảnh vào slot đầu. */
export function buildDefaultVideoRefSlots(
  scene: FilmSceneRecord,
  mode: FilmVideoRefMode
): Array<FilmVideoRefSlot | null> {
  const count = FILM_VIDEO_REF_SLOT_COUNT[mode];
  const slots: Array<FilmVideoRefSlot | null> = Array.from(
    { length: count },
    () => null
  );
  const frame = sceneFrameToVideoRefSlot(scene);
  if (frame) slots[0] = frame;
  return slots;
}

export function padVideoRefSlots(
  slots: Array<FilmVideoRefSlot | null | undefined> | undefined,
  mode: FilmVideoRefMode
): Array<FilmVideoRefSlot | null> {
  const count = FILM_VIDEO_REF_SLOT_COUNT[mode];
  const next = [...(slots || [])];
  while (next.length < count) next.push(null);
  return next.slice(0, count).map((s) => s || null);
}

function slot0Filled(slot: FilmVideoRefSlot | null | undefined): boolean {
  if (!slot) return false;
  if (slot.imageBlob instanceof Blob && slot.imageBlob.size > 0) return true;
  return !!(slot.imageUrl || "").trim();
}

function slotFingerprint(slot: FilmVideoRefSlot | null | undefined): string {
  if (!slot) return "";
  const url = (slot.imageUrl || "").trim();
  const blobSize = slot.imageBlob instanceof Blob ? slot.imageBlob.size : 0;
  return `${url}|${blobSize}`;
}

/** Slot gắn tự động từ ảnh khung phân cảnh (không phải upload tay). */
export function isAutoSeededVideoRefSlot(
  slot: FilmVideoRefSlot | null | undefined,
  scene?: FilmSceneRecord
): boolean {
  if (!slot || !slot0Filled(slot)) return false;
  const name = String(slot.name || "").trim();
  if (/^scene-\d+-frame$/i.test(name)) return true;
  if (scene != null) {
    const expected = `scene-${scene.index}-frame`;
    if (name === expected) return true;
  }
  // Dữ liệu cũ: không có name → coi là auto nếu trùng ảnh khung hiện tại hoặc trống name
  if (!name) return true;
  return false;
}

function slotMatchesFrame(
  slot: FilmVideoRefSlot | null | undefined,
  scene: FilmSceneRecord
): boolean {
  const frame = sceneFrameToVideoRefSlot(scene);
  if (!slot || !frame) return false;
  return slotFingerprint(slot) === slotFingerprint(frame);
}

/** Cảnh có ảnh khung mới / slot trống / slot auto đã cũ → cần seed lại slot 1. */
export function scenesNeedVideoRefSlotSeed(
  scenes: FilmSceneRecord[],
  mode: FilmVideoRefMode
): boolean {
  return scenes.some((scene) => {
    const frame = sceneFrameToVideoRefSlot(scene);
    if (!frame) return false;
    const slots = padVideoRefSlots(scene.videoRefSlots, mode);
    const slot0 = slots[0];
    if (!slot0Filled(slot0)) return true;
    if (isAutoSeededVideoRefSlot(slot0, scene) && !slotMatchesFrame(slot0, scene)) {
      return true;
    }
    return false;
  });
}

/**
 * Gắn / làm mới ảnh khung vào slot 1 khi trống hoặc slot vẫn là auto-seed cũ.
 * Không đụng slot user upload tay (name khác scene-*-frame).
 */
export function ensureVideoRefSlotsFromFrame(
  scene: FilmSceneRecord,
  mode: FilmVideoRefMode
): Array<FilmVideoRefSlot | null> {
  const slots = padVideoRefSlots(scene.videoRefSlots, mode);
  const frame = sceneFrameToVideoRefSlot(scene);
  if (!frame) return slots;

  const slot0 = slots[0];
  const shouldFill = !slot0Filled(slot0);
  const shouldRefresh =
    !shouldFill &&
    isAutoSeededVideoRefSlot(slot0, scene) &&
    !slotMatchesFrame(slot0, scene);

  if (!shouldFill && !shouldRefresh) return slots;
  const next = [...slots];
  next[0] = frame;
  return next;
}

/** Áp frame mới vào scene + sync videoRefSlots (nếu slot 1 đang auto). */
export function applyFrameToSceneVideoRefSlots(
  scene: FilmSceneRecord,
  mode: FilmVideoRefMode,
  frame: { imageUrl?: string; imageBlob?: Blob }
): FilmSceneRecord {
  const withFrame: FilmSceneRecord = {
    ...scene,
    frameImageUrl: frame.imageUrl ?? scene.frameImageUrl,
    frameImageBlob: frame.imageBlob !== undefined ? frame.imageBlob : scene.frameImageBlob,
  };
  const videoRefSlots = ensureVideoRefSlotsFromFrame(withFrame, mode);
  if (videoRefSlotsEqual(scene.videoRefSlots, videoRefSlots, mode)) {
    return withFrame;
  }
  return { ...withFrame, videoRefSlots };
}

export function videoRefSlotsEqual(
  a: Array<FilmVideoRefSlot | null | undefined> | undefined,
  b: Array<FilmVideoRefSlot | null | undefined> | undefined,
  mode: FilmVideoRefMode
): boolean {
  const left = padVideoRefSlots(a, mode);
  const right = padVideoRefSlots(b, mode);
  return left.every((slot, i) => {
    const other = right[i];
    if (!slot && !other) return true;
    if (!slot || !other) return false;
    return slotFingerprint(slot) === slotFingerprint(other);
  });
}
