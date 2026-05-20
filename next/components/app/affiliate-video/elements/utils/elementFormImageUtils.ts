import { ElementFormImage } from "../../constants";

/** Tên dùng để match trong prompt (bỏ phần mở rộng file). */
export function getImageMatchToken(img: ElementFormImage): string {
  const raw = (img.name || "").trim();
  if (!raw) return "";
  const withoutExt = raw.replace(/\.[^./\\]+$/, "").trim();
  return withoutExt.toLowerCase();
}

export function elementFormImageToDataUrl(img: ElementFormImage): string {
  if (img.fifeUrl) return img.fifeUrl;
  const mime = img.mimeType || "image/png";
  return `data:${mime};base64,${img.imageBytes}`;
}

export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function getElementFormImagePreviewSrc(img: ElementFormImage): string | null {
  if (!img.imageBytes && !img.fifeUrl) return null;
  if (img.fifeUrl) return img.fifeUrl;
  return base64ToBlobUrl(img.imageBytes, img.mimeType || "image/png");
}

/**
 * Chuyển 3 ô ảnh tham chiếu (theo thứ tự) thành payload cho API generation-video.
 * Ưu tiên imageBytes trong slot; nếu chỉ có URL thì fetch/chuẩn hóa data URL.
 */
export async function elementImageSlotsToApiImages(
  slots: (ElementFormImage | undefined)[] | undefined
): Promise<{ imageBytes: string; mimeType: string }[]> {
  if (!slots?.length) return [];
  const out: { imageBytes: string; mimeType: string }[] = [];
  for (const img of slots) {
    if (!img || (!img.imageBytes && !img.fifeUrl)) continue;
    try {
      if (img.imageBytes) {
        out.push({
          imageBytes: img.imageBytes,
          mimeType: img.mimeType || "image/png",
        });
        continue;
      }
      const url = img.fifeUrl;
      const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
      if (dataMatch) {
        out.push({ mimeType: dataMatch[1], imageBytes: dataMatch[2] });
        continue;
      }
      const resp = await fetch(url);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      out.push({ mimeType: blob.type || img.mimeType || "image/png", imageBytes: base64 });
    } catch (err) {
      console.warn("[elementImageSlotsToApiImages] Failed to convert slot image:", err);
    }
  }
  return out;
}
