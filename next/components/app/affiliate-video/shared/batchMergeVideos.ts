/**
 * batchMergeVideos.ts
 * Nối nhiều video scene (thường / stitch) thành 1 file MP4 qua /api/app/merge-videos/ (ffmpeg).
 */
import {
  collectSceneVideoFiles,
  type SceneWithNumber,
} from "./batchDownloadMedia";
import {
  generatedVideoToBlob,
  hasGeneratedVideoData,
  hasStoredGeneratedVideoBase64,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";
import { triggerBlobDownload } from "./videoDownloadUtils";

const MAX_MERGE_VIDEOS = 20;
const HTTP_URL = /^https?:\/\//i;

export type MergeVideoKind = "normal" | "stitch";

export async function collectSceneStitchVideoFiles<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<{ scene: T; vid: GeneratedVideoLike }[]> {
  const eligible = scenes.filter((s) => !s.disabled);
  const result: { scene: T; vid: GeneratedVideoLike }[] = [];
  for (const scene of eligible) {
    const vid = await getGeneratedVideo(scene.id + "::stitch");
    if (hasGeneratedVideoData(vid)) {
      result.push({ scene, vid: vid! });
    }
  }
  return result;
}

function getHttpVideoUri(video: GeneratedVideoLike): string | null {
  const uri = String(video.videoUri || "").trim();
  return HTTP_URL.test(uri) ? uri : null;
}

async function buildMergeFormData(videos: GeneratedVideoLike[]): Promise<FormData> {
  const form = new FormData();
  for (let i = 0; i < videos.length; i++) {
    try {
      const blob = await generatedVideoToBlob(videos[i]);
      form.append("videos", blob, `scene-${i + 1}.mp4`);
    } catch (err: any) {
      throw new Error(
        `Không lấy được video số ${i + 1} để nối — link CDN có thể đã hết hạn và chưa lưu IndexedDB. Hãy generate lại scene đó.\n(${
          err?.message || err
        })`
      );
    }
  }
  return form;
}

/**
 * Nối video qua API:
 * - Ưu tiên multipart từ mediaBlob IndexedDB (tránh flow2 hết hạn)
 * - Chỉ gửi JSON urls khi chưa có binary local
 * - URL fail (422 URL_DOWNLOAD_FAILED) → fallback upload blob
 */
async function callMergeVideosApi(videos: GeneratedVideoLike[]): Promise<Blob> {
  const httpUrls = videos.map(getHttpVideoUri);
  const allHttp = httpUrls.every(Boolean);
  const allHaveLocalBinary = videos.every((v) => hasStoredGeneratedVideoBase64(v));

  const parseMergeError = async (failedRes: Response) => {
    let message = `Nối video thất bại (${failedRes.status})`;
    let code = "";
    try {
      const json = await failedRes.json();
      if (json?.message) message = String(json.message);
      if (json?.code) code = String(json.code);
    } catch {
      // ignore
    }
    return { message, code };
  };

  let res: Response;
  // Có blob local → luôn upload multipart (CDN flow2 hay 404).
  if (allHaveLocalBinary || !allHttp) {
    res = await fetch("/api/app/merge-videos/", {
      method: "POST",
      credentials: "include",
      body: await buildMergeFormData(videos),
    });
  } else {
    res = await fetch("/api/app/merge-videos/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: httpUrls as string[] }),
    });

    if (!res.ok) {
      const { message, code } = await parseMergeError(res);
      if (code !== "URL_DOWNLOAD_FAILED") {
        throw new Error(message);
      }
      // Server không tải được URL (CDN hết hạn) → upload blob nếu còn trong IDB
      res = await fetch("/api/app/merge-videos/", {
        method: "POST",
        credentials: "include",
        body: await buildMergeFormData(videos),
      });
    }
  }

  if (!res.ok) {
    const { message } = await parseMergeError(res);
    throw new Error(message);
  }

  return res.blob();
}

export async function mergeSceneVideosAndDownload<T extends SceneWithNumber>(options: {
  scenes: T[];
  kind: MergeVideoKind;
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  fileName?: string;
  /** Chỉ ghép các scene đã chọn (theo scene.id). Bỏ trống = tất cả scene đủ video. */
  sceneIds?: string[];
}): Promise<number> {
  const { kind, getGeneratedVideo, sceneIds } = options;
  const scenes =
    sceneIds && sceneIds.length > 0
      ? options.scenes.filter((s) => sceneIds.includes(s.id))
      : options.scenes;

  const items =
    kind === "stitch"
      ? await collectSceneStitchVideoFiles(scenes, getGeneratedVideo)
      : await collectSceneVideoFiles(scenes, getGeneratedVideo);

  if (items.length < 2) {
    throw new Error(
      kind === "stitch"
        ? "Cần ít nhất 2 video nối để ghép thành 1 file"
        : "Cần ít nhất 2 video thường để ghép thành 1 file"
    );
  }

  if (items.length > MAX_MERGE_VIDEOS) {
    throw new Error(`Tối đa ${MAX_MERGE_VIDEOS} video mỗi lần nối (hiện có ${items.length})`);
  }

  const videos = items.map((i) => i.vid);
  const blob = await callMergeVideosApi(videos);
  const date = new Date().toISOString().slice(0, 10);
  const fileName =
    options.fileName ||
    (kind === "stitch" ? `merged-extend-videos-${date}.mp4` : `merged-videos-${date}.mp4`);
  triggerBlobDownload(blob, fileName);
  return items.length;
}
