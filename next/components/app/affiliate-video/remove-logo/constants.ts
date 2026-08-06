/** Constants cho tab Xóa Logo AI */
export const REMOVE_LOGO_IMAGE_MAX_MB = 10;
export const REMOVE_LOGO_VIDEO_MAX_MB = 50;
export const REMOVE_LOGO_MAX_FILES = 20;

export const REMOVE_LOGO_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const REMOVE_LOGO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const REMOVE_LOGO_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export type RemoveLogoMediaKind = "image" | "video";

export type RemoveLogoUploadItem = {
  id: string;
  kind: RemoveLogoMediaKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** pure base64 */
  mediaBase64: string;
  /** blob URL for preview */
  previewUrl: string;
  status: "ready" | "processing" | "done" | "error" | "skipped";
  errorMessage?: string;
};

export type RemoveLogoHistoryItem = {
  id: string;
  kind: RemoveLogoMediaKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  originalBase64: string;
  cleanedBase64: string;
  cleanedMimeType: string;
  cleanedUrl?: string;
  requestId?: string;
  credits: number;
  createdAt: number;
};

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeImageMime(mime?: string, fallback = "image/jpeg"): string {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (!m) return fallback;
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

/** Lấy pure base64 (bỏ data: prefix + whitespace + chuẩn hóa base64url). */
export function stripToPureBase64(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const marker = "base64,";
  const idx = trimmed.toLowerCase().indexOf(marker);
  let pure = (idx >= 0 ? trimmed.slice(idx + marker.length) : trimmed).replace(/\s/g, "");
  // base64url → standard
  pure = pure.replace(/-/g, "+").replace(/_/g, "/");
  const pad = pure.length % 4;
  if (pad) pure += "=".repeat(4 - pad);
  return pure;
}

export function base64ByteLength(base64: string): number {
  const cleaned = stripToPureBase64(base64);
  if (!cleaned) return 0;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

export function toDataUrl(base64: string, mimeType: string): string {
  if (!base64) return "";
  const pure = stripToPureBase64(base64);
  if (!pure) return "";
  return `data:${normalizeImageMime(mimeType)};base64,${pure}`;
}

/** Blob URL ổn định hơn data: URL dài (tránh img trắng / hỏng decode). */
export function base64ToObjectUrl(base64: string, mimeType: string): string | null {
  const pure = stripToPureBase64(base64);
  if (!pure) return null;
  try {
    const binary = atob(pure);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: normalizeImageMime(mimeType) });
    if (!blob.size) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function downloadBase64(base64: string, mimeType: string, fileName: string) {
  const objectUrl = base64ToObjectUrl(base64, mimeType);
  const href = objectUrl || toDataUrl(base64, mimeType);
  if (!href) return;
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

/**
 * Copy ảnh vào clipboard hệ thống.
 * Chrome/Edge chỉ nhận image/png — convert JPEG/WebP → PNG qua canvas.
 */
export async function copyImageToClipboard(args: {
  base64?: string | null;
  mimeType?: string;
  srcUrl?: string | null;
}): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Trình duyệt không hỗ trợ copy ảnh");
  }

  const pngBlob = await resolveImageAsPngBlob(args);
  if (!pngBlob || !pngBlob.size) {
    throw new Error("Không đọc được dữ liệu ảnh");
  }

  // ClipboardItem yêu cầu đúng type image/png trên Chromium
  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": pngBlob,
    }),
  ]);
}

async function resolveImageAsPngBlob(args: {
  base64?: string | null;
  mimeType?: string;
  srcUrl?: string | null;
}): Promise<Blob | null> {
  // 1) Ưu tiên base64 gốc (không phụ thuộc blob URL đã revoke)
  if (args.base64) {
    const pure = stripToPureBase64(args.base64);
    if (pure) {
      const mime = normalizeImageMime(args.mimeType);
      try {
        const binary = atob(pure);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const sourceBlob = new Blob([bytes], { type: mime });
        if (mime === "image/png") return sourceBlob;
        return await blobToPngBlob(sourceBlob);
      } catch {
        // fall through
      }
    }
  }

  // 2) fallback từ src (blob: / data: / https:)
  if (args.srcUrl) {
    const res = await fetch(args.srcUrl);
    if (!res.ok) throw new Error("Không tải được ảnh để copy");
    const blob = await res.blob();
    if ((blob.type || "").toLowerCase() === "image/png") return blob;
    return await blobToPngBlob(blob);
  }

  return null;
}

function blobToPngBlob(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (!canvas.width || !canvas.height) {
          URL.revokeObjectURL(url);
          reject(new Error("Ảnh không có kích thước hợp lệ"));
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas không khả dụng"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (png) => {
            URL.revokeObjectURL(url);
            if (!png) reject(new Error("Chuyển PNG thất bại"));
            else resolve(png);
          },
          "image/png",
          1
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không decode được ảnh"));
    };
    img.src = url;
  });
}

export function makeCleanedFileName(name: string, kind: RemoveLogoMediaKind): string {
  const base = name.replace(/\.[^.]+$/, "") || "cleaned";
  const ext =
    kind === "video"
      ? name.match(/\.(mp4|webm|mov)$/i)?.[1]?.toLowerCase() || "mp4"
      : name.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase() || "jpg";
  return `${base}-no-logo.${ext}`;
}

export function base64ToBlob(base64: string, mimeType: string): Blob | null {
  const pure = stripToPureBase64(base64);
  if (!pure) return null;
  try {
    const binary = atob(pure);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: normalizeImageMime(mimeType) || mimeType || "application/octet-stream" });
    return blob.size ? blob : null;
  } catch {
    return null;
  }
}

/** Tạo tên file unique trong ZIP khi trùng tên. */
export function uniqueZipFileName(used: Set<string>, fileName: string): string {
  if (!used.has(fileName)) {
    used.add(fileName);
    return fileName;
  }
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  let i = 2;
  let next = `${base}-${i}${ext}`;
  while (used.has(next)) {
    i += 1;
    next = `${base}-${i}${ext}`;
  }
  used.add(next);
  return next;
}

/**
 * Tải hàng loạt kết quả đã clear (zip).
 * @returns số file đã đóng gói
 */
export async function downloadHistoryBatchAsZip(
  items: RemoveLogoHistoryItem[],
  kind: RemoveLogoMediaKind,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const target = items.filter(
    (it) => it.kind === kind && !!(it.cleanedBase64 || it.cleanedUrl)
  );
  if (!target.length) return 0;

  const { default: JSZip } = await import("jszip");
  const { saveAs } = await import("file-saver");
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let packed = 0;

  for (let i = 0; i < target.length; i++) {
    const item = target[i];
    let blob: Blob | null = null;

    if (item.cleanedBase64) {
      blob = base64ToBlob(
        item.cleanedBase64,
        item.cleanedMimeType || item.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg")
      );
    }

    if (!blob && item.cleanedUrl) {
      try {
        const res = await fetch(item.cleanedUrl);
        if (res.ok) blob = await res.blob();
      } catch {
        // skip
      }
    }

    if (!blob?.size) {
      onProgress?.(i + 1, target.length);
      continue;
    }

    const fileName = uniqueZipFileName(usedNames, makeCleanedFileName(item.name, kind));
    zip.file(fileName, await blob.arrayBuffer());
    packed += 1;
    onProgress?.(i + 1, target.length);
  }

  if (!packed) return 0;

  const date = new Date().toISOString().slice(0, 10);
  const zipName =
    kind === "image" ? `remove-logo-images-${date}.zip` : `remove-logo-videos-${date}.zip`;
  const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  saveAs(content, zipName);
  return packed;
}
