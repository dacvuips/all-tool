/**
 * Prompt video phân cảnh — ghép từ Chuỗi Cảnh quay.
 * Nguồn: Cỡ cảnh, Góc máy, Lia máy + [MOTION][AUDIO][SFX][MUSIC][VOICE][DIALOGUE]
 * (+ tuỳ chọn suffix cấu hình Setting).
 */
import type { FilmSceneRecord } from "./film-types";
import { formatFilmPromptBracketBlock } from "./film-scene-image-prompt";

export type FilmSceneVideoPromptSource = Pick<
  FilmSceneRecord,
  | "shotSize"
  | "cameraAngle"
  | "cameraMovement"
  | "dialogue"
  | "videoPrompt"
  | "motionPrompt"
  | "audioAmbience"
  | "sfx"
  | "music"
  | "voiceDirection"
  | "action"
  | "visualDescription"
  | "atmosphere"
>;

function tagged(tag: string, value?: string | null): string {
  return formatFilmPromptBracketBlock(tag, value);
}

/**
 * Gắn field scene → Prompt video.
 * Thứ tự: Cỡ cảnh → Góc máy → Lia máy → [MOTION] [AUDIO] [SFX] [MUSIC] [VOICE] [DIALOGUE]
 */
export function buildFilmSceneVideoPrompt(
  scene: FilmSceneVideoPromptSource,
  globalStyle?: string | null
): string {
  const parts: string[] = [];

  const shotSizeBlock = formatFilmPromptBracketBlock("Cỡ cảnh", scene.shotSize);
  const cameraAngleBlock = formatFilmPromptBracketBlock("Góc máy", scene.cameraAngle);
  const cameraMovementBlock = formatFilmPromptBracketBlock(
    "Lia máy",
    scene.cameraMovement
  );
  const dialogue = String(scene.dialogue || "").trim();
  const style = String(globalStyle || "").trim();

  if (shotSizeBlock) parts.push(shotSizeBlock);
  if (cameraAngleBlock) parts.push(cameraAngleBlock);
  if (cameraMovementBlock) parts.push(cameraMovementBlock);

  const actionBlock = formatFilmPromptBracketBlock(
    "Hành động nhân vật",
    scene.action
  );
  const visualBlock = formatFilmPromptBracketBlock(
    "Hình ảnh cảnh quay",
    scene.visualDescription
  );
  const atmosphereBlock = formatFilmPromptBracketBlock(
    "Không khí cảnh",
    scene.atmosphere
  );
  if (actionBlock) parts.push(actionBlock);
  if (visualBlock) parts.push(visualBlock);
  if (atmosphereBlock) parts.push(atmosphereBlock);

  const motion = tagged("MOTION", scene.motionPrompt);
  const audio = tagged("AUDIO", scene.audioAmbience);
  const sfx = tagged("SFX", scene.sfx);
  const music = tagged("MUSIC", scene.music);
  const voice = tagged("VOICE", scene.voiceDirection);
  const dialogueTag = tagged("DIALOGUE", dialogue);

  if (motion) parts.push(motion);
  if (audio) parts.push(audio);
  if (sfx) parts.push(sfx);
  if (music) parts.push(music);
  if (voice) parts.push(voice);
  if (dialogueTag) parts.push(dialogueTag);

  if (style) parts.push(style);

  if (parts.length) return parts.join("\n\n");

  return "";
}

/** Ghép [AUDIO]/[SFX]/[MUSIC]/[VOICE] → Prompt âm thanh. */
export function buildFilmSceneAudioPrompt(
  scene: Pick<
    FilmSceneRecord,
    "audioAmbience" | "sfx" | "music" | "voiceDirection"
  >,
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

  // Extract đã gắn [MOTION]… vào videoPrompt — giữ nếu bản ghép chưa có tag
  if (storedHasTags && !builtHasTags) return stored;
  if (builtHasTags) return built;
  if (built) return built;
  if (stored) return stored;
  return String(globalStyle || "").trim();
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
