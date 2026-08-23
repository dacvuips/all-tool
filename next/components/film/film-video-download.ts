/**
 * Tải hàng loạt video tab Tạo video — từng file, không ZIP.
 * Modes: 720p / 1080p / kèm xóa logo AI.
 */
import {
  cleanedResultToBlob,
} from "../app/affiliate-video/shared/batchClearWatermark";
import { downloadBlobSequentially } from "../app/affiliate-video/shared/batchDownloadMedia";
import {
  fetchUpsampled1080pVideoBlob,
  generatedVideoToApiBase64Input,
  generatedVideoToBlob,
  hasFlow2Upsample1080pVideoMeta,
  mimeTypeToFileExtension,
  type GeneratedVideoLike,
  type VideoDownloadResolution,
} from "../app/affiliate-video/shared/generatedMediaUtils";
import { requestCleanWatermark } from "../app/affiliate-video/remove-logo/hook/cleanWatermarkClient";
import { getFilmEntityVideoSrc } from "./api/generate-film-media";
import type { FilmAspectRatio, FilmSceneRecord } from "./film-types";

export type FilmDownloadVideoMode =
  | "720p"
  | "1080p"
  | "720p-no-logo"
  | "1080p-no-logo";

function sceneHasVideo(scene: FilmSceneRecord): boolean {
  return (
    !!(scene.videoUrl || "").trim() ||
    !!(scene.videoBlob && scene.videoBlob.size > 0)
  );
}

function modeResolution(mode: FilmDownloadVideoMode): VideoDownloadResolution {
  return mode.startsWith("1080") ? "1080p" : "720p";
}

function modeRemoveLogo(mode: FilmDownloadVideoMode): boolean {
  return mode.endsWith("-no-logo");
}

export function filmSceneToGeneratedVideo(
  scene: FilmSceneRecord,
  aspectRatio: FilmAspectRatio = "9:16"
): GeneratedVideoLike | null {
  if (!sceneHasVideo(scene)) return null;
  const src = getFilmEntityVideoSrc(scene);
  const url = src || (scene.videoUrl || "").trim();
  if (!url && !(scene.videoBlob && scene.videoBlob.size > 0)) return null;
  return {
    videoUri: url || null,
    mimeType: scene.videoBlob?.type || "video/mp4",
    previewUrl: url || undefined,
    mediaBlob: scene.videoBlob,
    aspectRatio,
    flow2RequestId: scene.videoFlow2RequestId,
  };
}

function buildFilmVideoFileName(
  scene: FilmSceneRecord,
  index: number,
  mode: FilmDownloadVideoMode,
  mime: string
): string {
  const n = scene.index > 0 ? scene.index : index + 1;
  const title = String(scene.title || scene.summary || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .slice(0, 40);
  const stem = title ? `scene-${n}-${title}` : `scene-${n}`;
  const ext = mimeTypeToFileExtension(mime, "mp4");
  const res = modeResolution(mode);
  const logo = modeRemoveLogo(mode) ? "-no-logo" : "";
  return `${stem}-${res}${logo}.${ext}`;
}

async function resolveFilmVideoBlobAtResolution(
  video: GeneratedVideoLike,
  resolution: VideoDownloadResolution
): Promise<Blob> {
  if (resolution === "1080p" && hasFlow2Upsample1080pVideoMeta(video)) {
    try {
      return await fetchUpsampled1080pVideoBlob(video);
    } catch (err) {
      console.warn("[film] 1080p upsample miss → 720p", err);
    }
  }
  return generatedVideoToBlob(video);
}

async function cleanFilmVideoBlob(blob: Blob, fileName: string): Promise<Blob> {
  const mime = blob.type || "video/mp4";
  const input = await generatedVideoToApiBase64Input({
    mediaBlob: blob,
    mimeType: mime,
  });
  const result = await requestCleanWatermark([
    {
      clientId: "film-video-dl",
      kind: "video",
      mediaBase64: input.videoBytes,
      mimeType: input.mimeType,
      name: fileName,
    },
  ]);
  const processed = result.processed?.[0];
  const skipped = result.skipped?.[0];
  if (skipped) {
    throw new Error(skipped.reason || "Xóa logo video thất bại");
  }
  if (!processed) {
    throw new Error("Không nhận được video đã xóa logo");
  }
  return cleanedResultToBlob(processed);
}

export type FilmDownloadVideosResult = {
  downloaded: number;
  failed: number;
  total: number;
};

/**
 * Tải tuần tự từng video ready — không ZIP.
 */
export async function downloadFilmVideosSequentially(
  scenes: FilmSceneRecord[],
  mode: FilmDownloadVideoMode,
  options?: {
    aspectRatio?: FilmAspectRatio;
    onProgress?: (current: number, total: number) => void;
    waitMs?: number;
  }
): Promise<FilmDownloadVideosResult> {
  const aspectRatio = options?.aspectRatio || "9:16";
  const waitMs = options?.waitMs ?? 3000;
  const ready = scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter(sceneHasVideo);

  const total = ready.length;
  let downloaded = 0;
  let failed = 0;
  const resolution = modeResolution(mode);
  const removeLogo = modeRemoveLogo(mode);

  for (let i = 0; i < total; i++) {
    const scene = ready[i];
    options?.onProgress?.(i + 1, total);
    const video = filmSceneToGeneratedVideo(scene, aspectRatio);
    if (!video) {
      failed++;
      continue;
    }
    try {
      let blob = await resolveFilmVideoBlobAtResolution(video, resolution);
      if (removeLogo) {
        const tempName = buildFilmVideoFileName(
          scene,
          i,
          mode,
          blob.type || video.mimeType || "video/mp4"
        );
        blob = await cleanFilmVideoBlob(blob, tempName);
      }
      const fileName = buildFilmVideoFileName(
        scene,
        i,
        mode,
        blob.type || video.mimeType || "video/mp4"
      );
      await downloadBlobSequentially(blob, fileName, waitMs);
      downloaded++;
    } catch (err) {
      failed++;
      console.error(`[downloadFilmVideosSequentially] scene ${scene.id}:`, err);
    }
  }

  return { downloaded, failed, total };
}
