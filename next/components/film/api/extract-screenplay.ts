/**
 * Client API: trích xuất phân cảnh (JSON object).
 * API key đọc từ Credential trên server — không gửi key từ frontend.
 * Map object AI → Storyboard / Characters / Props / Scene images (IndexedDB).
 */
import { type FilmAiProvider } from "../film-ai-keys";
import {
  getFilmCharactersByProject,
  getFilmPropsByProject,
  getFilmSceneImagesByProject,
  replaceFilmCharactersForProject,
  replaceFilmPropsForProject,
  replaceFilmSceneImagesForProject,
  replaceFilmScenesForEpisode,
} from "../film-idb";
import { buildFilmCharacterImagePrompt } from "../film-character-image-prompt";
import {
  emptyFilmDialogueLine,
  formatFilmDialogueText,
} from "../film-dialogue";
import { buildFilmLocationImagePrompt } from "../film-location-image-prompt";
import { buildFilmPropImagePrompt } from "../film-prop-image-prompt";
import { buildFilmSceneImagePrompt } from "../film-scene-image-prompt";
import {
  buildFilmSceneAudioPrompt,
  buildFilmSceneVideoPrompt,
} from "../film-scene-video-prompt";
import {
  buildFilmCharactersFromNames,
  buildFilmPropsFromNames,
  buildFilmSceneImagesFromLocations,
  createFilmId,
  type FilmCharacterRecord,
  type FilmEpisodeRecord,
  type FilmPropRecord,
  type FilmSceneImageRecord,
  type FilmSceneRecord,
} from "../film-types";

export type FilmExtractDialogue = {
  character: string;
  line: string;
};

export type FilmExtractCharacterAction = {
  character: string;
  action: string;
};

export type FilmExtractSceneItem = {
  index: number;
  title: string;
  content: string;
  characterActions: FilmExtractCharacterAction[];
  visualDescription: string;
  atmosphere: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  motion?: string;
  audio?: string;
  sfx?: string;
  music?: string;
  voice?: string;
  /** Prompt video đầy đủ (gắn UI) */
  videoPrompt?: string;
  dialogues: FilmExtractDialogue[];
  location: string;
  characterNames: string[];
  propNames: string[];
};

export type FilmExtractCharacterItem = {
  name: string;
  description: string;
  /** Clothing & Accessories */
  clothingAccessories: string;
  role: string;
};

export type FilmExtractLocationItem = {
  name: string;
  description: string;
  context: string;
  /** Time of Day — e.g. Golden Hour, Harsh Noon, Rainy Night */
  timeOfDay: string;
};

export type FilmExtractPropItem = {
  name: string;
  description: string;
  category: string;
};

export type FilmExtractScreenplayResult = {
  scenes: FilmExtractSceneItem[];
  characters: FilmExtractCharacterItem[];
  locations: FilmExtractLocationItem[];
  props: FilmExtractPropItem[];
  provider: FilmAiProvider;
  model: string;
  language?: string;
  sceneCount?: number;
};

export type FilmExtractApplied = {
  scenes: FilmSceneRecord[];
  characters: FilmCharacterRecord[];
  props: FilmPropRecord[];
  sceneImages: FilmSceneImageRecord[];
};

/** "Tên nhân vật: hành động" mỗi dòng */
function formatCharacterActions(actions: FilmExtractCharacterAction[]): string {
  return actions
    .map((a) => {
      const name = String(a.character || "").trim();
      const action = String(a.action || "").trim();
      if (!name && !action) return "";
      if (!name) return action;
      return `${name}: ${action}`;
    })
    .filter(Boolean)
    .join("\n");
}

function uniqueNames(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const n = String(raw || "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function normalizeRole(role?: string): string {
  const r = String(role || "").trim().toLowerCase();
  if (r === "main" || r === "protagonist" || r === "chính") return "main";
  if (r === "antagonist" || r === "villain" || r === "phản diện") return "antagonist";
  if (r === "extra" || r === "quần chúng") return "extra";
  if (r === "supporting" || r === "phụ") return "supporting";
  return r || "supporting";
}

function normalizeCategory(category?: string): string {
  const c = String(category || "").trim().toLowerCase();
  if (["weapon", "container", "prop", "clothing", "other"].includes(c)) return c;
  return "prop";
}

/** Gộp danh sách characters từ object AI + fallback từ scenes */
export function mergeExtractCharacters(
  characters: FilmExtractCharacterItem[],
  scenes: FilmExtractSceneItem[]
): FilmExtractCharacterItem[] {
  const map = new Map<string, FilmExtractCharacterItem>();
  for (const c of characters || []) {
    const name = String(c.name || "").trim();
    if (!name) continue;
    map.set(name.toLowerCase(), {
      name,
      description: String(c.description || "").trim(),
      clothingAccessories: String(c.clothingAccessories || "").trim(),
      role: normalizeRole(c.role),
    });
  }
  for (const sc of scenes || []) {
    for (const n of sc.characterNames || []) {
      const name = String(n || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, description: "", clothingAccessories: "", role: "supporting" });
      }
    }
    for (const d of sc.dialogues || []) {
      const name = String(d.character || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, description: "", clothingAccessories: "", role: "supporting" });
      }
    }
  }
  return Array.from(map.values());
}

/** Gộp props từ object AI + fallback từ scenes */
export function mergeExtractProps(
  props: FilmExtractPropItem[],
  scenes: FilmExtractSceneItem[]
): FilmExtractPropItem[] {
  const map = new Map<string, FilmExtractPropItem>();
  for (const p of props || []) {
    const name = String(p.name || "").trim();
    if (!name) continue;
    map.set(name.toLowerCase(), {
      name,
      description: String(p.description || "").trim(),
      category: normalizeCategory(p.category),
    });
  }
  for (const sc of scenes || []) {
    for (const n of sc.propNames || []) {
      const name = String(n || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, description: "", category: "prop" });
      }
    }
  }
  return Array.from(map.values());
}

/** Gộp locations từ object AI + fallback từ scenes */
export function mergeExtractLocations(
  locations: FilmExtractLocationItem[],
  scenes: FilmExtractSceneItem[]
): FilmExtractLocationItem[] {
  const map = new Map<string, FilmExtractLocationItem>();
  for (const l of locations || []) {
    const name = String(l.name || "").trim();
    if (!name) continue;
    map.set(name.toLowerCase(), {
      name,
      description: String(l.description || "").trim(),
      context: String(l.context || "").trim() || "Ngày",
      timeOfDay: String(l.timeOfDay || "").trim() || "Daylight",
    });
  }
  for (const sc of scenes || []) {
    const names = [
      String(sc.location || "").trim(),
      ...((sc as { locationNames?: string[] }).locationNames || []),
    ];
    for (const name of names) {
      if (!name) continue;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          description: String(sc.content || "").trim().slice(0, 120),
          context: "Ngày",
          timeOfDay: "Daylight",
        });
      }
    }
  }
  return Array.from(map.values());
}

/** Map AI scenes → FilmSceneRecord[] (Storyboard) */
export function mapExtractScenesToFilmRecords(
  projectId: string,
  episode: FilmEpisodeRecord,
  scenes: FilmExtractSceneItem[]
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  return (scenes || []).map((sc, i) => {
    const content = String(sc.content || "").trim();
    const dialogueLines = (sc.dialogues || [])
      .map((d) =>
        emptyFilmDialogueLine(
          String(d.character || "").trim(),
          String(d.line || "").trim()
        )
      )
      .filter((d) => d.line || d.character);
    const dialogue =
      formatFilmDialogueText(dialogueLines) ||
      formatFilmDialogueText(
        (sc.dialogues || []).map((d) => ({
          character: d.character,
          line: d.line,
        }))
      );
    const characterActionText = formatCharacterActions(sc.characterActions || []);
    const visualDescription =
      String(sc.visualDescription || "").trim() || content;
    const atmosphere = String(sc.atmosphere || "").trim();
    const characterNames = uniqueNames([
      ...(sc.characterNames || []),
      ...(sc.dialogues || []).map((d) => d.character),
      ...(sc.characterActions || []).map((a) => a.character),
    ]);
    const propNames = uniqueNames(sc.propNames || []);
    const location = String(sc.location || "").trim();
    const title = String(sc.title || "").trim() || `Cảnh quay #${i + 1}`;
    const shotSize = String(sc.shotSize || "").trim() || "Trung cảnh";
    const cameraAngle = String(sc.cameraAngle || "").trim() || "Chính diện";
    const cameraMovement = String(sc.cameraMovement || "").trim() || "Tĩnh";
    const motionPrompt = String(sc.motion || "").trim();
    const audioAmbience = String(sc.audio || "").trim();
    const sfx = String(sc.sfx || "").trim();
    const music = String(sc.music || "").trim();
    const voiceDirection = String(sc.voice || "").trim();
    const fromAiVideo = String(sc.videoPrompt || "").trim();
    const composedVideo = buildFilmSceneVideoPrompt({
      shotSize,
      cameraAngle,
      cameraMovement,
      dialogue,
      motionPrompt,
      audioAmbience,
      sfx,
      music,
      voiceDirection,
      action: characterActionText || content,
      visualDescription,
      atmosphere,
    });
    const videoPrompt = composedVideo || fromAiVideo || "";

    return {
      id: createFilmId("sc"),
      projectId,
      episodeId: episode.id,
      index: Math.max(1, Number(sc.index) || i + 1),
      title,
      summary: content,
      shotSize,
      cameraAngle,
      cameraMovement,
      location,
      durationSec: 8,
      characterNames,
      propNames,
      locationNames: location ? [location] : [],
      sceneTag: location,
      action: characterActionText || content,
      visualDescription,
      atmosphere,
      dialogue,
      dialogueLines,
      imagePrompt: buildFilmSceneImagePrompt({
        visualDescription,
        atmosphere,
        action: characterActionText || content,
        shotSize,
        cameraAngle,
        location,
        summary: content,
      }),
      motionPrompt,
      audioAmbience,
      sfx,
      music,
      voiceDirection,
      videoPrompt,
      audioPrompt: buildFilmSceneAudioPrompt({
        audioAmbience,
        sfx,
        music,
        voiceDirection,
      }),
      mediaStatus: "pending",
      frameStatus: "pending",
      frameImageUrl: "",
      videoStatus: "pending",
      videoUrl: "",
      voiceStatus: "pending",
      voiceUrl: "",
      speakerName:
        dialogueLines[0]?.character?.trim() ||
        sc.dialogues?.[0]?.character?.trim() ||
        characterNames[0] ||
        "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
  });
}

function entityNameKey(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function linkEntityEpisode<T extends { episodeIds?: string[] }>(
  entity: T,
  episodeId?: string
): T {
  const id = String(episodeId || "").trim();
  if (!id) return entity;
  const ids = entity.episodeIds || [];
  if (ids.includes(id)) return entity;
  return { ...entity, episodeIds: [...ids, id] };
}

/**
 * Trùng tên (không phân biệt hoa thường) → giữ nguyên bản đã có (ảnh, mô tả, id).
 * Tên mới → thêm. Không xóa entity của tập khác.
 */
export function mapExtractCharactersToFilmRecords(
  projectId: string,
  items: FilmExtractCharacterItem[],
  existing: FilmCharacterRecord[] = [],
  promptTemplate?: string | null,
  episodeId?: string
): FilmCharacterRecord[] {
  const extracted = mergeExtractCharacters(items, []);
  const extractedKeys = new Set(extracted.map((c) => entityNameKey(c.name)));
  const existingKeys = new Set(existing.map((c) => entityNameKey(c.name)));

  const kept = existing.map((c) =>
    extractedKeys.has(entityNameKey(c.name)) ? linkEntityEpisode(c, episodeId) : c
  );

  const toAdd = extracted.filter((c) => !existingKeys.has(entityNameKey(c.name)));
  if (!toAdd.length) return kept;

  const built = buildFilmCharactersFromNames(
    projectId,
    toAdd.map((c) => c.name)
  );
  const srcByName = new Map(toAdd.map((c) => [entityNameKey(c.name), c]));
  const startOrder = kept.reduce((m, c) => Math.max(m, Number(c.sortOrder) || 0), -1) + 1;

  const added = built.map((c, i) => {
    const src = srcByName.get(entityNameKey(c.name));
    const next: FilmCharacterRecord = {
      ...c,
      role: (src?.role || c.role) as FilmCharacterRecord["role"],
      description: src?.description || "",
      clothingAccessories: src?.clothingAccessories || "",
      episodeIds: episodeId ? [episodeId] : [],
      sortOrder: startOrder + i,
    };
    return {
      ...next,
      imagePrompt: buildFilmCharacterImagePrompt(next, promptTemplate),
    };
  });

  return [...kept, ...added];
}

export function mapExtractPropsToFilmRecords(
  projectId: string,
  items: FilmExtractPropItem[],
  existing: FilmPropRecord[] = [],
  promptTemplate?: string | null,
  episodeId?: string
): FilmPropRecord[] {
  const extracted = mergeExtractProps(items, []);
  const extractedKeys = new Set(extracted.map((p) => entityNameKey(p.name)));
  const existingKeys = new Set(existing.map((p) => entityNameKey(p.name)));

  const kept = existing.map((p) =>
    extractedKeys.has(entityNameKey(p.name)) ? linkEntityEpisode(p, episodeId) : p
  );

  const toAdd = extracted.filter((p) => !existingKeys.has(entityNameKey(p.name)));
  if (!toAdd.length) return kept;

  const built = buildFilmPropsFromNames(
    projectId,
    toAdd.map((p) => p.name),
    toAdd.map((p) => p.category || "prop")
  );
  const srcByName = new Map(toAdd.map((p) => [entityNameKey(p.name), p]));
  const startOrder = kept.reduce((m, p) => Math.max(m, Number(p.sortOrder) || 0), -1) + 1;

  const added = built.map((p, i) => {
    const src = srcByName.get(entityNameKey(p.name));
    const next: FilmPropRecord = {
      ...p,
      category: (src?.category || p.category) as FilmPropRecord["category"],
      description: src?.description || "",
      episodeIds: episodeId ? [episodeId] : [],
      sortOrder: startOrder + i,
    };
    return {
      ...next,
      imagePrompt: buildFilmPropImagePrompt(next, promptTemplate),
    };
  });

  return [...kept, ...added];
}

export function mapExtractLocationsToFilmRecords(
  projectId: string,
  items: FilmExtractLocationItem[],
  existing: FilmSceneImageRecord[] = [],
  aspectRatio?: string | null,
  promptTemplate?: string | null,
  episodeId?: string
): FilmSceneImageRecord[] {
  const extracted = mergeExtractLocations(items, []);
  const extractedKeys = new Set(extracted.map((l) => entityNameKey(l.name)));
  const existingKeys = new Set(existing.map((l) => entityNameKey(l.name)));

  const kept = existing.map((l) =>
    extractedKeys.has(entityNameKey(l.name)) ? linkEntityEpisode(l, episodeId) : l
  );

  const toAdd = extracted.filter((l) => !existingKeys.has(entityNameKey(l.name)));
  if (!toAdd.length) return kept;

  const built = buildFilmSceneImagesFromLocations(
    projectId,
    toAdd.map((l) => ({
      name: l.name,
      context: l.context || l.timeOfDay || "Ngày",
    }))
  );
  const srcByName = new Map(toAdd.map((l) => [entityNameKey(l.name), l]));
  const startOrder = kept.reduce((m, l) => Math.max(m, Number(l.sortOrder) || 0), -1) + 1;

  const added = built.map((p, i) => {
    const src = srcByName.get(entityNameKey(p.name));
    const timeOfDay = src?.timeOfDay || "Daylight";
    const next: FilmSceneImageRecord = {
      ...p,
      context: src?.context || p.context || timeOfDay,
      timeOfDay,
      description: src?.description || "",
      episodeIds: episodeId ? [episodeId] : [],
      sortOrder: startOrder + i,
    };
    return {
      ...next,
      imagePrompt: buildFilmLocationImagePrompt(next, aspectRatio, promptTemplate),
    };
  });

  return [...kept, ...added];
}

/**
 * Ghi object extract vào IndexedDB:
 * - scenes → Storyboard (chỉ tập đang extract, ghi đè cảnh của tập đó)
 * - characters / props / locations → project-wide:
 *   trùng tên thì giữ nguyên bản cũ; tên mới thì thêm.
 */
export async function applyFilmExtractResult(params: {
  projectId: string;
  episode: FilmEpisodeRecord;
  result: Pick<
    FilmExtractScreenplayResult,
    "scenes" | "characters" | "locations" | "props"
  >;
  /** Aspect ratio project — truyền vào prompt Ảnh Cảnh */
  aspectRatio?: string | null;
  /** Prompt mẫu Setting dự án */
  characterImagePromptTemplate?: string | null;
  propImagePromptTemplate?: string | null;
  locationImagePromptTemplate?: string | null;
  /** Prompt storyboard chung — gán khi extract tạo scene mới */
  storyboardImagePrompt?: string | null;
  storyboardVideoPrompt?: string | null;
  storyboardAudioPrompt?: string | null;
}): Promise<FilmExtractApplied> {
  const {
    projectId,
    episode,
    result,
    aspectRatio,
    characterImagePromptTemplate,
    propImagePromptTemplate,
    locationImagePromptTemplate,
    storyboardImagePrompt,
    storyboardVideoPrompt,
    storyboardAudioPrompt,
  } = params;

  const characterItems = mergeExtractCharacters(result.characters, result.scenes);
  const propItems = mergeExtractProps(result.props, result.scenes);
  const locationItems = mergeExtractLocations(result.locations, result.scenes);

  const [existingChars, existingProps, existingLocs] = await Promise.all([
    getFilmCharactersByProject(projectId),
    getFilmPropsByProject(projectId),
    getFilmSceneImagesByProject(projectId),
  ]);

  const sbImage = String(storyboardImagePrompt || "").trim();
  const sbVideo = String(storyboardVideoPrompt || "").trim();
  const sbAudio = String(storyboardAudioPrompt || "").trim();

  const sceneRecords = mapExtractScenesToFilmRecords(projectId, episode, result.scenes).map(
    (s) => {
      const extractedVideo = String(s.videoPrompt || "").trim();
      const rebuilt = buildFilmSceneVideoPrompt(s, sbVideo || undefined);
      const videoPrompt =
        extractedVideo && /\[(MOTION|AUDIO|SFX|MUSIC|VOICE|DIALOGUE)\]/i.test(extractedVideo)
          ? extractedVideo
          : rebuilt || extractedVideo;
      return {
        ...s,
        imagePrompt: buildFilmSceneImagePrompt(s, sbImage || undefined),
        videoPrompt,
        audioPrompt:
          buildFilmSceneAudioPrompt(s, sbAudio || undefined) || s.audioPrompt || "",
      };
    }
  );
  const characterRecords = mapExtractCharactersToFilmRecords(
    projectId,
    characterItems,
    existingChars,
    characterImagePromptTemplate,
    episode.id
  );
  const propRecords = mapExtractPropsToFilmRecords(
    projectId,
    propItems,
    existingProps,
    propImagePromptTemplate,
    episode.id
  );
  const locationRecords = mapExtractLocationsToFilmRecords(
    projectId,
    locationItems,
    existingLocs,
    aspectRatio,
    locationImagePromptTemplate,
    episode.id
  );
  const [scenes, characters, props, sceneImages] = await Promise.all([
    replaceFilmScenesForEpisode(projectId, episode.id, sceneRecords),
    replaceFilmCharactersForProject(projectId, characterRecords),
    replaceFilmPropsForProject(projectId, propRecords),
    replaceFilmSceneImagesForProject(projectId, locationRecords),
  ]);

  return { scenes, characters, props, sceneImages };
}

export type FilmExtractPreviousScene = {
  title: string;
  summary: string;
};

/** Tiêu đề + Tổng quan cảnh quay của tập trước — gửi kèm prompt khi Kế thừa. */
export function buildFilmPreviousEpisodeScenes(
  scenes: FilmSceneRecord[]
): FilmExtractPreviousScene[] {
  return [...scenes]
    .sort((a, b) => a.index - b.index)
    .map((s) => ({
      title: String(s.title || "").trim() || `Cảnh quay #${s.index}`,
      summary: String(s.summary || "").trim(),
    }))
    .filter((s) => s.title || s.summary);
}

export async function extractFilmScreenplay(params: {
  content: string;
  language?: string;
  /** Bắt buộc gen đúng số phân cảnh này */
  sceneCount: number;
  /** Ngôi kể dự án — dialogue | third_person | pov */
  narration?: "dialogue" | "third_person" | "pov";
  /** Chỉ gửi khi user sửa Setting; backend tự dùng default. */
  systemInstruction?: string;
  /** Kế thừa: Tiêu đề + Tổng quan tập trước */
  previousScenes?: FilmExtractPreviousScene[];
}): Promise<FilmExtractScreenplayResult> {
  const content = String(params.content || "").trim();
  const language = String(params.language || "Vietnamese").trim() || "Vietnamese";
  const sceneCount = Math.max(1, Math.min(60, Math.floor(Number(params.sceneCount) || 6)));
  const systemInstruction = String(params.systemInstruction || "").trim();
  const narrationRaw = String(params.narration || "").trim().toLowerCase();
  const narration =
    narrationRaw === "third_person" || narrationRaw === "pov" ? narrationRaw : "dialogue";
  if (!content) throw new Error("Thiếu nội dung gốc");

  const previousScenes = (params.previousScenes || [])
    .map((s) => ({
      title: String(s?.title || "").trim(),
      summary: String(s?.summary || "").trim(),
    }))
    .filter((s) => s.title || s.summary)
    .slice(0, 60);

  const res = await fetch("/api/app/film/extract-screenplay/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      language,
      sceneCount,
      narration,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(previousScenes.length ? { previousScenes } : {}),
    }),
  });

  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Trích xuất thất bại (${res.status})`);
  }

  const data = body?.data || {};
  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  if (scenes.length === 0) throw new Error("AI không trả về phân cảnh");

  const providerRaw = String(data.provider || "");
  const provider: FilmAiProvider =
    providerRaw === "gemini"
      ? "gemini"
      : providerRaw === "gateway"
        ? "gateway"
        : "openai";

  return {
    scenes,
    characters: Array.isArray(data.characters) ? data.characters : [],
    locations: Array.isArray(data.locations) ? data.locations : [],
    props: Array.isArray(data.props) ? data.props : [],
    provider,
    model: String(data.model || ""),
    language: String(data.language || language),
    sceneCount: Number(data.sceneCount) || scenes.length,
  };
}
