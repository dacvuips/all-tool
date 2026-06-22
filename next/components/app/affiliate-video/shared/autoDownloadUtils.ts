/**
 * Tùy chọn tự động tải ảnh/video ngay sau khi gen xong.
 * Lưu mặc định toàn cục trong localStorage; mỗi scene có thể bật/tắt riêng qua `noDownload`.
 *
 * Lưu ý: `noDownload=true` nghĩa là BẬT tự động tải (theo UI hiện tại).
 */
import { CACHE_KEY } from "../constants";
import type { GeneratedImageLike, GeneratedVideoLike } from "./generatedMediaUtils";
import { downloadGeneratedVideo, downloadSceneImage } from "./generatedMediaUtils";

const STORAGE_KEY = CACHE_KEY.autoDownloadAfterGen;

export function getAutoDownloadDefault(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAutoDownloadDefault(enabled: boolean): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore quota / private mode
  }
}

export function isAutoDownloadEnabled(scene: { noDownload?: boolean }): boolean {
  return scene.noDownload ?? getAutoDownloadDefault();
}

export function buildAutoDownloadOptions(
  scene: { noDownload?: boolean; sceneNumber?: number },
  isStitch?: boolean
): {
  autoDownload: boolean;
  sceneNumber?: number;
  isStitch?: boolean;
} {
  return {
    autoDownload: isAutoDownloadEnabled(scene),
    sceneNumber: scene.sceneNumber,
    isStitch,
  };
}

export function triggerAutoDownloadAfterImageGen(
  imageData: GeneratedImageLike | undefined | null,
  options?: { autoDownload?: boolean; sceneNumber?: number }
): void {
  if (!options?.autoDownload || !imageData || options.sceneNumber == null) return;
  void downloadSceneImage(imageData, options.sceneNumber).catch((err) =>
    console.error("[autoDownload] image:", err)
  );
}

export function triggerAutoDownloadAfterVideoGen(
  videoData: GeneratedVideoLike | undefined | null,
  options?: { autoDownload?: boolean; sceneNumber?: number; isStitch?: boolean }
): void {
  if (!options?.autoDownload || !videoData || options.sceneNumber == null) return;
  const ext = videoData.mimeType?.split("/")[1] || "mp4";
  const base = options.sceneNumber;
  const fileName = options.isStitch
    ? `scene-${base}-stitch-video.${ext}`
    : `scene-${base}-video.${ext}`;
  void downloadGeneratedVideo(videoData, fileName).catch((err) =>
    console.error("[autoDownload] video:", err)
  );
}
