/**
 * Map Audio/Image → Video scenes + generated videos + audio nguồn + dialogue
 * sang FilmSceneRecord để tái dùng FilmStudioPanel.
 */
import type { ElementFormAudio, SceneScript } from "../../constants";
import type { GeneratedVideoData } from "../../copy-video/hook/useCopyVideoApi";
import {
  getGeneratedImagePreviewSrc,
  type GeneratedImageLike,
} from "../../shared/generatedMediaUtils";
import { base64ToBlob } from "../../shared/videoDownloadUtils";
import {
  createFilmId,
  type FilmAspectRatio,
  type FilmDialogueLineRecord,
  type FilmSceneRecord,
} from "../../../../film/film-types";
import {
  insertFilmIndependentLine,
  readAudioUrlDurationSec,
  readVideoUrlDurationSec,
  refreshFilmStudioSceneDurations,
  rebuildFilmSceneTimeline,
  resetFilmStudioTimelineFromScratch,
  FILM_STUDIO_DEFAULT_SCENE_SEC,
  FILM_STUDIO_MIN_CLIP_SEC,
} from "../../../../film/film-studio-timeline";
import { getFilmEntityVideoSrc } from "../../../../film/api/generate-film-media";

export const AUDIO_IMAGE_STUDIO_PROJECT_ID = "audio-image-to-video";
export const AUDIO_IMAGE_STUDIO_EPISODE_ID = "audio-image-to-video-ep";

/** Marker để isFilmCreateVideoScene không loại clip chỉ có blob local (khi chưa có ảnh tab Ảnh) */
const AFFILIATE_FRAME_MARKER = "audio-image-scene";

/** Video gen thường ~8s — thoại ngắn hơn → tăng tốc. */
export const AUDIO_IMAGE_FIT_SPEEDUP_BELOW_SEC = 8;

export type AudioImageStudioSeedInput = {
  scenes: SceneScript[];
  /** video theo scene.id */
  videosBySceneId: Record<string, GeneratedVideoData | undefined>;
  /** ảnh tab Ảnh theo scene.id — thumbnail timeline Video */
  imagesBySceneId?: Record<string, GeneratedImageLike | undefined>;
  sourceAudio?: ElementFormAudio | null;
  aspectRatio?: FilmAspectRatio | string;
  /**
   * Bật: giãn/nén duration video theo dialogueStart/End.
   * Thoại dài hơn video → chậm lại; thoại ngắn hơn 8s → nhanh hơn.
   */
  fitDialogueDuration?: boolean;
};

function stripBase64Payload(value: string): string {
  const trimmed = value.trim();
  const dataMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/);
  return dataMatch ? dataMatch[1] : trimmed;
}

function elementAudioToBlob(audio: ElementFormAudio): Blob | null {
  const bytes = (audio.audioBytes || "").trim();
  if (!bytes) return null;
  try {
    return base64ToBlob(stripBase64Payload(bytes), audio.mimeType || "audio/mpeg");
  } catch {
    return null;
  }
}

function resolveVideoBlob(video?: GeneratedVideoData | null): Blob | undefined {
  if (video?.mediaBlob && video.mediaBlob.size > 0) return video.mediaBlob;
  return undefined;
}

function resolveVideoUrl(video?: GeneratedVideoData | null): string {
  const uri = (video?.videoUri || "").trim();
  if (uri && !uri.startsWith("blob:") && !uri.startsWith("data:")) return uri;
  if (video?.previewUrl?.startsWith("http")) return video.previewUrl;
  return uri || video?.previewUrl || "";
}

function dialogueTargetDurationSec(scene: SceneScript): number | null {
  const start = scene.dialogueStartSec;
  const end = scene.dialogueEndSec;
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  const dur = end - start;
  if (!(dur > 0)) return null;
  return Math.max(FILM_STUDIO_MIN_CLIP_SEC, dur);
}

/** Lấy khung hình từ ảnh đã gen ở tab Ảnh phân cảnh. */
export function resolveAudioImageStudioFrame(img?: GeneratedImageLike | null): {
  frameImageUrl: string;
  frameImageBlob?: Blob;
  frameStatus: "ready" | "pending";
} {
  if (!img) {
    return { frameImageUrl: AFFILIATE_FRAME_MARKER, frameStatus: "pending" };
  }
  if (img.mediaBlob instanceof Blob && img.mediaBlob.size > 0) {
    const preview = getGeneratedImagePreviewSrc(img);
    return {
      frameImageBlob: img.mediaBlob,
      frameImageUrl: preview || AFFILIATE_FRAME_MARKER,
      frameStatus: "ready",
    };
  }
  const preview = getGeneratedImagePreviewSrc(img);
  if (preview) {
    return { frameImageUrl: preview, frameStatus: "ready" };
  }
  const remote = String(img.imageUrl || img.fifeUrl || "").trim();
  if (remote) {
    return { frameImageUrl: remote, frameStatus: "ready" };
  }
  return { frameImageUrl: AFFILIATE_FRAME_MARKER, frameStatus: "pending" };
}

export function isAudioImageStudioFrameMarker(url?: string | null): boolean {
  return String(url || "").trim() === AFFILIATE_FRAME_MARKER;
}

/** Scene gốc từ batch list + video đã gen (chưa pack timeline). */
export function buildAudioImageStudioSourceScenes(
  input: AudioImageStudioSeedInput
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  const projectId = AUDIO_IMAGE_STUDIO_PROJECT_ID;
  const episodeId = AUDIO_IMAGE_STUDIO_EPISODE_ID;
  const imagesBySceneId = input.imagesBySceneId || {};

  return (input.scenes || [])
    .filter((s) => !s.disabled)
    .map((scene, i) => {
      const video = input.videosBySceneId[scene.id];
      const videoBlob = resolveVideoBlob(video);
      const videoUrl = resolveVideoUrl(video);
      const dialogue = (scene.dialogue || "").trim();
      const frame = resolveAudioImageStudioFrame(imagesBySceneId[scene.id]);
      const targetDur = dialogueTargetDurationSec(scene);

      return {
        id: scene.id || `audio-image-scene-${i + 1}`,
        projectId,
        episodeId,
        index: scene.sceneNumber || i + 1,
        title: `Cảnh ${scene.sceneNumber || i + 1}`,
        dialogue,
        motionPrompt: scene.motionPrompt || "",
        visualDescription: scene.visualPrompt || scene.imageGenPrompt || "",
        videoPrompt: scene.motionPrompt || "",
        imagePrompt: scene.imageGenPrompt || "",
        durationSec: targetDur ?? FILM_STUDIO_DEFAULT_SCENE_SEC,
        videoUrl: videoUrl || undefined,
        videoBlob,
        videoFlow2RequestId: video?.flow2RequestId,
        frameImageUrl: frame.frameImageUrl,
        frameImageBlob: frame.frameImageBlob,
        frameStatus: frame.frameStatus,
        videoStatus: videoBlob || videoUrl ? "ready" : "pending",
        status: "done",
        createdAt: now,
        updatedAt: now,
      } satisfies FilmSceneRecord;
    })
    .filter((s) => !!(s.videoBlob || s.videoUrl));
}

/**
 * Gắn/làm mới thumbnail từ ảnh tab Ảnh lên scene Studio (giữ video/timeline).
 */
export function attachSceneImagesToStudioScenes(
  scenes: FilmSceneRecord[],
  imagesBySceneId: Record<string, GeneratedImageLike | undefined>
): FilmSceneRecord[] {
  if (!scenes.length) return scenes;
  return scenes.map((scene) => {
    const img = imagesBySceneId[scene.id];
    if (!img) return scene;
    const frame = resolveAudioImageStudioFrame(img);
    if (frame.frameStatus !== "ready") return scene;
    return {
      ...scene,
      frameImageUrl: frame.frameImageUrl,
      frameImageBlob: frame.frameImageBlob,
      frameStatus: frame.frameStatus,
      updatedAt: new Date().toISOString(),
    };
  });
}

/** Phụ đề/thoại scene (không studioOnly) kéo full độ dài clip video. */
function stretchSceneDialogueToClipDuration(scenes: FilmSceneRecord[]): FilmSceneRecord[] {
  let cursor = 0;
  const now = new Date().toISOString();
  return scenes.map((scene) => {
    const dur = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
    );
    const sceneStart = cursor;
    cursor += dur;
    const textLines = (scene.dialogueLines || []).filter((l) => !l.studioOnly);
    const studioLines = (scene.dialogueLines || []).filter((l) => l.studioOnly);
    if (!textLines.length) {
      return { ...scene, updatedAt: now };
    }
    // Một dòng thoại/scene (Audio→Video): phủ full clip
    const stretched = textLines.map((line, i) => {
      if (textLines.length === 1) {
        return {
          ...line,
          timelineStartSec: sceneStart,
          timelineDurationSec: dur,
          subtitleStartSec: sceneStart,
          subtitleDurationSec: dur,
        };
      }
      const slice = dur / textLines.length;
      const start = sceneStart + i * slice;
      return {
        ...line,
        timelineStartSec: start,
        timelineDurationSec: slice,
        subtitleStartSec: start,
        subtitleDurationSec: slice,
      };
    });
    return {
      ...scene,
      dialogueLines: [...stretched, ...studioLines],
      updatedAt: now,
    };
  });
}

/**
 * Khớp duration timeline với thời lượng thoại.
 * - fit ON: durationSec = (end-start); sourceDurationSec giữ độ dài file video.
 *   Thoại dài hơn video → clip dài hơn (chạy chậm). Thoại < 8s → clip ngắn (chạy nhanh).
 * - fit OFF: durationSec = sourceDurationSec (độ dài video gốc).
 */
export function applyFitDialogueDurationToStudioScenes(
  studioScenes: FilmSceneRecord[],
  sourceScripts: SceneScript[],
  fitEnabled: boolean
): FilmSceneRecord[] {
  const byId = new Map(sourceScripts.filter((s) => s.id).map((s) => [s.id, s]));
  const now = new Date().toISOString();

  const next = studioScenes.map((scene) => {
    const sourceDur = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      scene.sourceDurationSec ?? scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
    );
    const script = byId.get(scene.id);
    const target = script ? dialogueTargetDurationSec(script) : null;

    if (!fitEnabled || target == null) {
      return {
        ...scene,
        durationSec: sourceDur,
        sourceDurationSec: sourceDur,
        updatedAt: now,
      };
    }

    return {
      ...scene,
      durationSec: target,
      sourceDurationSec: sourceDur,
      updatedAt: now,
    };
  });

  return stretchSceneDialogueToClipDuration(rebuildFilmSceneTimeline(next));
}

/**
 * Gắn audio nguồn (upload form) làm track Audio studioOnly trên timeline,
 * phụ đề tắt — lời thoại scene đã nằm track Phụ đề riêng.
 */
export async function attachSourceAudioToStudioScenes(
  scenes: FilmSceneRecord[],
  sourceAudio?: ElementFormAudio | null
): Promise<FilmSceneRecord[]> {
  if (!scenes.length || !sourceAudio) return scenes;
  const blob = elementAudioToBlob(sourceAudio);
  if (!blob?.size) return scenes;

  const objectUrl = URL.createObjectURL(blob);
  let audioDur = FILM_STUDIO_DEFAULT_SCENE_SEC;
  try {
    audioDur = await readAudioUrlDurationSec(objectUrl);
  } catch {
    /* keep default */
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
  }

  const totalVideoSec = scenes.reduce(
    (sum, s) =>
      sum + Math.max(FILM_STUDIO_MIN_CLIP_SEC, s.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC),
    0
  );
  const durationSec = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    Math.min(audioDur, Math.max(totalVideoSec, audioDur))
  );

  const { scenes: withAudio, lineId } = insertFilmIndependentLine(scenes, {
    hostSceneId: scenes[0].id,
    startSec: 0,
    durationSec,
    character: "",
    text: sourceAudio.name || "Audio nguồn",
    voiceBlob: blob,
    voiceLabel: sourceAudio.name || "Audio nguồn",
  });

  if (!lineId) return withAudio;

  return withAudio.map((s) => {
    if (s.id !== scenes[0].id) return s;
    const dialogueLines = (s.dialogueLines || []).map((line: FilmDialogueLineRecord) =>
      line.id === lineId
        ? {
            ...line,
            subtitleEnabled: false,
            studioOnly: true,
          }
        : line
    );
    return { ...s, dialogueLines, updatedAt: new Date().toISOString() };
  });
}

/**
 * Seed timeline Studio từ video đã gen + ảnh tab Ảnh + dialogue + audio nguồn.
 */
export async function seedAudioImageStudioTimeline(
  input: AudioImageStudioSeedInput
): Promise<FilmSceneRecord[]> {
  const source = buildAudioImageStudioSourceScenes(input);
  if (!source.length) return [];

  let next = resetFilmStudioTimelineFromScratch(source);
  next = await refreshFilmStudioSceneDurations(next, (scene) => getFilmEntityVideoSrc(scene));
  const fit = input.fitDialogueDuration !== false;
  // Fit duration + kéo phụ đề full clip (không reset lại — tránh estimateLineDuration ~5s)
  next = applyFitDialogueDurationToStudioScenes(next, input.scenes, fit);
  next = await attachSourceAudioToStudioScenes(next, input.sourceAudio);
  return next;
}

/** Đọc duration video (helper export nếu cần prefetch). */
export async function probeVideoDurationSec(src: string): Promise<number> {
  if (!src) return FILM_STUDIO_DEFAULT_SCENE_SEC;
  return readVideoUrlDurationSec(src);
}

export function newAudioImageStudioLineId(): string {
  return createFilmId("dl");
}
