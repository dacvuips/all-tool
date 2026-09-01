import type { AspectRatio } from "../constants";

const ASPECT_RATIO_SET = new Set<string>(["16:9", "9:16", "1:1", "4:3", "3:4"]);

export function isAspectRatio(value: string): value is AspectRatio {
  return ASPECT_RATIO_SET.has(value);
}

/** padding-top % cho khung aspect-ratio CSS (height = width * ratio). */
export function getAspectPaddingPercent(ratio: AspectRatio | string): number {
  switch (ratio) {
    case "16:9":
      return 56.25;
    case "9:16":
      return 177.78;
    case "1:1":
      return 100;
    case "4:3":
      return 75;
    case "3:4":
      return 133.33;
    default:
      return ratio === "9:16" ? 177.78 : 56.25;
  }
}

export function isPortraitAspectRatio(ratio: AspectRatio | string): boolean {
  return ratio === "9:16" || ratio === "3:4";
}

/** Chiều rộng preview inline list theo chiều cao cố định. */
export function getInlinePreviewWidth(height: number, ratio: AspectRatio | string): number {
  const parts = String(ratio).split(":").map(Number);
  const w = parts[0];
  const h = parts[1];
  if (!w || !h) return Math.round((height * 16) / 9);
  return Math.round((height * w) / h);
}
