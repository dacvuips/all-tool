/**
 * Prompt video phân cảnh — ghép từ Chuỗi Cảnh quay.
 * Nguồn: Cỡ cảnh, Góc máy, Lia máy + [MOTION][AUDIO][SFX][MUSIC][VOICE][DIALOGUE]
 * (+ tuỳ chọn suffix cấu hình Setting).
 */
import { formatFilmPromptBracketBlock } from "./film-scene-image-prompt";
import type { FilmSceneRecord } from "./film-types";

/** Giữ [DIALOGUE] để nhép miệng; tắt tiếng nói — đặt ĐẦU prompt (chỉ gắn 1 lần qua ensure). */
export const FILM_SILENT_LIP_SYNC_NOTE = [
  "PRIORITY RULE #1 — MUTE SPOKEN VOICE:",
  "- Absolute: no audible speech, no talking, no dialogue audio track, no voiceover.",
  "- Characters may look like they are speaking, but the soundtrack must NOT contain spoken words.",
  "- Ambient wind/water only if needed; never generate human voice.",
  "PRIORITY RULE #2 — LIP-SYNC (VISUAL ONLY):",
  "- Speaking character(s) MUST clearly mouth every word in [DIALOGUE].",
  "- Visible lip shapes, jaw open/close, facial acting while talking.",
  "- Mouth must move with dialogue rhythm — frozen/closed mouth is forbidden.",
  "- Treat [DIALOGUE] as lip-sync reference only (silent plate for later dubbing).",
].join("\n");

/** Nhận diện mọi bản ghi chú silent/lip-sync cũ + hiện tại để gỡ trước khi gắn lại 1 lần. */
const FILM_SILENT_LIP_SYNC_NOTE_DETECT_RE =
  /Lip-sync performance \(visual\):[\s\S]*?(?:added later in editing\.?|out of the soundtrack\.?)|Quiet performance notes:[\s\S]*?subtle and cinematic\.?|Quiet audio:[\s\S]*?out of the soundtrack\.?|PRIORITY RULE #1 — MUTE SPOKEN VOICE:[\s\S]*?(?:silent plate for later dubbing\.?|frozen\/closed mouth is forbidden\.?)|IMPORTANT LIP-SYNC \(VISUAL ONLY\)[\s\S]*?(?:MUTE AUDIO:[\s\S]*?voice will be added in post\.?|voice added in post\.?)|accurate lip-sync mouth movement matching the dialogue;?\s*silent video;?\s*no audible speech;?\s*no spoken voice audio|(?:^|\n)- Speaking character\(s\) MUST clearly mouth every word in \[DIALOGUE\]\.[\s\S]*?silent plate for later dubbing\.?/i;

export type FilmSceneVideoPromptSource = Pick<
  FilmSceneRecord,
  | "shotSize"
  | "cameraAngle"
  | "cameraMovement"
  | "dialogue"
  | "videoPrompt"
  | "videoSilentLipSync"
  | "motionPrompt"
  | "audioAmbience"
  | "sfx"
  | "music"
  | "voiceDirection"
  | "action"
  | "visualDescription"
  | "atmosphere"
>;

/** Bỏ khối [VOICE]… (giữ [DIALOGUE]) — tránh model tạo tiếng nói. */
export function stripFilmVoicePromptBlock(prompt: string): string {
  return String(prompt || "")
    .replace(/\[VOICE\][\s\S]*?(?=\[(?:MOTION|AUDIO|SFX|MUSIC|VOICE|DIALOGUE)\]|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Silent lip-sync: bỏ thêm [AUDIO]/[SFX]/[MUSIC] — dễ kích tiếng nói / “sau câu nói”. */
export function stripFilmAmbientSoundPromptBlocks(prompt: string): string {
  return String(prompt || "")
    .replace(
      /\[(?:AUDIO|SFX|MUSIC)\][\s\S]*?(?=\[(?:MOTION|AUDIO|SFX|MUSIC|VOICE|DIALOGUE)\]|$)/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Đảm bảo prompt có ghi chú nhép miệng + không tiếng — đúng 1 lần, luôn Ở ĐẦU. */
export function ensureFilmSilentLipSyncPrompt(prompt: string): string {
  let cleaned = stripFilmAmbientSoundPromptBlocks(stripFilmVoicePromptBlock(prompt));
  // Gỡ bản note hiện tại nếu đã có (tránh nhân đôi với build/resolve)
  while (cleaned.includes(FILM_SILENT_LIP_SYNC_NOTE)) {
    cleaned = cleaned.split(FILM_SILENT_LIP_SYNC_NOTE).join("\n\n");
  }
  cleaned = cleaned
    .replace(FILM_SILENT_LIP_SYNC_NOTE_DETECT_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return FILM_SILENT_LIP_SYNC_NOTE;
  return `${FILM_SILENT_LIP_SYNC_NOTE}\n\n${cleaned}`;
}

function tagged(tag: string, value?: string | null): string {
  return formatFilmPromptBracketBlock(tag, value);
}

/**
 * Gắn field scene → Prompt video.
 * Thứ tự: (silent note đầu) → Cỡ cảnh → … → [MOTION] [DIALOGUE]
 * videoSilentLipSync: bỏ [VOICE]/[AUDIO]/[SFX]/[MUSIC] (dễ kích tiếng nói),
 * giữ [DIALOGUE], đặt RULE mute/lip-sync ở ĐẦU prompt.
 */
export function buildFilmSceneVideoPrompt(
  scene: FilmSceneVideoPromptSource,
  globalStyle?: string | null
): string {
  const parts: string[] = [];
  const silentLipSync = !!scene.videoSilentLipSync;

  const shotSizeBlock = formatFilmPromptBracketBlock("Cỡ cảnh", scene.shotSize);
  const cameraAngleBlock = formatFilmPromptBracketBlock("Góc máy", scene.cameraAngle);
  const cameraMovementBlock = formatFilmPromptBracketBlock("Lia máy", scene.cameraMovement);
  const dialogue = String(scene.dialogue || "").trim();
  const style = String(globalStyle || "").trim();

  const hasRealDialogue =
    !!dialogue && !/^không\s*thoại$/i.test(dialogue.replace(/^[-–—•*]+\s*/i, "").trim());

  // Note silent/lip-sync chỉ gắn 1 lần ở resolve → ensureFilmSilentLipSyncPrompt

  if (shotSizeBlock) parts.push(shotSizeBlock);
  if (cameraAngleBlock) parts.push(cameraAngleBlock);
  if (cameraMovementBlock) parts.push(cameraMovementBlock);

  const actionBlock = formatFilmPromptBracketBlock("Hành động nhân vật", scene.action);
  const visualBlock = formatFilmPromptBracketBlock("Hình ảnh cảnh quay", scene.visualDescription);
  const atmosphereBlock = formatFilmPromptBracketBlock("Không khí cảnh", scene.atmosphere);
  if (actionBlock) parts.push(actionBlock);
  if (visualBlock) parts.push(visualBlock);
  if (atmosphereBlock) parts.push(atmosphereBlock);

  const motion = tagged("MOTION", scene.motionPrompt);
  const audio = tagged("AUDIO", scene.audioAmbience);
  const sfx = tagged("SFX", scene.sfx);
  const music = tagged("MUSIC", scene.music);
  const voice = tagged("VOICE", scene.voiceDirection);
  // Silent lip-sync: nhét chỉ thị nhép miệng ngay trong [DIALOGUE]
  const dialogueBody =
    silentLipSync && hasRealDialogue
      ? `${dialogue}\n- Visible lip-sync only: mouth this dialogue clearly (open/close lips & jaw); soundtrack has NO spoken voice.`
      : dialogue || "Không thoại";
  const dialogueTag = tagged("DIALOGUE", dialogueBody);

  if (motion) parts.push(motion);
  // Silent: bỏ AUDIO/SFX/MUSIC/VOICE — dễ kích model tạo tiếng nói ("câu nói", thở, nhạc sau thoại)
  if (!silentLipSync) {
    if (audio) parts.push(audio);
    if (sfx) parts.push(sfx);
    if (music) parts.push(music);
    if (voice) parts.push(voice);
  }
  if (silentLipSync && hasRealDialogue) {
    parts.push(
      tagged(
        "MOTION",
        "Speaking character mouths the dialogue with clear lip-sync and jaw movement; do not freeze the mouth; no audible speech."
      )
    );
  }
  if (dialogueTag) parts.push(dialogueTag);

  if (style) parts.push(style);

  if (parts.length) return parts.join("\n\n");

  return "";
}

/** Ghép [AUDIO]/[SFX]/[MUSIC]/[VOICE] → Prompt âm thanh. */
export function buildFilmSceneAudioPrompt(
  scene: Pick<FilmSceneRecord, "audioAmbience" | "sfx" | "music" | "voiceDirection">,
  globalStyle?: string | null
): string {
  const parts = [
    tagged("AUDIO", scene.audioAmbience),
    tagged("SFX", scene.sfx),
    tagged("MUSIC", scene.music),
    tagged("VOICE", scene.voiceDirection),
  ].filter(Boolean);
  const style = String(globalStyle || "").trim();
  if (style) parts.push(style);
  return parts.join("\n\n");
}

export function sceneHasAudioPromptSources(
  scene: Pick<FilmSceneRecord, "audioAmbience" | "sfx" | "music" | "voiceDirection">
): boolean {
  return Boolean(
    String(scene.audioAmbience || "").trim() ||
      String(scene.sfx || "").trim() ||
      String(scene.music || "").trim() ||
      String(scene.voiceDirection || "").trim()
  );
}

export function resolveFilmSceneAudioPrompt(
  scene: FilmSceneRecord,
  globalStyle?: string | null
): string {
  const built = buildFilmSceneAudioPrompt(scene, globalStyle);
  if (built) return built;
  return String(scene.audioPrompt || "").trim();
}

export function withBuiltSceneAudioPrompt<T extends FilmSceneRecord>(
  scene: T,
  globalStyle?: string | null
): T {
  if (scene.audioPromptCustom) return scene;
  const audioPrompt = resolveFilmSceneAudioPrompt(scene, globalStyle);
  if ((scene.audioPrompt || "") === audioPrompt) return scene;
  return {
    ...scene,
    audioPrompt,
  };
}

export function hydrateScenesAudioPrompts(
  scenes: FilmSceneRecord[],
  globalStyle?: string | null
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((s) => {
    if (s.audioPromptCustom) return s;
    if (!sceneHasAudioPromptSources(s) && !String(globalStyle || "").trim()) {
      return s;
    }
    const audioPrompt = resolveFilmSceneAudioPrompt(s, globalStyle);
    if (!audioPrompt || (s.audioPrompt || "") === audioPrompt) return s;
    const synced: FilmSceneRecord = {
      ...s,
      audioPrompt,
      updatedAt: new Date().toISOString(),
    };
    changed.push(synced);
    return synced;
  });
  return { scenes: next, changed };
}

/** Có field nguồn để ghép prompt video. */
export function sceneHasVideoPromptSources(scene: FilmSceneVideoPromptSource): boolean {
  return Boolean(
    String(scene.shotSize || "").trim() ||
      String(scene.cameraAngle || "").trim() ||
      String(scene.cameraMovement || "").trim() ||
      String(scene.dialogue || "").trim() ||
      String(scene.motionPrompt || "").trim() ||
      String(scene.audioAmbience || "").trim() ||
      String(scene.sfx || "").trim() ||
      String(scene.music || "").trim() ||
      String(scene.voiceDirection || "").trim() ||
      String(scene.action || "").trim() ||
      String(scene.visualDescription || "").trim() ||
      String(scene.atmosphere || "").trim()
  );
}

function hasVideoDetailTags(text: string): boolean {
  return /\[(MOTION|AUDIO|SFX|MUSIC|VOICE|DIALOGUE)\]/i.test(text);
}

/** Prompt video: field nguồn (có tag) → videoPrompt đã gắn từ extract → style. */
export function resolveFilmSceneVideoPrompt(
  scene: FilmSceneRecord,
  globalStyle?: string | null
): string {
  const built = buildFilmSceneVideoPrompt(scene, globalStyle);
  const stored = String(scene.videoPrompt || "").trim();
  const builtHasTags = hasVideoDetailTags(built);
  const storedHasTags = hasVideoDetailTags(stored);

  let result = "";
  // Extract đã gắn [MOTION]… vào videoPrompt — giữ nếu bản ghép chưa có tag
  if (storedHasTags && !builtHasTags) result = stored;
  else if (builtHasTags) result = built;
  else if (built) result = built;
  else if (stored) result = stored;
  else result = String(globalStyle || "").trim();

  if (scene.videoSilentLipSync) {
    return ensureFilmSilentLipSyncPrompt(result);
  }
  return result;
}

/** Ghi videoPrompt đã ghép vào scene. */
export function withBuiltSceneVideoPrompt<T extends FilmSceneRecord>(
  scene: T,
  globalStyle?: string | null
): T {
  if (scene.videoPromptCustom) return scene;
  const videoPrompt = resolveFilmSceneVideoPrompt(scene, globalStyle);
  if ((scene.videoPrompt || "") === videoPrompt) return scene;
  return {
    ...scene,
    videoPrompt,
  };
}

/**
 * Đồng bộ videoPrompt cho list scene (load / mở tab).
 */
export function hydrateScenesVideoPrompts(
  scenes: FilmSceneRecord[],
  globalStyle?: string | null
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((s) => {
    if (s.videoPromptCustom) return s;
    if (!sceneHasVideoPromptSources(s) && !String(globalStyle || "").trim()) {
      return s;
    }
    const videoPrompt = resolveFilmSceneVideoPrompt(s, globalStyle);
    if (!videoPrompt || (s.videoPrompt || "") === videoPrompt) return s;
    const synced: FilmSceneRecord = {
      ...s,
      videoPrompt,
      updatedAt: new Date().toISOString(),
    };
    changed.push(synced);
    return synced;
  });
  return { scenes: next, changed };
}
