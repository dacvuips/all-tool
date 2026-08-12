/**
 * Xóa watermark 1 ảnh/video rồi thay file gốc bằng blob + blob URL.
 */
import type { CleanWatermarkProcessed } from "../remove-logo/hook/useRemoveLogoApi";
import { base64ToBlob as watermarkBase64ToBlob, stripToPureBase64 } from "../remove-logo/constants";
import {
  fetchUrlToBlob,
  toUiGeneratedImage,
  toUiGeneratedVideo,
  type GeneratedImageLike,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";
import { notifyGeneratedMediaReplaced } from "./generatedMediaReplaceBus";
import { triggerBlobDownload } from "./videoDownloadUtils";

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
  notifyGeneratedMediaReplaced({ sceneId: args.sceneId, kind: "image" });
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
  });
  return next;
}
