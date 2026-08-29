/**
 * batchMergeVideos.ts
 * Nối nhiều video scene (thường / stitch) thành 1 file MP4 bằng ffmpeg.wasm (browser).
 */
import { mergeVideosInBrowser } from "../../../video-affiliate-plus/ffmpeg-browser";
import {
  collectSceneVideoFiles,
  type SceneWithNumber,
} from "./batchDownloadMedia";
import {
  generatedVideoToBlob,
  hasGeneratedVideoData,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";
import { triggerBlobDownload } from "./videoDownloadUtils";

const MAX_MERGE_VIDEOS = 20;

export type MergeVideoKind = "normal" | "stitch";

function sortScenesByNumber<T extends SceneWithNumber>(scenes: T[]): T[] {
  return [...scenes].sort(
    (a, b) => (a.sceneNumber ?? Number.MAX_SAFE_INTEGER) - (b.sceneNumber ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Id phân cảnh cuối (không disabled) — scene này không có video nối, dùng video đơn khi ghép. */
export function getLastEligibleSceneId<T extends SceneWithNumber>(scenes: T[]): string | null {
  const eligible = sortScenesByNumber(scenes.filter((s) => !s.disabled));
  return eligible.length > 0 ? eligible[eligible.length - 1].id : null;
}

/**
 * Thu thập video để ghép tab "Video nối":
 * - Các phân cảnh trước cuối: video nối (`id::stitch`)
 * - Phân cảnh cuối cùng: video đơn (`id`) — vì scene cuối không tạo được stitch
 */
export async function collectSceneStitchVideoFiles<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>,
  options?: {
    /** Danh sách đầy đủ (chưa filter theo selection) để xác định phân cảnh cuối thật */
    allScenes?: T[];
  }
): Promise<{ scene: T; vid: GeneratedVideoLike }[]> {
  const lastSceneId = getLastEligibleSceneId(options?.allScenes ?? scenes);
  const eligible = sortScenesByNumber(scenes.filter((s) => !s.disabled));
  const result: { scene: T; vid: GeneratedVideoLike }[] = [];
  for (const scene of eligible) {
    const isLastScene = lastSceneId != null && scene.id === lastSceneId;
    const vid = isLastScene
      ? await getGeneratedVideo(scene.id)
      : await getGeneratedVideo(scene.id + "::stitch");
    if (hasGeneratedVideoData(vid)) {
      result.push({ scene, vid: vid! });
    }
  }
  return result;
}

/** Số video có thể ghép ở tab Video nối (stitch + video đơn cảnh cuối). */
export async function countAvailableStitchMergeVideos<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<number> {
  const items = await collectSceneStitchVideoFiles(scenes, getGeneratedVideo);
  return items.length;
}

async function collectVideoBlobs(videos: GeneratedVideoLike[]): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (let i = 0; i < videos.length; i++) {
    try {
      blobs.push(await generatedVideoToBlob(videos[i]));
    } catch (err: any) {
      throw new Error(
        `Không lấy được video số ${i + 1} để nối — link CDN có thể đã hết hạn và chưa lưu IndexedDB. Hãy generate lại scene đó.\n(${
          err?.message || err
        })`
      );
    }
  }
  return blobs;
}

export async function mergeSceneVideosAndDownload<T extends SceneWithNumber>(options: {
  scenes: T[];
  kind: MergeVideoKind;
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  fileName?: string;
  /** Chỉ ghép các scene đã chọn (theo scene.id). Bỏ trống = tất cả scene đủ video. */
  sceneIds?: string[];
  /** Tiến độ ffmpeg.wasm (0..1) + message */
  onProgress?: (ratio: number, message: string) => void;
}): Promise<number> {
  const { kind, getGeneratedVideo, sceneIds } = options;
  const scenes =
    sceneIds && sceneIds.length > 0
      ? options.scenes.filter((s) => sceneIds.includes(s.id))
      : options.scenes;

  const items =
    kind === "stitch"
      ? await collectSceneStitchVideoFiles(scenes, getGeneratedVideo, {
          allScenes: options.scenes,
        })
      : await collectSceneVideoFiles(scenes, getGeneratedVideo);

  if (items.length < 2) {
    throw new Error(
      kind === "stitch"
        ? "Cần ít nhất 2 video (nối + video đơn cảnh cuối) để ghép thành 1 file"
        : "Cần ít nhất 2 video thường để ghép thành 1 file"
    );
  }

  if (items.length > MAX_MERGE_VIDEOS) {
    throw new Error(`Tối đa ${MAX_MERGE_VIDEOS} video mỗi lần nối (hiện có ${items.length})`);
  }

  const videos = items.map((i) => i.vid);
  const blobs = await collectVideoBlobs(videos);
  const blob = await mergeVideosInBrowser(blobs, {
    onProgress: options.onProgress
      ? (p) => options.onProgress!(p.ratio, p.message)
      : undefined,
  });

  const date = new Date().toISOString().slice(0, 10);
  const fileName =
    options.fileName ||
    (kind === "stitch" ? `merged-extend-videos-${date}.mp4` : `merged-videos-${date}.mp4`);
  triggerBlobDownload(blob, fileName);
  return items.length;
}

/**
 * Nối video scene thành 1 Blob (không download) — dùng cho auto-post MXH.
 * 1 video → trả blob của video đó; ≥2 → ffmpeg merge.
 */
export async function mergeSceneVideosToBlob<T extends SceneWithNumber>(options: {
  scenes: T[];
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  sceneIds: string[];
  onProgress?: (ratio: number, message: string) => void;
}): Promise<{ blob: Blob; count: number }> {
  const scenes = options.scenes.filter((s) => options.sceneIds.includes(s.id) && !s.disabled);
  const items = await collectSceneVideoFiles(scenes, options.getGeneratedVideo);
  if (items.length === 0) {
    throw new Error("Chưa có video nào để đăng — hãy tạo video cho các cảnh trong nhóm");
  }
  if (items.length === 1) {
    const blob = await generatedVideoToBlob(items[0].vid);
    return { blob, count: 1 };
  }
  if (items.length > MAX_MERGE_VIDEOS) {
    throw new Error(`Tối đa ${MAX_MERGE_VIDEOS} video mỗi lần nối (hiện có ${items.length})`);
  }
  const blobs = await collectVideoBlobs(items.map((i) => i.vid));
  const blob = await mergeVideosInBrowser(blobs, {
    onProgress: options.onProgress
      ? (p) => options.onProgress!(p.ratio, p.message)
      : undefined,
  });
  return { blob, count: items.length };
}
