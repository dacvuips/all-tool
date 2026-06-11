import { ElementFormImage, StoryboardCropRegion } from "../../constants";
import { getElementFormImagePreviewSrc } from "../../elements/utils/elementFormImageUtils";

function loadImageFromElementFormImage(image: ElementFormImage): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const src = getElementFormImagePreviewSrc(image);
    if (!src) {
      reject(new Error("Missing storyboard image preview source"));
      return;
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load storyboard image"));
    img.src = src;
  });
}

/** Cắt một vùng panel từ ảnh storyboard gốc bằng canvas. */
export async function cropStoryboardRegion(
  sourceImage: ElementFormImage,
  region: StoryboardCropRegion,
  sceneNumber: number
): Promise<ElementFormImage> {
  const img = await loadImageFromElementFormImage(sourceImage);

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const sx = Math.round(clamp(region.x, 0, 1) * naturalWidth);
  const sy = Math.round(clamp(region.y, 0, 1) * naturalHeight);
  const sw = Math.max(1, Math.round(clamp(region.width, 0, 1) * naturalWidth));
  const sh = Math.max(1, Math.round(clamp(region.height, 0, 1) * naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const mimeType = sourceImage.mimeType || "image/png";
  const dataUrl = canvas.toDataURL(mimeType);
  const imageBytes = dataUrl.split(",")[1];

  if (!imageBytes) {
    throw new Error("Failed to encode cropped storyboard panel");
  }

  return {
    fifeUrl: "",
    imageBytes,
    mimeType,
    name: `${sourceImage.name || "storyboard"}-scene-${sceneNumber}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
