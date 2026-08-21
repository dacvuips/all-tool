/**
 * Helpers Studio timeline — clips, trim, split, reorder.
 */
import { createFilmId, type FilmDialogueLineRecord, type FilmSceneRecord } from "./film-types";
import { formatFilmDialogueText, syncSceneDialogueLines } from "./film-dialogue";

export const FILM_STUDIO_DEFAULT_SCENE_SEC = 5;
export const FILM_STUDIO_MIN_CLIP_SEC = 1;
export const FILM_STUDIO_PX_PER_SEC = 48;
export const FILM_STUDIO_TRACK_LABEL_W = 88;

export type FilmStudioVideoClip = {
  id: string;
  sceneId: string;
  index: number;
  startSec: number;
  durationSec: number;
  trimInSec: number;
  trimOutSec: number | null;
  label: string;
  videoUrl?: string;
  thumbUrl?: string;
  ready: boolean;
};

export type FilmStudioVoiceClip = {
  id: string;
  sceneId: string;
  lineId: string | null;
  /** scene-level voice (không gắn dialogue line) */
  kind: "line" | "scene";
  startSec: number;
  durationSec: number;
  /** Trim vào file audio nguồn */
  trimInSec: number;
  character: string;
  text: string;
  /** Tên nguồn audio (file / voiceLabel / nhân vật) */
  label: string;
  voiceUrl?: string;
  voiceBlob?: Blob;
};

function resolveVoiceClipLabel(input: {
  voiceLabel?: string;
  character?: string;
  text?: string;
  hasAudio: boolean;
}): string {
  const fromLabel = String(input.voiceLabel || "").trim();
  if (fromLabel) return fromLabel;
  const fromChar = String(input.character || "").trim();
  if (fromChar) return fromChar;
  const fromText = String(input.text || "").trim();
  if (fromText) return fromText.length > 28 ? `${fromText.slice(0, 28)}…` : fromText;
  return input.hasAudio ? "Audio" : "Chưa có audio";
}

export type FilmStudioSubtitleClip = {
  id: string;
  sceneId: string;
  lineId: string;
  startSec: number;
  durationSec: number;
  character: string;
  text: string;
  /** false = tắt riêng clip này */
  enabled: boolean;
};

/** Độ dài phụ đề/thoại theo độ dài chữ — độc lập duration video. */
function estimateLineDuration(text: string): number {
  const chars = String(text || "").trim().length;
  const byChars = chars > 0 ? chars / 14 + 0.3 : FILM_STUDIO_MIN_CLIP_SEC;
  return Math.max(FILM_STUDIO_MIN_CLIP_SEC, Math.min(5, byChars));
}

function resolveIndependentLineDuration(
  line: { line: string; timelineDurationSec?: number },
  sceneDurationSec: number
): number {
  const autoDur = estimateLineDuration(line.line);
  const stored = line.timelineDurationSec;
  if (stored == null || !Number.isFinite(stored)) return autoDur;
  // Legacy: duration ≈ cả cảnh / dài bất thường → estimate
  if (
    stored >= sceneDurationSec - 0.08 ||
    stored > Math.max(autoDur * 2.5, autoDur + 2.5)
  ) {
    return autoDur;
  }
  return Math.max(FILM_STUDIO_MIN_CLIP_SEC, stored);
}

export function findFilmStudioClipAtTime<T extends { startSec: number; durationSec: number }>(
  clips: T[],
  timeSec: number
): T | null {
  return (
    clips.find((c) => timeSec >= c.startSec && timeSec < c.startSec + c.durationSec) ??
    null
  );
}

export function rebuildFilmSceneTimeline(
  scenes: FilmSceneRecord[]
): FilmSceneRecord[] {
  /**
   * Giữ đúng thứ tự mảng đầu vào — chỉ gán lại index 1..n.
   * Không sort theo index cũ: nếu sort sẽ hoàn tác mọi kéo-thả / insert.
   */
  return (scenes || []).map((s, i) => ({
    ...s,
    index: i + 1,
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Scene thuộc tab Tạo video (gốc), không phải clip cắt/chèn Studio.
 */
export function isFilmCreateVideoScene(scene: FilmSceneRecord): boolean {
  if (scene.studioDerived) return false;
  const url = String(scene.videoUrl || "").trim();
  // Legacy: file chèn local (blob) không có khung hình → coi là Studio insert
  if (url.startsWith("blob:") && !scene.frameImageUrl && !scene.frameImageBlob) {
    return false;
  }
  return true;
}

/**
 * Làm lại Studio từ đầu — lấy đúng bộ video tab Tạo video:
 * - Bỏ clip Studio (cắt/chèn video)
 * - Bỏ audio/phụ đề chèn trong Studio; lấy lại giọng từ Tạo giọng theo phân cảnh
 * - Gộp legacy split cùng videoUrl remote
 * - Xóa trim / timing timeline đã chỉnh tay
 * - Gắn lại giọng/phụ đề theo đầu từng phân cảnh video
 * - Sắp xếp lại theo index gốc
 */
export function resetFilmStudioTimelineFromScratch(
  scenes: FilmSceneRecord[]
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  const base = [...scenes]
    .filter(isFilmCreateVideoScene)
    .sort((a, b) => a.index - b.index);

  const merged: FilmSceneRecord[] = [];
  const remoteVideoIndex = new Map<string, number>();

  const cleanTitle = (title?: string) =>
    String(title || "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim();

  for (const scene of base) {
    const url = String(scene.videoUrl || "").trim();
    const isRemote =
      !!url && !url.startsWith("blob:") && !url.startsWith("data:");

    if (isRemote && remoteVideoIndex.has(url)) {
      const at = remoteVideoIndex.get(url)!;
      const prev = merged[at];
      const prefer =
        (scene.dialogueLines?.length || 0) > (prev.dialogueLines?.length || 0)
          ? scene
          : prev;
      const title =
        cleanTitle(prev.title) ||
        cleanTitle(scene.title) ||
        prefer.title;
      merged[at] = {
        ...prefer,
        id: prev.id,
        index: prev.index,
        title,
        videoUrl: url,
        videoBlob: prefer.videoBlob || prev.videoBlob || scene.videoBlob,
        videoTrimInSec: 0,
        videoTrimOutSec: undefined,
        studioDerived: undefined,
        updatedAt: now,
      };
      continue;
    }

    if (isRemote) remoteVideoIndex.set(url, merged.length);
    merged.push({
      ...scene,
      videoTrimInSec: 0,
      videoTrimOutSec: undefined,
      studioDerived: undefined,
      updatedAt: now,
    });
  }

  let videoCursor = 0;
  const cleared = merged.map((scene, i) => {
    const sceneDuration = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
    );
    const sceneStart = videoCursor;
    videoCursor += sceneDuration;

    // Bỏ audio/phụ đề chèn trong Studio — gắn lại thoại + giọng theo đầu phân cảnh
    let packCursor = sceneStart;
    const lines = syncSceneDialogueLines(scene)
      .filter((line) => !line.studioOnly)
      .map((line) => {
        const hasAudio = !!(line.voiceUrl || line.voiceBlob);
        const hasText = !!String(line.line || "").trim();
        const next: FilmDialogueLineRecord = {
          ...line,
          voiceTrimInSec: 0,
        };
        delete next.timelineOffsetSec;
        delete next.studioOnly;

        if (!hasAudio && !hasText) {
          delete next.timelineStartSec;
          delete next.timelineDurationSec;
          delete next.subtitleStartSec;
          delete next.subtitleDurationSec;
          return next;
        }

        const dur = resolveIndependentLineDuration(
          { line: line.line, timelineDurationSec: undefined },
          sceneDuration
        );
        const startSec = packCursor;
        packCursor = startSec + dur;

        next.timelineStartSec = startSec;
        next.timelineDurationSec = dur;
        next.subtitleStartSec = startSec;
        next.subtitleDurationSec = dur;
        return next;
      });
    return {
      ...scene,
      index: i + 1,
      videoTrimInSec: 0,
      videoTrimOutSec: undefined,
      studioDerived: undefined,
      dialogueLines: lines,
      dialogue: formatFilmDialogueText(lines) || scene.dialogue,
      updatedAt: now,
    };
  });

  return rebuildFilmSceneTimeline(cleared);
}

/**
 * Cập nhật durationSec theo metadata video thật (sau khi gắn lại blob/url).
 */
export async function refreshFilmStudioSceneDurations(
  scenes: FilmSceneRecord[],
  resolveSrc: (scene: FilmSceneRecord) => string
): Promise<FilmSceneRecord[]> {
  const next: FilmSceneRecord[] = [];
  for (const scene of scenes) {
    const src = resolveSrc(scene);
    if (!src) {
      next.push(scene);
      continue;
    }
    const dur = await readVideoUrlDurationSec(src);
    next.push({
      ...scene,
      durationSec: Math.max(FILM_STUDIO_MIN_CLIP_SEC, dur),
      videoTrimInSec: 0,
      videoTrimOutSec: undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  return rebuildFilmSceneTimeline(next);
}

export function buildFilmStudioTimeline(scenes: FilmSceneRecord[]): {
  videoClips: FilmStudioVideoClip[];
  voiceClips: FilmStudioVoiceClip[];
  subtitleClips: FilmStudioSubtitleClip[];
  totalSec: number;
} {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const videoClips: FilmStudioVideoClip[] = [];
  const voiceClips: FilmStudioVoiceClip[] = [];
  const subtitleClips: FilmStudioSubtitleClip[] = [];

  /** Pass 1: chỉ video — track riêng */
  let videoCursor = 0;
  const sceneStartMap = new Map<string, number>();
  for (const scene of sorted) {
    const durationSec = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
    );
    const trimInSec = Math.max(0, scene.videoTrimInSec ?? 0);
    const trimOutSec =
      scene.videoTrimOutSec != null && Number.isFinite(scene.videoTrimOutSec)
        ? Math.max(trimInSec + FILM_STUDIO_MIN_CLIP_SEC, scene.videoTrimOutSec)
        : null;
    const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
    const label =
      scene.title?.trim() || scene.summary?.trim() || `Cảnh ${indexLabel}`;
    const videoUrl = String(scene.videoUrl || "").trim();
    const hasVideoBlob = !!(scene.videoBlob && scene.videoBlob.size > 0);

    sceneStartMap.set(scene.id, videoCursor);
    videoClips.push({
      id: scene.id,
      sceneId: scene.id,
      index: scene.index,
      startSec: videoCursor,
      durationSec,
      trimInSec,
      trimOutSec,
      label,
      videoUrl: videoUrl || undefined,
      thumbUrl: undefined,
      ready: !!videoUrl || hasVideoBlob,
    });
    videoCursor += durationSec;
  }

  /**
   * Pass 2: Audio + Phụ đề — timeline tuyệt đối.
   * Có timelineStartSec → dùng trực tiếp.
   * Không set → pack trong từng phân cảnh từ đầu cảnh video (không nối đuôi toàn bộ timeline).
   */
  let mediaCursor = 0;
  for (const scene of sorted) {
    const sceneDuration = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
    );
    const sceneStart = sceneStartMap.get(scene.id) ?? 0;
    const lines = syncSceneDialogueLines(scene);
    /** Cursor pack mặc định trong cảnh — reset theo đầu video cảnh */
    let packCursor = sceneStart;

    if (lines.length) {
      lines.forEach((line) => {
        const dur = resolveIndependentLineDuration(line, sceneDuration);
        const hasAbs = line.timelineStartSec != null && Number.isFinite(line.timelineStartSec);
        const hasLegacyOffset =
          !hasAbs && line.timelineOffsetSec != null && Number.isFinite(line.timelineOffsetSec);

        let startSec: number;
        if (hasAbs) {
          startSec = Math.max(0, line.timelineStartSec as number);
        } else if (hasLegacyOffset) {
          // Legacy relative → tuyệt đối một lần (không kẹp trong cảnh)
          startSec = Math.max(0, sceneStart + (line.timelineOffsetSec as number));
        } else {
          startSec = packCursor;
        }

        const hasAudio = !!(line.voiceUrl || line.voiceBlob);
        // A1 chỉ hiện clip có file audio — thêm/xóa tùy ý trong Studio
        if (hasAudio) {
          voiceClips.push({
            id: `${scene.id}:${line.id}`,
            sceneId: scene.id,
            lineId: line.id,
            kind: "line",
            startSec,
            durationSec: dur,
            trimInSec: Math.max(0, line.voiceTrimInSec ?? 0),
            character: line.character,
            text: line.line,
            label: resolveVoiceClipLabel({
              voiceLabel: line.voiceLabel || scene.voiceLabel,
              character: line.character,
              text: line.line,
              hasAudio,
            }),
            voiceUrl: line.voiceUrl,
            voiceBlob: line.voiceBlob,
          });
        }
        const hasSubtitleText = !!String(line.line || "").trim();
        if (hasSubtitleText) {
          const hasSubStart =
            line.subtitleStartSec != null && Number.isFinite(line.subtitleStartSec);
          const hasSubDur =
            line.subtitleDurationSec != null && Number.isFinite(line.subtitleDurationSec);
          const subStart = hasSubStart
            ? Math.max(0, line.subtitleStartSec as number)
            : startSec;
          const subDur = hasSubDur
            ? Math.max(FILM_STUDIO_MIN_CLIP_SEC, line.subtitleDurationSec as number)
            : dur;
          subtitleClips.push({
            id: `${scene.id}:${line.id}:sub`,
            sceneId: scene.id,
            lineId: line.id,
            startSec: subStart,
            durationSec: subDur,
            character: line.character,
            text: line.line,
            enabled: line.subtitleEnabled !== false,
          });
          mediaCursor = Math.max(mediaCursor, subStart + subDur);
        }

        if (hasAudio || hasSubtitleText) {
          mediaCursor = Math.max(mediaCursor, startSec + dur);
          if (!hasAbs && !hasLegacyOffset) {
            packCursor = startSec + dur;
          }
        }
      });
    } else if (scene.voiceUrl) {
      const startSec = sceneStart;
      const dur = Math.min(sceneDuration, estimateLineDuration(scene.dialogue || ""));
      voiceClips.push({
        id: `${scene.id}:scene-voice`,
        sceneId: scene.id,
        lineId: null,
        kind: "scene",
        startSec,
        durationSec: Math.max(FILM_STUDIO_MIN_CLIP_SEC, dur),
        trimInSec: 0,
        character: scene.speakerName || "",
        text: scene.dialogue || tFallbackNoDialogue(),
        label: resolveVoiceClipLabel({
          voiceLabel: scene.voiceLabel,
          character: scene.speakerName,
          text: scene.dialogue || tFallbackNoDialogue(),
          hasAudio: true,
        }),
        voiceUrl: scene.voiceUrl,
        voiceBlob: undefined,
      });
      mediaCursor = Math.max(
        mediaCursor,
        startSec + Math.max(FILM_STUDIO_MIN_CLIP_SEC, dur)
      );
    }
  }

  const mediaEnd = Math.max(
    videoCursor,
    mediaCursor,
    ...voiceClips.map((c) => c.startSec + c.durationSec),
    ...subtitleClips.map((c) => c.startSec + c.durationSec),
    1
  );

  return {
    videoClips,
    voiceClips,
    subtitleClips,
    totalSec: mediaEnd,
  };
}

function tFallbackNoDialogue(): string {
  return "Không thoại";
}

/** Trim mép trái clip video: tăng trimIn, giảm duration, giữ điểm kết thúc timeline. */
export function trimFilmSceneVideoLeft(
  scene: FilmSceneRecord,
  deltaSec: number
): FilmSceneRecord {
  const duration = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
  );
  const trimIn = Math.max(0, scene.videoTrimInSec ?? 0);
  const maxDelta = duration - FILM_STUDIO_MIN_CLIP_SEC;
  const d = Math.max(-trimIn, Math.min(maxDelta, deltaSec));
  if (Math.abs(d) < 0.001) return scene;
  const nextDuration = duration - d;
  const nextTrimIn = trimIn + d;
  let nextTrimOut = scene.videoTrimOutSec;
  if (nextTrimOut != null) {
    nextTrimOut = Math.max(nextTrimIn + FILM_STUDIO_MIN_CLIP_SEC, nextTrimOut);
  }
  return {
    ...scene,
    durationSec: nextDuration,
    videoTrimInSec: nextTrimIn,
    videoTrimOutSec: nextTrimOut,
    updatedAt: new Date().toISOString(),
  };
}

/** Trim mép phải: đổi duration (+ videoTrimOut). */
export function trimFilmSceneVideoRight(
  scene: FilmSceneRecord,
  deltaSec: number
): FilmSceneRecord {
  const duration = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
  );
  const trimIn = Math.max(0, scene.videoTrimInSec ?? 0);
  const nextDuration = Math.max(FILM_STUDIO_MIN_CLIP_SEC, duration + deltaSec);
  const nextTrimOut = trimIn + nextDuration;
  return {
    ...scene,
    durationSec: nextDuration,
    videoTrimInSec: trimIn,
    videoTrimOutSec: nextTrimOut,
    updatedAt: new Date().toISOString(),
  };
}

/** Cắt clip tại playhead local → 2 scene (cùng video, trim khác nhau). */
export function splitFilmSceneAtLocalTime(
  scenes: FilmSceneRecord[],
  sceneId: string,
  localSec: number
): FilmSceneRecord[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const idx = sorted.findIndex((s) => s.id === sceneId);
  if (idx < 0) return scenes;
  const scene = sorted[idx];
  const duration = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
  );
  if (localSec < FILM_STUDIO_MIN_CLIP_SEC || localSec > duration - FILM_STUDIO_MIN_CLIP_SEC) {
    return scenes;
  }
  const trimIn = Math.max(0, scene.videoTrimInSec ?? 0);
  const cutSource = trimIn + localSec;
  const left: FilmSceneRecord = {
    ...scene,
    durationSec: localSec,
    videoTrimInSec: trimIn,
    videoTrimOutSec: cutSource,
    updatedAt: new Date().toISOString(),
  };
  const right: FilmSceneRecord = {
    ...scene,
    id: createFilmId("sc"),
    index: scene.index + 1,
    durationSec: duration - localSec,
    videoTrimInSec: cutSource,
    videoTrimOutSec: scene.videoTrimOutSec,
    title: scene.title ? `${scene.title} (2)` : undefined,
    studioDerived: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const next = [...sorted.slice(0, idx), left, right, ...sorted.slice(idx + 1)];
  return rebuildFilmSceneTimeline(next);
}

export function deleteFilmSceneFromTimeline(
  scenes: FilmSceneRecord[],
  sceneId: string
): FilmSceneRecord[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  return rebuildFilmSceneTimeline(sorted.filter((s) => s.id !== sceneId));
}

export function reorderFilmSceneByDrag(
  scenes: FilmSceneRecord[],
  fromSceneId: string,
  toSceneId: string
): FilmSceneRecord[] {
  if (fromSceneId === toSceneId) return scenes;
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const from = sorted.findIndex((s) => s.id === fromSceneId);
  const to = sorted.findIndex((s) => s.id === toSceneId);
  if (from < 0 || to < 0) return scenes;
  const [item] = sorted.splice(from, 1);
  sorted.splice(to, 0, item);
  return rebuildFilmSceneTimeline(sorted);
}

/**
 * Layout preview khi kéo video: slot chèn + vị trí các clip còn lại (đã dồn).
 * `dropSec` = tâm clip đang kéo (giống moveFilmSceneByDropSec).
 */
export function buildVideoDragLayout(
  clips: Array<{ sceneId: string; startSec: number; durationSec: number }>,
  dragSceneId: string,
  dropSec: number
): {
  slot: { startSec: number; durationSec: number };
  others: Array<{ sceneId: string; startSec: number; durationSec: number }>;
  insertAt: number;
} | null {
  const list = (clips || []).slice().sort((a, b) => a.startSec - b.startSec);
  const self = list.find((c) => c.sceneId === dragSceneId);
  if (!self) return null;
  const othersSrc = list.filter((c) => c.sceneId !== dragSceneId);
  const t = Math.max(0, Number(dropSec) || 0);

  let insertAt = 0;
  for (const c of othersSrc) {
    if (t >= c.startSec + c.durationSec * 0.5) insertAt += 1;
  }
  insertAt = Math.max(0, Math.min(othersSrc.length, insertAt));

  const others: Array<{ sceneId: string; startSec: number; durationSec: number }> = [];
  let cursor = 0;
  let slotStart = 0;
  for (let i = 0; i <= othersSrc.length; i++) {
    if (i === insertAt) {
      slotStart = cursor;
      cursor += self.durationSec;
    }
    if (i < othersSrc.length) {
      others.push({
        sceneId: othersSrc[i].sceneId,
        startSec: cursor,
        durationSec: othersSrc[i].durationSec,
      });
      cursor += othersSrc[i].durationSec;
    }
  }

  return {
    slot: { startSec: slotStart, durationSec: self.durationSec },
    others,
    insertAt,
  };
}

/**
 * Đổi thứ tự scene video theo mốc thời gian thả (`dropSec`).
 * So sánh với midpoint các clip khác → chèn đúng trước/sau.
 */
export function moveFilmSceneByDropSec(
  scenes: FilmSceneRecord[],
  dragSceneId: string,
  dropSec: number
): FilmSceneRecord[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const from = sorted.findIndex((s) => s.id === dragSceneId);
  if (from < 0) return scenes;

  const built = buildFilmStudioTimeline(sorted);
  const layout = buildVideoDragLayout(built.videoClips, dragSceneId, dropSec);
  if (!layout) return scenes;

  const next = [...sorted];
  const [item] = next.splice(from, 1);
  const insertAt = Math.max(0, Math.min(next.length, layout.insertAt));
  next.splice(insertAt, 0, item);

  const beforeIds = sorted.map((s) => s.id).join("\0");
  const afterIds = next.map((s) => s.id).join("\0");
  if (beforeIds === afterIds) return scenes;
  return rebuildFilmSceneTimeline(next);
}

/**
 * @deprecated dùng moveFilmSceneByDropSec
 */
export function reorderFilmSceneToIndex(
  scenes: FilmSceneRecord[],
  fromSceneId: string,
  toIndex: number
): FilmSceneRecord[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const from = sorted.findIndex((s) => s.id === fromSceneId);
  if (from < 0) return scenes;
  let insertAt = Math.max(0, Math.min(sorted.length, Math.floor(toIndex)));
  if (insertAt > from) insertAt -= 1;
  if (insertAt === from) return scenes;
  const next = [...sorted];
  const [item] = next.splice(from, 1);
  next.splice(insertAt, 0, item);
  return rebuildFilmSceneTimeline(next);
}

/**
 * @deprecated dùng moveFilmSceneByDropSec
 */
export function resolveVideoReorderIndex(
  clips: Array<{ sceneId: string; startSec: number; durationSec: number }>,
  dragSceneId: string,
  sec: number
): number {
  const list = (clips || []).slice().sort((a, b) => a.startSec - b.startSec);
  if (!list.length) return 0;
  const t = Math.max(0, Number(sec) || 0);
  const others = list.filter((c) => c.sceneId !== dragSceneId);
  if (!others.length) return 0;
  let insertAt = 0;
  for (const c of others) {
    if (t >= c.startSec + c.durationSec * 0.5) insertAt += 1;
  }
  /** Đổi sang index trước-remove để tương thích API cũ */
  const from = list.findIndex((c) => c.sceneId === dragSceneId);
  if (from < 0) return insertAt;
  return insertAt >= from ? insertAt + 1 : insertAt;
}

/**
 * Chèn scene mới ngay sau `afterSceneId` (giữa after và clip kế).
 * afterSceneId null / không tìm thấy → chèn đầu danh sách.
 */
export function insertFilmSceneAfter(
  scenes: FilmSceneRecord[],
  afterSceneId: string | null | undefined,
  newScene: FilmSceneRecord
): FilmSceneRecord[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const afterIdx = afterSceneId
    ? sorted.findIndex((s) => s.id === afterSceneId)
    : -1;
  const insertAt = afterIdx >= 0 ? afterIdx + 1 : 0;
  const next = [
    ...sorted.slice(0, insertAt),
    newScene,
    ...sorted.slice(insertAt),
  ];
  return rebuildFilmSceneTimeline(next);
}

/** Tạo scene video chèn từ file local (blob URL) — không kế thừa blob/frame của template. */
export function createFilmSceneFromVideoFile(input: {
  template: FilmSceneRecord;
  file: File;
  objectUrl: string;
  durationSec: number;
  title?: string;
  thumbDataUrl?: string;
}): FilmSceneRecord {
  const now = new Date().toISOString();
  const rawDur = Number(input.durationSec);
  const dur = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    Math.min(
      3600,
      Number.isFinite(rawDur) && rawDur > 0 ? rawDur : FILM_STUDIO_DEFAULT_SCENE_SEC
    )
  );
  const thumb = String(input.thumbDataUrl || "").trim();
  return {
    id: createFilmId("sc"),
    projectId: input.template.projectId,
    episodeId: input.template.episodeId,
    index: (input.template.index || 1) + 1,
    title: input.title || input.file.name.replace(/\.[^.]+$/, "") || "Video chèn",
    summary: "",
    shotSize: input.template.shotSize,
    cameraAngle: input.template.cameraAngle || "",
    cameraMovement: input.template.cameraMovement || "",
    location: "",
    durationSec: dur,
    videoTrimInSec: 0,
    videoTrimOutSec: dur,
    characterNames: [],
    propNames: [],
    locationNames: [],
    sceneTag: "",
    action: "",
    visualDescription: "",
    atmosphere: "",
    dialogue: "",
    dialogueLines: [],
    imagePrompt: "",
    videoPrompt: "",
    audioPrompt: "",
    mediaStatus: "ready",
    frameStatus: thumb ? "ready" : "pending",
    frameImageUrl: thumb,
    frameImageBlob: undefined,
    videoUrl: input.objectUrl,
    videoBlob:
      input.file.size > 0
        ? input.file.slice(0, input.file.size, input.file.type || "video/mp4")
        : undefined,
    videoStatus: "ready",
    videoError: undefined,
    videoMediaJobId: undefined,
    videoMediaProgress: undefined,
    studioDerived: true,
    voiceUrl: "",
    voiceStatus: "pending",
    voiceLabel: undefined,
    speakerName: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/** Đọc duration giây từ URL video (metadata). */
export function readVideoUrlDurationSec(src: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = el.duration;
      resolve(Number.isFinite(d) && d > 0 ? d : FILM_STUDIO_DEFAULT_SCENE_SEC);
    };
    el.onerror = () => resolve(FILM_STUDIO_DEFAULT_SCENE_SEC);
    el.src = src;
  });
}

/** Capture khung hình đầu làm thumbnail timeline (data URL). */
export function captureVideoFrameDataUrl(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    let settled = false;
    const finish = (url?: string) => {
      if (settled) return;
      settled = true;
      el.removeAttribute("src");
      el.load();
      resolve(url);
    };
    const timer = window.setTimeout(() => finish(undefined), 4000);
    el.onerror = () => {
      window.clearTimeout(timer);
      finish(undefined);
    };
    el.onloadeddata = () => {
      try {
        const t = Number.isFinite(el.duration) && el.duration > 0 ? Math.min(0.12, el.duration * 0.02) : 0;
        el.currentTime = t;
      } catch {
        window.clearTimeout(timer);
        finish(undefined);
      }
    };
    el.onseeked = () => {
      window.clearTimeout(timer);
      try {
        const w = el.videoWidth || 0;
        const h = el.videoHeight || 0;
        if (w < 2 || h < 2) {
          finish(undefined);
          return;
        }
        const canvas = document.createElement("canvas");
        const maxW = 240;
        const scale = Math.min(1, maxW / w);
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(undefined);
          return;
        }
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finish(undefined);
      }
    };
    el.src = src;
  });
}

/** Đọc duration giây từ URL audio (metadata). */
export function readAudioUrlDurationSec(src: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = el.duration;
      resolve(Number.isFinite(d) && d > 0 ? d : FILM_STUDIO_MIN_CLIP_SEC + 1);
    };
    el.onerror = () => resolve(FILM_STUDIO_MIN_CLIP_SEC + 1);
    el.src = src;
  });
}

/**
 * Chèn 1 dòng thoại/audio/phụ đề lên track độc lập (timelineStartSec tuyệt đối).
 * Gắn vào hostScene — không tạo clip video mới.
 */
export function insertFilmIndependentLine(
  scenes: FilmSceneRecord[],
  input: {
    hostSceneId: string;
    startSec: number;
    durationSec: number;
    character?: string;
    text: string;
    voiceUrl?: string;
    voiceBlob?: Blob;
    voiceLabel?: string;
    voiceTrimInSec?: number;
  }
): { scenes: FilmSceneRecord[]; lineId: string; sceneId: string } {
  const hostId = input.hostSceneId || scenes[0]?.id;
  if (!hostId) return { scenes, lineId: "", sceneId: "" };

  const lineId = createFilmId("dl");
  const hasVoice = !!(input.voiceUrl || input.voiceBlob);
  const newLine: FilmDialogueLineRecord = {
    id: lineId,
    character: (input.character || "").trim(),
    line: (input.text || "").trim() || (hasVoice ? input.voiceLabel || "Audio" : "Phụ đề mới"),
    voiceStatus: hasVoice ? "ready" : "pending",
    voiceUrl: input.voiceUrl || "",
    voiceBlob: input.voiceBlob,
    voiceLabel: input.voiceLabel,
    voiceTrimInSec: Math.max(0, input.voiceTrimInSec ?? 0),
    timelineStartSec: Math.max(0, input.startSec),
    timelineDurationSec: Math.max(FILM_STUDIO_MIN_CLIP_SEC, input.durationSec),
    subtitleStartSec: Math.max(0, input.startSec),
    subtitleDurationSec: Math.max(FILM_STUDIO_MIN_CLIP_SEC, input.durationSec),
    timelineOffsetSec: undefined,
    studioOnly: true,
  };

  const next = scenes.map((s) => {
    if (s.id !== hostId) return s;
    const lines = [...syncSceneDialogueLines(s), newLine];
    return {
      ...s,
      dialogueLines: lines,
      // Không ghi dòng Studio vào field Thoại của Chuỗi phân cảnh
      dialogue: formatFilmDialogueText(lines.filter((l) => !l.studioOnly)),
      updatedAt: new Date().toISOString(),
    };
  });

  return { scenes: next, lineId, sceneId: hostId };
}

/** Mốc chèn tuyệt đối ngay sau clip (hoặc 0 nếu chưa có). */
export function resolveInsertStartAfterClip(clip: {
  startSec: number;
  durationSec: number;
} | null): number {
  if (!clip) return 0;
  return Math.max(0, clip.startSec + clip.durationSec);
}

export function patchFilmDialogueLineTiming(
  scene: FilmSceneRecord,
  lineId: string,
  patch: {
    timelineStartSec?: number;
    timelineDurationSec?: number;
    voiceTrimInSec?: number;
    subtitleStartSec?: number;
    subtitleDurationSec?: number;
  }
): FilmSceneRecord {
  const lines = syncSceneDialogueLines(scene).map((l) =>
    l.id === lineId
      ? {
          ...l,
          ...patch,
          timelineOffsetSec: undefined,
        }
      : l
  );
  return {
    ...scene,
    dialogueLines: lines,
    updatedAt: new Date().toISOString(),
  };
}

/** Cắt bỏ phần trước playhead (giữ phần sau) — video. localSec trong clip. */
export function cutFilmSceneVideoBeforeLocal(
  scene: FilmSceneRecord,
  localSec: number
): FilmSceneRecord {
  const duration = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
  );
  if (localSec < 0.05 || localSec > duration - FILM_STUDIO_MIN_CLIP_SEC) return scene;
  return trimFilmSceneVideoLeft(scene, localSec);
}

/** Cắt bỏ phần sau playhead (giữ phần trước) — video. */
export function cutFilmSceneVideoAfterLocal(
  scene: FilmSceneRecord,
  localSec: number
): FilmSceneRecord {
  const duration = Math.max(
    FILM_STUDIO_MIN_CLIP_SEC,
    scene.durationSec ?? FILM_STUDIO_DEFAULT_SCENE_SEC
  );
  if (localSec < FILM_STUDIO_MIN_CLIP_SEC || localSec >= duration - 0.05) return scene;
  const trimIn = Math.max(0, scene.videoTrimInSec ?? 0);
  return {
    ...scene,
    durationSec: localSec,
    videoTrimInSec: trimIn,
    videoTrimOutSec: trimIn + localSec,
    updatedAt: new Date().toISOString(),
  };
}

/** Cắt bỏ phần trước playhead trên clip audio (timeline absolute). */
export function cutFilmVoiceBeforePlayhead(
  scene: FilmSceneRecord,
  lineId: string,
  clipStartSec: number,
  clipDurationSec: number,
  trimInSec: number,
  playheadSec: number
): FilmSceneRecord {
  const local = playheadSec - clipStartSec;
  if (local < 0.05 || local > clipDurationSec - FILM_STUDIO_MIN_CLIP_SEC) return scene;
  return patchFilmDialogueLineTiming(scene, lineId, {
    timelineStartSec: playheadSec,
    timelineDurationSec: clipDurationSec - local,
    voiceTrimInSec: Math.max(0, trimInSec + local),
  });
}

/** Cắt bỏ phần sau playhead trên clip audio. */
export function cutFilmVoiceAfterPlayhead(
  scene: FilmSceneRecord,
  lineId: string,
  clipStartSec: number,
  clipDurationSec: number,
  trimInSec: number,
  playheadSec: number
): FilmSceneRecord {
  const local = playheadSec - clipStartSec;
  if (local < FILM_STUDIO_MIN_CLIP_SEC || local >= clipDurationSec - 0.05) return scene;
  return patchFilmDialogueLineTiming(scene, lineId, {
    timelineStartSec: clipStartSec,
    timelineDurationSec: local,
    voiceTrimInSec: Math.max(0, trimInSec),
  });
}

/**
 * Cắt bỏ đầu/đuôi phụ đề trên timeline — chỉ đổi subtitleStart/Duration,
 * không đụng audio (timelineStart / voiceTrim).
 */
export function cutFilmSubtitleBeforePlayhead(
  scene: FilmSceneRecord,
  lineId: string,
  clipStartSec: number,
  clipDurationSec: number,
  playheadSec: number
): FilmSceneRecord {
  const local = playheadSec - clipStartSec;
  if (local < 0.05 || local > clipDurationSec - FILM_STUDIO_MIN_CLIP_SEC) return scene;
  return patchFilmDialogueLineTiming(scene, lineId, {
    subtitleStartSec: playheadSec,
    subtitleDurationSec: clipDurationSec - local,
  });
}

export function cutFilmSubtitleAfterPlayhead(
  scene: FilmSceneRecord,
  lineId: string,
  clipStartSec: number,
  clipDurationSec: number,
  playheadSec: number
): FilmSceneRecord {
  const local = playheadSec - clipStartSec;
  if (local < FILM_STUDIO_MIN_CLIP_SEC || local >= clipDurationSec - 0.05) return scene;
  return patchFilmDialogueLineTiming(scene, lineId, {
    subtitleStartSec: clipStartSec,
    subtitleDurationSec: local,
  });
}

/**
 * Split phụ đề tại playhead → 2 block (cùng chữ).
 * Nửa sau là studioOnly text-only; audio (nếu có) ở lại dòng gốc (không bị cắt).
 */
export function splitFilmSubtitleAtPlayhead(
  scenes: FilmSceneRecord[],
  sceneId: string,
  lineId: string,
  clipStartSec: number,
  clipDurationSec: number,
  playheadSec: number
): FilmSceneRecord[] {
  const local = playheadSec - clipStartSec;
  if (local < FILM_STUDIO_MIN_CLIP_SEC || local > clipDurationSec - FILM_STUDIO_MIN_CLIP_SEC) {
    return scenes;
  }
  const remain = clipDurationSec - local;
  return scenes.map((s) => {
    if (s.id !== sceneId) return s;
    const lines = syncSceneDialogueLines(s);
    const idx = lines.findIndex((l) => l.id === lineId);
    if (idx < 0) return s;
    const origin = lines[idx];
    const left: FilmDialogueLineRecord = {
      ...origin,
      subtitleStartSec: clipStartSec,
      subtitleDurationSec: local,
    };
    const right: FilmDialogueLineRecord = {
      id: createFilmId("dl"),
      character: origin.character,
      line: origin.line,
      studioOnly: true,
      subtitleStartSec: playheadSec,
      subtitleDurationSec: remain,
      timelineStartSec: playheadSec,
      timelineDurationSec: remain,
      timelineOffsetSec: undefined,
      voiceStatus: "pending",
    };
    const nextLines = [...lines.slice(0, idx), left, right, ...lines.slice(idx + 1)];
    return {
      ...s,
      dialogueLines: nextLines,
      dialogue: formatFilmDialogueText(nextLines.filter((l) => !l.studioOnly)),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function attachAudioToFilmScene(
  scene: FilmSceneRecord,
  input: { blob: Blob; url: string; name?: string }
): FilmSceneRecord {
  const lines = syncSceneDialogueLines(scene);
  if (lines.length) {
    const first = lines[0];
    const nextLines: FilmDialogueLineRecord[] = lines.map((l, i) =>
      i === 0
        ? {
            ...l,
            voiceBlob: input.blob,
            voiceUrl: input.url,
            voiceStatus: "ready",
            voiceSource: "custom_id",
            voiceLabel: input.name || "Audio đính kèm",
          }
        : l
    );
    return {
      ...scene,
      dialogueLines: nextLines,
      voiceUrl: input.url,
      voiceStatus: "ready",
      voiceLabel: input.name || first.character || "Audio đính kèm",
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...scene,
    voiceUrl: input.url,
    voiceStatus: "ready",
    voiceLabel: input.name || "Audio đính kèm",
    speakerName: scene.speakerName || "Audio",
    updatedAt: new Date().toISOString(),
  };
}

export function updateFilmSubtitleText(
  scene: FilmSceneRecord,
  lineId: string,
  text: string
): FilmSceneRecord {
  const lines = syncSceneDialogueLines(scene).map((l) =>
    l.id === lineId ? { ...l, line: text } : l
  );
  return {
    ...scene,
    dialogueLines: lines,
    dialogue: formatFilmDialogueText(lines.filter((l) => !l.studioOnly)),
    updatedAt: new Date().toISOString(),
  };
}
