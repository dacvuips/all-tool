/**
 * Xuất timeline Studio → MP4 (video + audio) và/hoặc MP3 (audio mix).
 * Chạy ffmpeg.wasm trong browser.
 */
import {
    toDownloadProxyUrl,
    triggerBlobDownload,
    uriToBlob,
} from "../app/affiliate-video/shared/videoDownloadUtils";
import {
    burnSubtitlesOntoVideoInBrowser,
    destroyFFmpegInstance,
    mergeVideosInBrowser,
    mixTimedAudioClipsInBrowser,
    muxVideoAndAudioInBrowser,
    scaleVideoInBrowser,
    trimAudioInBrowser,
    trimVideoInBrowser,
    type FfmpegMergeProgress,
    type FfmpegSubtitleCue,
} from "../video-affiliate-plus/ffmpeg-browser";
import {
    buildFilmStudioTimeline,
    type FilmStudioSubtitleClip,
    type FilmStudioVideoClip,
    type FilmStudioVoiceClip,
} from "./film-studio-timeline";
import type { FilmSceneRecord } from "./film-types";

export type FilmStudioExportProgress = {
  ratio: number;
  message: string;
};

export type FilmStudioExportFormat = "mp4" | "mp3";

export type FilmStudioExportResolution = "source" | "1080p";

export type FilmStudioExportResult = {
  mp4?: Blob;
  mp3?: Blob;
  /** hard = chữ đã burn vào khung; none = không gắn được; skipped = không có/không bật */
  subtitleMode?: "hard" | "soft" | "none" | "skipped";
};

function resolveExportMediaSrc(url?: string | null): string {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return toDownloadProxyUrl(s, true);
  return s;
}

function throwIfExportAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Đã dừng xuất", "AbortError");
  }
}

export function isFilmStudioExportAbortError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name || "";
  const msg = err instanceof Error ? err.message : String(err);
  return (
    name === "AbortError" ||
    /đã dừng/i.test(msg) ||
    /aborted/i.test(msg) ||
    /The operation was aborted/i.test(msg)
  );
}

function mapProgress(
  onProgress: ((p: FilmStudioExportProgress) => void) | undefined,
  from: number,
  to: number,
  prefix?: string,
  _signal?: AbortSignal
) {
  return (p: FfmpegMergeProgress) => {
    const ratio = from + (to - from) * Math.min(1, Math.max(0, p.ratio));
    onProgress?.({
      ratio,
      message: prefix ? `${prefix}: ${p.message}` : p.message,
    });
  };
}

async function loadVoiceBlob(clip: FilmStudioVoiceClip): Promise<Blob | null> {
  if (clip.voiceBlob && clip.voiceBlob.size > 0) return clip.voiceBlob;
  const src = resolveExportMediaSrc(clip.voiceUrl);
  if (!src) return null;
  try {
    return await uriToBlob(src);
  } catch {
    return null;
  }
}

async function buildTrimmedVideoBlob(
  clips: FilmStudioVideoClip[],
  scenesById: Map<string, FilmSceneRecord>,
  onProgress?: (p: FilmStudioExportProgress) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; durationSec: number } | null> {
  const ready = clips.filter((c) => {
    if (!c.ready) return false;
    const scene = scenesById.get(c.sceneId);
    if (scene?.videoBlob && scene.videoBlob.size > 0) return true;
    return !!resolveExportMediaSrc(c.videoUrl || scene?.videoUrl);
  });
  if (!ready.length) return null;

  const trimmed: Blob[] = [];
  let durationSec = 0;
  for (let i = 0; i < ready.length; i += 1) {
    throwIfExportAborted(signal);
    const clip = ready[i];
    onProgress?.({
      ratio: 0.05 + (i / ready.length) * 0.35,
      message: `Đang cắt video ${i + 1}/${ready.length}...`,
    });
    const scene = scenesById.get(clip.sceneId);
    let source: Blob | null = null;
    if (scene?.videoBlob && scene.videoBlob.size > 0) {
      source = scene.videoBlob;
    } else {
      const src = resolveExportMediaSrc(clip.videoUrl || scene?.videoUrl);
      if (src) {
        try {
          source = await uriToBlob(src);
        } catch {
          source = null;
        }
      }
    }
    throwIfExportAborted(signal);
    if (!source) continue;
    const start = Math.max(0, clip.trimInSec || 0);
    const end = start + Math.max(0.05, clip.durationSec || 0.05);
    const piece = await trimVideoInBrowser(source, start, end, {
      onProgress: mapProgress(
        onProgress,
        0.05 + (i / ready.length) * 0.35,
        0.05 + ((i + 1) / ready.length) * 0.35,
        undefined,
        signal
      ),
    });
    throwIfExportAborted(signal);
    trimmed.push(piece);
    durationSec += clip.durationSec;
  }

  if (!trimmed.length) return null;

  throwIfExportAborted(signal);
  onProgress?.({ ratio: 0.42, message: "Đang nối video..." });
  const blob =
    trimmed.length === 1
      ? trimmed[0]
      : await mergeVideosInBrowser(trimmed, {
          onProgress: mapProgress(onProgress, 0.42, 0.55, "Nối video", signal),
        });
  throwIfExportAborted(signal);
  return { blob, durationSec };
}

async function buildMixedAudioBlob(
  voiceClips: FilmStudioVoiceClip[],
  totalSec: number,
  onProgress?: (p: FilmStudioExportProgress) => void,
  signal?: AbortSignal
): Promise<Blob | null> {
  const withAudio = voiceClips.filter((c) => !!(c.voiceUrl || c.voiceBlob));
  if (!withAudio.length) return null;

  const timed: Array<{ blob: Blob; startSec: number; name?: string }> = [];
  for (let i = 0; i < withAudio.length; i += 1) {
    throwIfExportAborted(signal);
    const clip = withAudio[i];
    onProgress?.({
      ratio: 0.55 + (i / withAudio.length) * 0.15,
      message: `Đang cắt audio ${i + 1}/${withAudio.length}...`,
    });
    const source = await loadVoiceBlob(clip);
    throwIfExportAborted(signal);
    if (!source) continue;
    const trimIn = Math.max(0, clip.trimInSec || 0);
    const end = trimIn + Math.max(0.05, clip.durationSec || 0.05);
    const trimmed = await trimAudioInBrowser(source, trimIn, end, {
      fileName: clip.label || "audio.mp3",
      onProgress: mapProgress(
        onProgress,
        0.55 + (i / withAudio.length) * 0.15,
        0.55 + ((i + 1) / withAudio.length) * 0.15,
        undefined,
        signal
      ),
    });
    throwIfExportAborted(signal);
    timed.push({
      blob: trimmed.blob,
      startSec: Math.max(0, clip.startSec || 0),
      name: `clip_${i}.${trimmed.mimeType.includes("wav") ? "wav" : "mp3"}`,
    });
  }

  if (!timed.length) return null;

  const audioEnd = Math.max(
    totalSec,
    ...timed.map((c) => c.startSec + 0.05),
    ...withAudio.map((c) => c.startSec + c.durationSec)
  );

  throwIfExportAborted(signal);
  onProgress?.({ ratio: 0.72, message: "Đang mix audio theo timeline..." });
  const mixed = await mixTimedAudioClipsInBrowser(timed, audioEnd, {
    onProgress: mapProgress(onProgress, 0.72, 0.88, "Mix audio", signal),
  });
  throwIfExportAborted(signal);
  return mixed;
}

function buildSubtitleCues(
  clips: FilmStudioSubtitleClip[]
): FfmpegSubtitleCue[] {
  return clips
    .filter((c) => c.enabled !== false)
    .map((c) => {
      // Không ghi tên nhân vật vào phụ đề
      const text = String(c.text || "").trim();
      return {
        startSec: Math.max(0, c.startSec || 0),
        endSec: Math.max(0, (c.startSec || 0) + Math.max(0.05, c.durationSec || 0.05)),
        text,
      };
    })
    .filter((c) => c.text && c.endSec > c.startSec);
}

/**
 * Xuất timeline Studio.
 * - mp4: video + mix audio + burn phụ đề timeline (nếu bật)
 * - mp3: mix audio timeline (voice)
 */
export async function exportFilmStudioTimeline(
  scenes: FilmSceneRecord[],
  options: {
    formats?: FilmStudioExportFormat[];
    onProgress?: (p: FilmStudioExportProgress) => void;
    /** false = không burn phụ đề vào MP4 */
    burnSubtitles?: boolean;
    /** source = giữ độ phân giải gốc; 1080p = scale lên/xuống 1080 */
    resolution?: FilmStudioExportResolution;
    /** true khi aspect 9:16 — scale theo chiều rộng 1080 */
    portrait?: boolean;
    subtitleStyle?: {
      fontSizePx?: number;
      xPercent?: number;
      yPercent?: number;
      widthPercent?: number;
      textColor?: string;
      bgColor?: string;
      bgTransparent?: boolean;
      borderColor?: string;
      borderTransparent?: boolean;
    };
    /** Hủy xuất giữa chừng */
    signal?: AbortSignal;
  } = {}
): Promise<FilmStudioExportResult> {
  const formats = options.formats?.length ? options.formats : (["mp4", "mp3"] as FilmStudioExportFormat[]);
  const wantMp4 = formats.includes("mp4");
  const wantMp3 = formats.includes("mp3");
  const onProgress = options.onProgress;
  const burnSubtitles = options.burnSubtitles !== false;
  const want1080 = options.resolution === "1080p";
  const signal = options.signal;

  throwIfExportAborted(signal);

  const timeline = buildFilmStudioTimeline(scenes);
  const videoClips = timeline.videoClips;
  const voiceClips = timeline.voiceClips;
  const subtitleClips = timeline.subtitleClips;
  const scenesById = new Map(scenes.map((s) => [s.id, s]));

  const videoEnd =
    videoClips.length > 0
      ? Math.max(...videoClips.map((c) => c.startSec + c.durationSec))
      : 0;
  const audioEnd =
    voiceClips.length > 0
      ? Math.max(...voiceClips.map((c) => c.startSec + c.durationSec))
      : 0;
  const totalSec = Math.max(timeline.totalSec, videoEnd, audioEnd, 0.5);

  onProgress?.({ ratio: 0.02, message: "Chuẩn bị xuất timeline..." });

  let videoPart: { blob: Blob; durationSec: number } | null = null;
  if (wantMp4) {
    videoPart = await buildTrimmedVideoBlob(videoClips, scenesById, onProgress, signal);
    throwIfExportAborted(signal);
    if (!videoPart) {
      throw new Error("Chưa có video sẵn sàng trên timeline để xuất MP4");
    }
  }

  let audioPart: Blob | null = null;
  if (wantMp4 || wantMp3) {
    audioPart = await buildMixedAudioBlob(voiceClips, totalSec, onProgress, signal);
    throwIfExportAborted(signal);
  }

  const result: FilmStudioExportResult = {
    subtitleMode: "skipped",
  };

  if (wantMp3) {
    if (!audioPart) {
      if (!wantMp4) {
        throw new Error("Chưa có audio trên timeline để xuất MP3");
      }
    } else {
      result.mp3 = audioPart;
    }
  }

  if (wantMp4 && videoPart) {
    let mp4Blob = videoPart.blob;
    if (audioPart) {
      throwIfExportAborted(signal);
      onProgress?.({ ratio: 0.88, message: "Đang ghép video + audio (giữ tiếng gốc)..." });
      mp4Blob = await muxVideoAndAudioInBrowser(mp4Blob, audioPart, {
        onProgress: mapProgress(onProgress, 0.88, 0.92, "Mux", signal),
      });
      throwIfExportAborted(signal);
    }

    const cues = burnSubtitles ? buildSubtitleCues(subtitleClips) : [];
    if (cues.length) {
      throwIfExportAborted(signal);
      // Free wasm heap sau merge/mux trước khi burn (tránh memory access OOB).
      destroyFFmpegInstance();
      onProgress?.({ ratio: 0.92, message: "Đang gắn phụ đề vào video..." });
      try {
        const burned = await burnSubtitlesOntoVideoInBrowser(mp4Blob, cues, {
          onProgress: mapProgress(onProgress, 0.92, want1080 ? 0.96 : 0.99, "Phụ đề", signal),
          style: options.subtitleStyle,
          allowSoftSub: false,
        });
        throwIfExportAborted(signal);
        mp4Blob = burned.blob;
        result.subtitleMode = burned.mode;
        if (burned.mode === "hard") {
          onProgress?.({ ratio: want1080 ? 0.96 : 0.99, message: "Đã burn phụ đề vào video" });
        } else {
          onProgress?.({
            ratio: want1080 ? 0.96 : 0.99,
            message: "Không burn được phụ đề (thiếu RAM / font) — video vẫn xuất",
          });
        }
      } catch (err) {
        destroyFFmpegInstance();
        const msg = err instanceof Error ? err.message : String(err ?? "");
        if (/memory access out of bounds|out of bounds|out of memory/i.test(msg)) {
          result.subtitleMode = "none";
          onProgress?.({
            ratio: want1080 ? 0.96 : 0.99,
            message: "Burn phụ đề hết RAM — xuất video không phụ đề",
          });
        } else {
          throw err;
        }
      }
    } else if (burnSubtitles) {
      result.subtitleMode = "none";
    }

    if (want1080) {
      throwIfExportAborted(signal);
      destroyFFmpegInstance();
      onProgress?.({ ratio: 0.96, message: "Đang scale 1080p..." });
      mp4Blob = await scaleVideoInBrowser(mp4Blob, {
        portrait: !!options.portrait,
        onProgress: mapProgress(onProgress, 0.96, 0.99, "1080p", signal),
      });
      throwIfExportAborted(signal);
    }

    result.mp4 = mp4Blob;
  }

  throwIfExportAborted(signal);
  if (!result.mp4 && !result.mp3) {
    throw new Error("Không có nội dung để xuất");
  }

  onProgress?.({ ratio: 1, message: "Hoàn tất" });
  return result;
}

export function downloadFilmStudioExport(
  result: FilmStudioExportResult,
  baseName = "film-studio"
): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  if (result.mp4) {
    triggerBlobDownload(result.mp4, `${baseName}-${stamp}.mp4`);
  }
  if (result.mp3) {
    const ext = result.mp3.type.includes("wav") ? "wav" : "mp3";
    triggerBlobDownload(result.mp3, `${baseName}-${stamp}.${ext}`);
  }
}
