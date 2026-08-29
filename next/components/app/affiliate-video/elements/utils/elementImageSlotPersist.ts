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

    // Ảnh gắn từ generate (bản copy) — giữ imageBytes để preview ổn định.
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
