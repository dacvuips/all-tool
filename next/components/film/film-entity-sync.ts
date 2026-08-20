/**
 * Đồng bộ tên gắn storyboard ↔ entity production (Nhân vật / Vật phẩm / Bối cảnh).
 * Đổi tên: cập nhật attach lists + mọi text có chứa tên đó (case-insensitive, phrase-aware).
 */
import type {
  FilmCharacterRecord,
  FilmDialogueLineRecord,
  FilmEpisodeRecord,
  FilmProjectRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
} from "./film-types";
import { getFilmSceneLocationNames } from "./film-attachment-validate";

function nameKey(n: string): string {
  return n.trim().toLowerCase();
}

function stripName(list: string[] | undefined, name: string): string[] {
  const k = nameKey(name);
  return (list || []).filter((x) => nameKey(x) !== k);
}

export type FilmSceneAttachNameHit = {
  name: string;
  episodeIds: string[];
};

/** Tên NV / VP / Bối cảnh đang gắn trên storyboard, kèm tập. */
export function indexFilmSceneAttachNames(scenes: FilmSceneRecord[]): {
  characters: Map<string, FilmSceneAttachNameHit>;
  props: Map<string, FilmSceneAttachNameHit>;
  locations: Map<string, FilmSceneAttachNameHit>;
} {
  const characters = new Map<string, FilmSceneAttachNameHit>();
  const props = new Map<string, FilmSceneAttachNameHit>();
  const locations = new Map<string, FilmSceneAttachNameHit>();

  const add = (
    map: Map<string, FilmSceneAttachNameHit>,
    raw: string,
    episodeId?: string
  ) => {
    const name = raw.trim();
    if (!name) return;
    const k = nameKey(name);
    const cur = map.get(k) || { name, episodeIds: [] };
    if (episodeId && !cur.episodeIds.includes(episodeId)) {
      cur.episodeIds.push(episodeId);
    }
    map.set(k, cur);
  };

  for (const s of scenes) {
    const ep = (s.episodeId || "").trim();
    for (const n of s.characterNames || []) add(characters, n, ep);
    for (const n of s.propNames || []) add(props, n, ep);
    for (const n of getFilmSceneLocationNames(s)) add(locations, n, ep);
  }

  return { characters, props, locations };
}

function renameInList(
  list: string[] | undefined,
  oldName: string,
  newName: string
): string[] | null {
  const ok = nameKey(oldName);
  const nn = newName.trim();
  if (!ok || !nn) return null;
  let changed = false;
  const next = (list || []).map((x) => {
    if (nameKey(x) !== ok) return x;
    changed = true;
    return nn;
  });
  if (!changed) return null;
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const x of next) {
    const k = nameKey(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    deduped.push(x);
  }
  return deduped;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Thay cụm tên entity trong free-text (case-insensitive).
 * Không khớp giữa chừng chữ/số Unicode (vd. "An" không đổi "Hạnh").
 * Trả null nếu không đổi.
 */
export function replaceEntityNameInText(
  text: string | undefined | null,
  oldName: string,
  newName: string
): string | null {
  const src = text == null ? "" : String(text);
  const old = oldName.trim();
  const neu = newName.trim();
  if (!src || !old || !neu) return null;
  if (nameKey(old) === nameKey(neu)) return null;

  const esc = escapeRegExp(old);
  // Boundary: đầu/cuối chuỗi hoặc không kề \p{L}\p{N}_
  let re: RegExp;
  try {
    re = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${esc})(?=[^\\p{L}\\p{N}_]|$)`,
      "giu"
    );
  } catch {
    // Fallback nếu runtime thiếu unicode property escapes
    re = new RegExp(
      `(^|[^A-Za-z0-9_\\u00C0-\\u024F\\u1E00-\\u1EFF])(${esc})(?=[^A-Za-z0-9_\\u00C0-\\u024F\\u1E00-\\u1EFF]|$)`,
      "gi"
    );
  }

  let changed = false;
  const out = src.replace(re, (_full, before: string) => {
    changed = true;
    return `${before}${neu}`;
  });
  return changed ? out : null;
}

function applyTextField<T extends object>(
  obj: T,
  key: keyof T,
  oldName: string,
  newName: string
): boolean {
  const cur = obj[key];
  if (typeof cur !== "string" || !cur) return false;
  const next = replaceEntityNameInText(cur, oldName, newName);
  if (next == null) return false;
  (obj as any)[key] = next;
  return true;
}

/** Field free-text trên phân cảnh Chuỗi Cảnh quay */
const SCENE_FREE_TEXT_KEYS: (keyof FilmSceneRecord)[] = [
  "title",
  "summary",
  "action",
  "visualDescription",
  "atmosphere",
  "dialogue",
  "imagePrompt",
  "videoPrompt",
  "audioPrompt",
  "motionPrompt",
  "audioAmbience",
  "sfx",
  "music",
  "voiceDirection",
  "frameSuggestedPrompt",
  "frameSuggestSummary",
  "location",
  "sceneTag",
  "speakerName",
];

/**
 * Gỡ tên entity khỏi mọi phân cảnh (characterNames / propNames / locationNames).
 * Đồng bộ sceneTag + location theo locationNames[0].
 */
export function stripEntityNameFromScenes(
  scenes: FilmSceneRecord[],
  kind: "character" | "prop" | "location",
  name: string
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  return scenes.map((s) => {
    if (kind === "character") {
      const next = stripName(s.characterNames, name);
      if (next.length === (s.characterNames || []).length) return s;
      return { ...s, characterNames: next, updatedAt: now };
    }
    if (kind === "prop") {
      const next = stripName(s.propNames, name);
      if (next.length === (s.propNames || []).length) return s;
      return { ...s, propNames: next, updatedAt: now };
    }
    const locNames = getFilmSceneLocationNames(s);
    const next = stripName(locNames, name);
    if (next.length === locNames.length) return s;
    const first = next[0] || "";
    return {
      ...s,
      locationNames: next,
      sceneTag: first,
      location: first,
      updatedAt: now,
    };
  });
}

/**
 * Đổi tên entity trên mọi phân cảnh:
 * - Gắn input (characterNames / propNames / locationNames / sceneTag / location)
 * - Free text (summary, action, visualDescription, dialogue, prompts, …)
 * - dialogueLines.character + nội dung line
 */
export function renameEntityNameInScenes(
  scenes: FilmSceneRecord[],
  kind: "character" | "prop" | "location",
  oldName: string,
  newName: string
): FilmSceneRecord[] {
  const oldK = nameKey(oldName);
  const nextName = newName.trim();
  if (!oldK || !nextName || oldK === nameKey(nextName)) return scenes;
  const now = new Date().toISOString();

  return scenes.map((s) => {
    let changed = false;
    let next: FilmSceneRecord = { ...s };

    if (kind === "character") {
      const chars = renameInList(s.characterNames, oldName, nextName);
      if (chars) {
        next.characterNames = chars;
        changed = true;
      }
      if (s.speakerName && nameKey(s.speakerName) === oldK) {
        next.speakerName = nextName;
        changed = true;
      }
    } else if (kind === "prop") {
      const props = renameInList(s.propNames, oldName, nextName);
      if (props) {
        next.propNames = props;
        changed = true;
      }
    } else {
      const locNames = getFilmSceneLocationNames(s);
      const locs = renameInList(locNames, oldName, nextName);
      if (locs) {
        next.locationNames = locs;
        const first = locs[0] || "";
        next.sceneTag = first;
        next.location = first;
        changed = true;
      } else {
        if (s.sceneTag && nameKey(s.sceneTag) === oldK) {
          next.sceneTag = nextName;
          changed = true;
        }
        if (s.location && nameKey(s.location) === oldK) {
          next.location = nextName;
          changed = true;
        }
        if (changed && !next.locationNames?.length) {
          next.locationNames = [nextName];
        }
      }
    }

    // Free-text (mọi kind — tên có thể xuất hiện trong tóm tắt / prompt / thoại)
    for (const key of SCENE_FREE_TEXT_KEYS) {
      if (applyTextField(next, key, oldName, nextName)) changed = true;
    }

    if (s.dialogueLines?.length) {
      let linesChanged = false;
      const lines: FilmDialogueLineRecord[] = s.dialogueLines.map((dl) => {
        let row = dl;
        let rowChanged = false;
        if (nameKey(dl.character || "") === oldK) {
          row = { ...row, character: nextName };
          rowChanged = true;
        }
        const rewrittenLine = replaceEntityNameInText(dl.line, oldName, nextName);
        if (rewrittenLine != null) {
          row = { ...row, line: rewrittenLine };
          rowChanged = true;
        }
        if (rowChanged) linesChanged = true;
        return row;
      });
      if (linesChanged) {
        next.dialogueLines = lines;
        changed = true;
      }
    }

    if (!changed) return s;
    return { ...next, updatedAt: now };
  });
}

/** Free-text + propNames trên card Nhân vật */
export function renameEntityNameInCharacters(
  characters: FilmCharacterRecord[],
  oldName: string,
  newName: string,
  options?: { excludeId?: string }
): FilmCharacterRecord[] {
  const nextName = newName.trim();
  if (!nameKey(oldName) || !nextName || nameKey(oldName) === nameKey(nextName)) {
    return characters;
  }
  const now = new Date().toISOString();
  return characters.map((c) => {
    if (options?.excludeId && c.id === options.excludeId) {
      // vẫn rewrite free-text (mô tả cũ) nhưng không rename list đặc biệt
    }
    let changed = false;
    let next = { ...c };

    const propList = renameInList(c.propNames, oldName, nextName);
    if (propList) {
      next.propNames = propList;
      changed = true;
    }
    if (applyTextField(next, "description", oldName, nextName)) changed = true;
    if (applyTextField(next, "clothingAccessories", oldName, nextName)) changed = true;
    if (applyTextField(next, "imagePrompt", oldName, nextName)) changed = true;

    if (!changed) return c;
    return { ...next, updatedAt: now };
  });
}

/** Free-text + propNames kèm trên Vật phẩm */
export function renameEntityNameInProps(
  props: FilmPropRecord[],
  oldName: string,
  newName: string,
  options?: { excludeId?: string }
): FilmPropRecord[] {
  const nextName = newName.trim();
  if (!nameKey(oldName) || !nextName || nameKey(oldName) === nameKey(nextName)) {
    return props;
  }
  const now = new Date().toISOString();
  return props.map((p) => {
    let changed = false;
    let next = { ...p };

    if (!(options?.excludeId && p.id === options.excludeId)) {
      const companions = renameInList(p.propNames, oldName, nextName);
      if (companions) {
        next.propNames = companions;
        changed = true;
      }
    } else {
      const companions = renameInList(p.propNames, oldName, nextName);
      if (companions) {
        next.propNames = companions;
        changed = true;
      }
    }
    if (applyTextField(next, "description", oldName, nextName)) changed = true;
    if (applyTextField(next, "imagePrompt", oldName, nextName)) changed = true;

    if (!changed) return p;
    return { ...next, updatedAt: now };
  });
}

/** Free-text + propNames trên Bối cảnh */
export function renameEntityNameInLocations(
  locations: FilmSceneImageRecord[],
  oldName: string,
  newName: string
): FilmSceneImageRecord[] {
  const nextName = newName.trim();
  if (!nameKey(oldName) || !nextName || nameKey(oldName) === nameKey(nextName)) {
    return locations;
  }
  const now = new Date().toISOString();
  return locations.map((loc) => {
    let changed = false;
    let next = { ...loc };

    const propList = renameInList(loc.propNames, oldName, nextName);
    if (propList) {
      next.propNames = propList;
      changed = true;
    }
    if (applyTextField(next, "description", oldName, nextName)) changed = true;
    if (applyTextField(next, "context", oldName, nextName)) changed = true;
    if (applyTextField(next, "imagePrompt", oldName, nextName)) changed = true;

    if (!changed) return loc;
    return { ...next, updatedAt: now };
  });
}

/** Nội dung gốc từng tập */
export function renameEntityNameInEpisodes(
  episodes: FilmEpisodeRecord[],
  oldName: string,
  newName: string
): FilmEpisodeRecord[] {
  const nextName = newName.trim();
  if (!nameKey(oldName) || !nextName || nameKey(oldName) === nameKey(nextName)) {
    return episodes;
  }
  const now = new Date().toISOString();
  return episodes.map((ep) => {
    let changed = false;
    let next = { ...ep };
    if (applyTextField(next, "title", oldName, nextName)) changed = true;
    if (applyTextField(next, "originalContent", oldName, nextName)) changed = true;
    if (!changed) return ep;
    return { ...next, updatedAt: now };
  });
}

/** Prompt mẫu / storyboard style trên project Setting */
export function renameEntityNameInProject(
  project: FilmProjectRecord,
  oldName: string,
  newName: string
): FilmProjectRecord | null {
  const nextName = newName.trim();
  if (!nameKey(oldName) || !nextName || nameKey(oldName) === nameKey(nextName)) {
    return null;
  }
  let next = { ...project };
  let changed = false;
  if (applyTextField(next, "characterImagePromptTemplate", oldName, nextName))
    changed = true;
  if (applyTextField(next, "propImagePromptTemplate", oldName, nextName))
    changed = true;
  if (applyTextField(next, "locationImagePromptTemplate", oldName, nextName))
    changed = true;
  if (applyTextField(next, "storyboardImagePrompt", oldName, nextName))
    changed = true;
  if (applyTextField(next, "storyboardVideoPrompt", oldName, nextName))
    changed = true;
  if (applyTextField(next, "storyboardAudioPrompt", oldName, nextName))
    changed = true;
  if (!changed) return null;
  return { ...next, updatedAt: new Date().toISOString() };
}

/** @deprecated — dùng renameEntityNameInCharacters */
export function renamePropNameOnCharacters(
  characters: FilmCharacterRecord[],
  oldName: string,
  newName: string
): FilmCharacterRecord[] {
  return renameEntityNameInCharacters(characters, oldName, newName);
}

/** @deprecated — dùng renameEntityNameInProps */
export function renamePropNameOnProps(
  props: FilmPropRecord[],
  oldName: string,
  newName: string,
  excludeId?: string
): FilmPropRecord[] {
  return renameEntityNameInProps(props, oldName, newName, { excludeId });
}

/** @deprecated — dùng renameEntityNameInLocations */
export function renamePropNameOnLocations(
  locations: FilmSceneImageRecord[],
  oldName: string,
  newName: string
): FilmSceneImageRecord[] {
  return renameEntityNameInLocations(locations, oldName, newName);
}

export function countScenesReferencingName(
  scenes: FilmSceneRecord[],
  kind: "character" | "prop" | "location",
  name: string
): number {
  const k = nameKey(name);
  if (!k) return 0;
  let n = 0;
  for (const s of scenes) {
    if (kind === "character") {
      if ((s.characterNames || []).some((x) => nameKey(x) === k)) n += 1;
    } else if (kind === "prop") {
      if ((s.propNames || []).some((x) => nameKey(x) === k)) n += 1;
    } else {
      if (getFilmSceneLocationNames(s).some((x) => nameKey(x) === k)) n += 1;
    }
  }
  return n;
}
