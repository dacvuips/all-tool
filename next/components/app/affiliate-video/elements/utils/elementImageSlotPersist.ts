/**
 * Lightweight persist + runtime resolve cho elementImageSlots per-scene.
 * Match theo `name` — không cần copy imageBytes vào từng scene.
 */
import { ElementFormConfig, ElementFormImage } from "../../constants";
import {
  getImageMatchToken,
  getOrderedElementImages,
} from "./elementFormImageUtils";

export type ElementImageSlotsChangeMeta = {
  /** false = chỉ sync state parent (không ghi IndexedDB). Mặc định true khi persist thủ công. */
  persist?: boolean;
};

export type ElementImageSlotsChangeHandler = (
  slots: (ElementFormImage | undefined)[],
  meta?: ElementImageSlotsChangeMeta
) => void;

/** Slot có media hiển thị / gửi API (bytes hoặc URL). */
export function slotHasDisplayMedia(img: ElementFormImage | undefined): boolean {
  return !!(img?.imageBytes || img?.fifeUrl);
}

/**
 * Gộp slot từ scene (persist nhẹ) với state local — không hạ cấp bytes / gen-assign.
 */
export function mergeElementImageSlotsFromScene(
  prev: (ElementFormImage | undefined)[],
  incoming: (ElementFormImage | undefined)[],
  minLength = 0
): (ElementFormImage | undefined)[] {
  const len = Math.max(prev.length, incoming.length, minLength);
  return Array.from({ length: len }, (_, i) => {
    const local = prev[i];
    const saved = incoming[i];
    const localOk = slotHasDisplayMedia(local);
    const savedOk = slotHasDisplayMedia(saved);
    if (localOk && !savedOk) return local;
    if (localOk && savedOk && local!.imageBytes && !saved!.imageBytes) return local;
    if ((local?.name || "").startsWith("gen-assign|") && localOk) return local;
    return saved ?? local;
  });
}

/** Ô được gắn thủ công (gen-assign hoặc khác auto-match). */
export function deriveManualMaskForElementSlots(
  savedSlots: (ElementFormImage | undefined)[],
  autoMatched: (ElementFormImage | undefined)[],
  slotCount: number
): boolean[] {
  return Array.from({ length: slotCount }, (_, i) => {
    const saved = savedSlots[i];
    if (!slotHasDisplayMedia(saved)) return false;
    const name = saved!.name || "";
    if (name.startsWith("gen-assign|")) return true;
    const auto = autoMatched[i];
    if (!slotHasDisplayMedia(auto)) return true;
    return elementImageSlotsFingerprint([saved!]) !== elementImageSlotsFingerprint([auto!]);
  });
}

/** Fingerprint nhẹ cho slot — không dùng độ dài base64 khi đã có URL/name. */
export function elementImageSlotsFingerprint(
  slots: (ElementFormImage | undefined)[]
): string {
  return slots
    .map((s, i) => {
      if (!s) return `${i}:`;
      const url = (s.fifeUrl || "").slice(0, 48);
      const bytesFlag = s.imageBytes ? "b" : "";
      return `${i}:${s.name ?? ""}:${bytesFlag}:${url}`;
    })
    .join("|");
}

/** Bản reference nhẹ — giữ name + URL, bỏ base64. */
export function toLightImageRef(img: ElementFormImage): ElementFormImage {
  return {
    name: img.name,
    fifeUrl: img.fifeUrl || "",
    mimeType: img.mimeType || "image/png",
    imageBytes: "",
  };
}

/** Tìm ảnh đầy đủ trong catalog sidebar theo name. */
export function resolveImageFromCatalog(
  ref: ElementFormImage | undefined,
  config?: ElementFormConfig
): ElementFormImage | undefined {
  if (!ref) return undefined;
  // Upload thủ công hoặc ảnh đã có URL — giữ nguyên, không swap sang catalog theo tên file.
  if (ref.imageBytes && !ref.fifeUrl) return ref;
  if (ref.fifeUrl) return ref;
  const token = getImageMatchToken(ref);
  if (!token || !config) return ref;
  return (
    getOrderedElementImages(config).find((img) => getImageMatchToken(img) === token) ?? ref
  );
}

export function resolveSlotsFromCatalog(
  slots: (ElementFormImage | undefined)[] | undefined,
  config?: ElementFormConfig
): (ElementFormImage | undefined)[] {
  if (!slots?.length) return slots ?? [];
  return slots.map((s) => resolveImageFromCatalog(s, config));
}

/**
 * Chuẩn bị slots trước khi ghi IndexedDB:
 * - Auto-match từ catalog → chỉ lưu name + fifeUrl
 * - Upload thủ công trên scene (bytes, không URL, không có trong catalog) → giữ bytes
 */
export function stripSlotsForPersist(
  slots: (ElementFormImage | undefined)[],
  config?: ElementFormConfig
): (ElementFormImage | undefined)[] {
  return slots.map((slot) => {
    if (!slot) return undefined;

    // Ảnh gắn từ generate (bản copy) — giữ imageBytes để persist; UI preview qua blob URL.
    if ((slot.name || "").startsWith("gen-assign|") && slot.imageBytes) {
      return {
        name: slot.name,
        fifeUrl:
          slot.fifeUrl &&
          !slot.fifeUrl.startsWith("blob:") &&
          !slot.fifeUrl.startsWith("data:")
            ? slot.fifeUrl
            : "",
        mimeType: slot.mimeType || "image/png",
        imageBytes: slot.imageBytes,
      };
    }

    const catalogHit = resolveImageFromCatalog(slot, config);
    const token = getImageMatchToken(slot);

    if (slot.fifeUrl || catalogHit?.fifeUrl) {
      return toLightImageRef({
        ...slot,
        fifeUrl: slot.fifeUrl || catalogHit?.fifeUrl || "",
        mimeType: slot.mimeType || catalogHit?.mimeType || "image/png",
        name: slot.name || catalogHit?.name || "",
      });
    }

    if (slot.imageBytes && token && catalogHit?.imageBytes) {
      return toLightImageRef({
        name: slot.name || catalogHit.name,
        fifeUrl: catalogHit.fifeUrl || "",
        mimeType: slot.mimeType || catalogHit.mimeType || "image/png",
        imageBytes: "",
      });
    }

    if (slot.imageBytes && !slot.fifeUrl) {
      return slot;
    }

    if (token) {
      return toLightImageRef({
        name: slot.name,
        fifeUrl: "",
        mimeType: slot.mimeType || "image/png",
        imageBytes: "",
      });
    }

    return toLightImageRef(slot);
  });
}
