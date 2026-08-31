/**
 * Xóa watermark 1 ảnh/video rồi thay file gốc bằng blob + blob URL.
 */
import type { CleanWatermarkProcessed } from "../remove-logo/hook/useRemoveLogoApi";
import { requestCleanWatermark } from "../remove-logo/hook/cleanWatermarkClient";
import { base64ToBlob as watermarkBase64ToBlob, stripToPureBase64 } from "../remove-logo/constants";
import {
  fetchUrlToBlob,
  rememberClearedGeneratedImage,
  toUiGeneratedImage,
  toUiGeneratedVideo,
  type GeneratedImageLike,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";
import { notifyGeneratedMediaReplaced } from "./generatedMediaReplaceBus";
import { triggerBlobDownload } from "./videoDownloadUtils";

export type ClearVideoBlobWatermarkResult = {
  blob: Blob;
  cleared: boolean;
  warning?: string;
};

async function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Xóa logo AI trên blob video (vd. sau nối cảnh, trước đăng MXH). Lỗi/hết hạn mức → giữ blob gốc. */
export async function clearVideoBlobWatermark(args: {
  blob: Blob;
  clientId: string;
  name?: string;
  mimeType?: string;
}): Promise<ClearVideoBlobWatermarkResult> {
  const mimeType = args.mimeType || args.blob.type || "video/mp4";
  try {
    const mediaBase64 = await blobToRawBase64(args.blob);
    const result = await requestCleanWatermark([
      {
        clientId: args.clientId,
        kind: "video",
        mediaBase64,
        mimeType,
        name: args.name || "merged-social-post.mp4",
      },
    ]);

    const processed =
      result.processed.find((p) => p.clientId === args.clientId) || result.processed[0];
    const skipped =
      result.skipped.find((s) => s.clientId === args.clientId) || result.skipped[0];

    if (skipped) {
      return { blob: args.blob, cleared: false, warning: skipped.reason };
    }
    if (!processed) {
      return {
        blob: args.blob,
        cleared: false,
        warning: "Không nhận được kết quả xóa logo",
      };
    }

    const clearedBlob = await cleanedResultToBlob(processed);
    return { blob: clearedBlob, cleared: true };
  } catch (err) {
    console.warn("[clearVideoBlobWatermark]", err);
    return {
      blob: args.blob,
      cleared: false,
      warning: err instanceof Error ? err.message : "Lỗi xóa logo AI",
    };
  }
}

export async function cleanedResultToBlob(processed: CleanWatermarkProcessed): Promise<Blob> {
  const mime = processed.mimeType || (processed.kind === "video" ? "video/mp4" : "image/jpeg");
  if (processed.mediaBase64) {
    const blob = watermarkBase64ToBlob(stripToPureBase64(processed.mediaBase64), mime);
    if (blob?.size) return blob;
  }
  if (processed.url) {
    const fetched = await fetchUrlToBlob(processed.url, mime);
    if (fetched?.size) return fetched;
  }
  throw new Error("Không nhận được dữ liệu đã xóa logo");
}

export function buildReplacedImage<T extends GeneratedImageLike>(
  original: T,
  blob: Blob,
  mimeType: string
): T {
  return toUiGeneratedImage({
    ...original,
    mediaBlob: blob,
    mimeType: mimeType || blob.type || original.mimeType || "image/jpeg",
    imageBytes: "",
    previewUrl: undefined,
    fifeUrl: original.fifeUrl || "",
  } as T);
}

export function buildReplacedVideo<T extends GeneratedVideoLike>(
  original: T,
  blob: Blob,
  mimeType: string
): T {
  return toUiGeneratedVideo({
    ...original,
    mediaBlob: blob,
    mimeType: mimeType || blob.type || original.mimeType || "video/mp4",
    videoBytes: null,
    previewUrl: undefined,
    videoUri: original.videoUri ?? null,
  } as T);
}

export async function persistCleanedImage<T extends GeneratedImageLike>(args: {
  sceneId: string;
  original: T;
  blob: Blob;
  mimeType: string;
  save: (sceneId: string, data: T) => Promise<void>;
  downloadNow?: boolean;
  fileName?: string;
}): Promise<T> {
  const next = buildReplacedImage(args.original, args.blob, args.mimeType);
  if (args.downloadNow && args.fileName) {
    triggerBlobDownload(args.blob, args.fileName);
  }
  await args.save(args.sceneId, next);
  rememberClearedGeneratedImage(args.sceneId, next);
  notifyGeneratedMediaReplaced({ sceneId: args.sceneId, kind: "image", image: next });
  return next;
}

export async function persistCleanedVideo<T extends GeneratedVideoLike>(args: {
  sceneId: string;
  storageKey: string;
  original: T;
  blob: Blob;
  mimeType: string;
  isStitch?: boolean;
  save: (sceneId: string, data: T) => Promise<void>;
  downloadNow?: boolean;
  fileName?: string;
}): Promise<T> {
  const next = buildReplacedVideo(args.original, args.blob, args.mimeType);
  if (args.downloadNow && args.fileName) {
    triggerBlobDownload(args.blob, args.fileName);
  }
  await args.save(args.storageKey, next);
  notifyGeneratedMediaReplaced({
    sceneId: args.sceneId,
    kind: args.isStitch ? "extend" : "video",
    video: next,
  });
  return next;
}
