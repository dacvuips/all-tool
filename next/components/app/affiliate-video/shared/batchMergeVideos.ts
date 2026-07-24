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

/** Tất cả đều có http URI → gửi JSON urls (nhanh). Ngược lại upload blob multipart. */
async function callMergeVideosApi(videos: GeneratedVideoLike[]): Promise<Blob> {
  const httpUrls = videos.map(getHttpVideoUri);
  const allHttp = httpUrls.every(Boolean);

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
  if (allHttp) {
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
      // Fallback multipart khi server không tải được URL
      const form = new FormData();
      for (let i = 0; i < videos.length; i++) {
        const blob = await generatedVideoToBlob(videos[i]);
        form.append("videos", blob, `scene-${i + 1}.mp4`);
      }
      res = await fetch("/api/app/merge-videos/", {
        method: "POST",
        credentials: "include",
        body: form,
      });
    }
  } else {
    const form = new FormData();
    for (let i = 0; i < videos.length; i++) {
      const blob = await generatedVideoToBlob(videos[i]);
      form.append("videos", blob, `scene-${i + 1}.mp4`);
    }
    res = await fetch("/api/app/merge-videos/", {
      method: "POST",
      credentials: "include",
      body: form,
    });
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
}): Promise<number> {
  const { scenes, kind, getGeneratedVideo } = options;

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
