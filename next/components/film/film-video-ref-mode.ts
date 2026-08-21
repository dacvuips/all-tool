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

/** Cảnh có ảnh khung nhưng slot 1 ảnh tham chiếu còn trống → cần seed. */
export function scenesNeedVideoRefSlotSeed(
  scenes: FilmSceneRecord[],
  mode: FilmVideoRefMode
): boolean {
  return scenes.some((scene) => {
    const slots = padVideoRefSlots(scene.videoRefSlots, mode);
    if (slot0Filled(slots[0])) return false;
    return !!sceneFrameToVideoRefSlot(scene);
  });
}

/** Gắn ảnh khung vào slot 1 nếu trống — giữ slot khác user đã chọn. */
export function ensureVideoRefSlotsFromFrame(
  scene: FilmSceneRecord,
  mode: FilmVideoRefMode
): Array<FilmVideoRefSlot | null> {
  const slots = padVideoRefSlots(scene.videoRefSlots, mode);
  if (slot0Filled(slots[0])) return slots;
  const frame = sceneFrameToVideoRefSlot(scene);
  if (!frame) return slots;
  const next = [...slots];
  next[0] = frame;
  return next;
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
    const urlA = (slot.imageUrl || "").trim();
    const urlB = (other.imageUrl || "").trim();
    if (urlA !== urlB) return false;
    const blobA = slot.imageBlob instanceof Blob ? slot.imageBlob.size : 0;
    const blobB = other.imageBlob instanceof Blob ? other.imageBlob.size : 0;
    return blobA === blobB;
  });
}
