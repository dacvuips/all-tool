/**
 * Tùy chọn tự động tải ảnh/video ngay sau khi gen xong.
 * Lưu mặc định toàn cục trong localStorage; mỗi scene có thể bật/tắt riêng qua `noDownload`.
 *
 * Lưu ý: `noDownload=true` nghĩa là BẬT tự động tải (theo UI hiện tại).
 */
import { CACHE_KEY } from "../constants";
import type {
  AutoDownloadImageResolution,
  GeneratedImageLike,
  GeneratedVideoLike,
  VideoDownloadResolution,
} from "./generatedMediaUtils";
import {
  buildSceneVideoFileName,
  downloadSceneImageAtResolution,
  downloadVideoAtResolution,
  hasFlow2Upsample1080pVideoMeta,
  mimeTypeToFileExtension,
} from "./generatedMediaUtils";

const STORAGE_KEY = CACHE_KEY.autoDownloadAfterGen;
const IMAGE_RES_KEY = CACHE_KEY.autoDownloadImageResolution;
const VIDEO_RES_KEY = CACHE_KEY.autoDownloadVideoResolution;

const DEFAULT_IMAGE_RES: AutoDownloadImageResolution = "1K";
const DEFAULT_VIDEO_RES: VideoDownloadResolution = "720p";

export type { AutoDownloadImageResolution, VideoDownloadResolution };

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

export function getAutoDownloadImageResolutionDefault(): AutoDownloadImageResolution {
  try {
    if (typeof window === "undefined") return DEFAULT_IMAGE_RES;
    const stored = localStorage.getItem(IMAGE_RES_KEY);
    if (stored === "1K" || stored === "2K" || stored === "4K") return stored;
    return DEFAULT_IMAGE_RES;
  } catch {
    return DEFAULT_IMAGE_RES;
  }
}

export function setAutoDownloadImageResolutionDefault(
  resolution: AutoDownloadImageResolution
): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(IMAGE_RES_KEY, resolution);
  } catch {
    // ignore
  }
}

export function getAutoDownloadVideoResolutionDefault(): VideoDownloadResolution {
  try {
    if (typeof window === "undefined") return DEFAULT_VIDEO_RES;
    const stored = localStorage.getItem(VIDEO_RES_KEY);
    if (stored === "720p" || stored === "1080p") return stored;
    return DEFAULT_VIDEO_RES;
  } catch {
    return DEFAULT_VIDEO_RES;
  }
}

export function setAutoDownloadVideoResolutionDefault(
  resolution: VideoDownloadResolution
): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIDEO_RES_KEY, resolution);
  } catch {
    // ignore
  }
}

export function isAutoDownloadEnabled(scene: { noDownload?: boolean }): boolean {
  return scene.noDownload ?? getAutoDownloadDefault();
}

export function resolveAutoDownloadImageResolution(_scene?: {
  autoDownloadImageResolution?: AutoDownloadImageResolution;
}): AutoDownloadImageResolution {
  return _scene?.autoDownloadImageResolution ?? getAutoDownloadImageResolutionDefault();
}

export function resolveAutoDownloadVideoResolution(_scene?: {
  autoDownloadVideoResolution?: VideoDownloadResolution;
}): VideoDownloadResolution {
  return _scene?.autoDownloadVideoResolution ?? getAutoDownloadVideoResolutionDefault();
}

export function buildAutoDownloadOptions(
  scene: {
    noDownload?: boolean;
    sceneNumber?: number;
    autoDownloadImageResolution?: AutoDownloadImageResolution;
    autoDownloadVideoResolution?: VideoDownloadResolution;
  },
  isStitch?: boolean
): {
  autoDownload: boolean;
  sceneNumber?: number;
  isStitch?: boolean;
  autoDownloadImageResolution: AutoDownloadImageResolution;
  autoDownloadVideoResolution: VideoDownloadResolution;
} {
  return {
    autoDownload: isAutoDownloadEnabled(scene),
    sceneNumber: scene.sceneNumber,
    isStitch,
    autoDownloadImageResolution: resolveAutoDownloadImageResolution(scene),
    autoDownloadVideoResolution: resolveAutoDownloadVideoResolution(scene),
  };
}

export function triggerAutoDownloadAfterImageGen(
  imageData: GeneratedImageLike | undefined | null,
  options?: {
    autoDownload?: boolean;
    sceneNumber?: number;
    autoDownloadImageResolution?: AutoDownloadImageResolution;
  }
): void {
  if (!options?.autoDownload || !imageData || options.sceneNumber == null) return;
  const resolution = options.autoDownloadImageResolution ?? getAutoDownloadImageResolutionDefault();
  void downloadSceneImageAtResolution(imageData, options.sceneNumber, resolution).catch((err) =>
    console.error("[autoDownload] image:", err)
  );
}

export function triggerAutoDownloadAfterVideoGen(
  videoData: GeneratedVideoLike | undefined | null,
  options?: {
    autoDownload?: boolean;
    sceneNumber?: number;
    isStitch?: boolean;
    autoDownloadVideoResolution?: VideoDownloadResolution;
  }
): void {
  if (!options?.autoDownload || !videoData || options.sceneNumber == null) return;
  const resolution = options.autoDownloadVideoResolution ?? getAutoDownloadVideoResolutionDefault();
  const ext = mimeTypeToFileExtension(videoData.mimeType, "mp4");
  const base = options.sceneNumber;
  const fileName = options.isStitch
    ? `scene-${base}-stitch-video.${ext}`
    : buildSceneVideoFileName(base, videoData.mimeType);

  if (resolution === "1080p" && !hasFlow2Upsample1080pVideoMeta(videoData)) {
    console.warn("[autoDownload] Thiếu metadata 1080p, tải 720p thay thế");
    void downloadVideoAtResolution(videoData, fileName, "720p").catch((err) =>
      console.error("[autoDownload] video:", err)
    );
    return;
  }

  void downloadVideoAtResolution(videoData, fileName, resolution).catch((err) =>
    console.error("[autoDownload] video:", err)
  );
}
