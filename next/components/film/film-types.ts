/**
 * Film short-project IndexedDB — database riêng, tách biệt hoàn toàn
 * với affiliate-video / video-affiliate-manager / wolf / ...
 *
 * Database : film-short-projects
 * Version  : 1
 *
 * Object stores
 * ─────────────────────────────────────────────────────────────
 * projects   – metadata dự án phim ngắn (list home)
 * episodes   – tập phim thuộc project
 * characters – nhân vật thuộc project
 * props      – vật phẩm thuộc project
 * sceneImages – ảnh bối cảnh / địa điểm
 * scenes     – phân cảnh thuộc tập / project
 * meta       – key/value cấu hình local (tuỳ chọn)
 *
 * Quan hệ
 * ─────────────────────────────────────────────────────────────
 * projects 1 ──* episodes 1 ──* scenes
 * projects 1 ──* characters
 * projects 1 ──* props
 * projects 1 ──* sceneImages
 * scenes.projectId + scenes.episodeId (denormalized để query nhanh)
 */

// ── DB constants ─────────────────────────────────────────────────────────────

export const FILM_DB_NAME = "film-short-projects";
/** Bump khi thêm store/index — v4 đảm bảo schema đầy đủ (sceneImages, props, …) */
export const FILM_DB_VERSION = 4;

export const FILM_STORE = {
  projects: "projects",
  episodes: "episodes",
  characters: "characters",
  props: "props",
  sceneImages: "sceneImages",
  scenes: "scenes",
  meta: "meta",
} as const;

export type FilmStoreName = (typeof FILM_STORE)[keyof typeof FILM_STORE];

// ── Domain types ─────────────────────────────────────────────────────────────

export type FilmAspectRatio = "16:9" | "9:16";
export type FilmNarration = "dialogue" | "third_person";
export type FilmEntityStatus = "draft" | "in_progress" | "done";

/** Dự án phim ngắn — store: projects (keyPath: id) */
export type FilmProjectRecord = {
  id: string;
  name: string;
  episodeCount: number;
  /** Để trống = auto chia khi generate */
  scenesPerEpisode?: number;
  artStyleId: string;
  artStyleLabel: string;
  aspectRatio: FilmAspectRatio;
  narration: FilmNarration;
  /** 0–100, denormalized cho progress bar ở list */
  progress: number;
  /** Denormalized count cho card list */
  characterCount: number;
  /** Denormalized count cho card list */
  sceneCount: number;
  coverImageId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Tập phim — store: episodes (keyPath: id, index: projectId, projectId_index) */
export type FilmEpisodeRecord = {
  id: string;
  projectId: string;
  /** Thứ tự tập, 1-based */
  index: number;
  title: string;
  status: FilmEntityStatus;
  sceneCount: number;
  /** Nội dung gốc (tiểu thuyết / tóm tắt) — panel script */
  originalContent?: string;
  createdAt: string;
  updatedAt: string;
};

/** Bước workspace sidebar */
export type FilmWorkspaceStepId =
  | "original_content"
  | "storyboard"
  | "character_images"
  | "props"
  | "scene_images"
  | "voice"
  | "shot_images"
  | "create_video";

export type FilmWorkspaceStepSection = "script" | "production";

export type FilmWorkspaceStep = {
  id: FilmWorkspaceStepId;
  section: FilmWorkspaceStepSection;
  label: string;
  /** Hiển thị số bước kiểu "01" cho script items */
  stepNo?: string;
  /** Đánh dấu hoàn thành (UI) */
  done?: boolean;
};

/** Nhân vật — store: characters (keyPath: id, index: projectId) */
export type FilmCharacterRole = "main" | "antagonist" | "supporting" | "extra";

export type FilmCharacterStatus = "pending" | "created" | "failed";

export type FilmCharacterRecord = {
  id: string;
  projectId: string;
  name: string;
  /** Main / Antagonist / Supporting... */
  role?: FilmCharacterRole | string;
  description?: string;
  /** Ảnh chính */
  imageUrl?: string;
  /** Gallery poses */
  imageUrls?: string[];
  status?: FilmCharacterStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Vật phẩm — store: props (keyPath: id, index: projectId) */
export type FilmPropCategory = "weapon" | "container" | "prop" | "clothing" | "other";

export type FilmPropStatus = "pending" | "created" | "failed";

export type FilmPropRecord = {
  id: string;
  projectId: string;
  name: string;
  category?: FilmPropCategory | string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  status?: FilmPropStatus;
  locked?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Ảnh bối cảnh (Ảnh Cảnh) — store: sceneImages */
export type FilmSceneImageStatus = "pending" | "creating" | "created" | "failed";

export type FilmSceneImageRecord = {
  id: string;
  projectId: string;
  /** Tên địa điểm / cảnh (vd. Hoa Quả Sơn) */
  name: string;
  /** Ngữ cảnh: Ngày, Tối, sau khi đuổi đi... */
  context?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  status?: FilmSceneImageStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Phân cảnh / cảnh quay — store: scenes (keyPath: id, indexes: projectId, episodeId) */
export type FilmSceneRecord = {
  id: string;
  projectId: string;
  episodeId: string;
  /** Thứ tự trong tập, 1-based */
  index: number;
  /** Tiêu đề ngắn */
  title?: string;
  /** Tóm tắt / overview */
  summary?: string;
  /** Cỡ cảnh: Toàn cảnh, Trung cảnh... */
  shotSize?: string;
  /** Góc máy */
  cameraAngle?: string;
  /** Lia máy */
  cameraMovement?: string;
  /** Địa điểm */
  location?: string;
  /** Thời lượng giây */
  durationSec?: number;
  /** Tên nhân vật gắn */
  characterNames?: string[];
  /** Tên vật phẩm gắn */
  propNames?: string[];
  /** Gắn cảnh (tag) */
  sceneTag?: string;
  /** Hành động */
  action?: string;
  /** Mô tả hình ảnh */
  visualDescription?: string;
  /** Thoại / kể chuyện */
  dialogue?: string;
  /** Prompt ảnh */
  imagePrompt?: string;
  /** Prompt video */
  videoPrompt?: string;
  /** Prompt âm thanh */
  audioPrompt?: string;
  /** Trạng thái media preview (storyboard) */
  mediaStatus?: "pending" | "ready" | "error";
  /** Khung hình Ảnh Cảnh quay */
  frameStatus?: "pending" | "creating" | "ready" | "error";
  frameImageUrl?: string;
  /** Video tạo từ khung hình */
  videoStatus?: "pending" | "creating" | "ready" | "error";
  videoUrl?: string;
  /** Giọng / TTS cho thoại */
  voiceStatus?: "pending" | "creating" | "ready" | "error";
  voiceUrl?: string;
  /** Nguồn giọng: catalog | custom_id | minimax */
  voiceSource?: "catalog" | "custom_id" | "minimax";
  voiceId?: string;
  voiceLabel?: string;
  /** Tên nhân vật nói thoại (hiển thị badge) */
  speakerName?: string;
  status: FilmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

/** Meta key/value — store: meta (không keyPath, key do caller) */
export type FilmMetaRecord = {
  value: unknown;
  updatedAt: string;
};

// ── Input types (UI) ─────────────────────────────────────────────────────────

export type FilmProjectCreateInput = {
  name: string;
  episodeCount: number;
  scenesPerEpisode?: number;
  artStyleId: string;
  artStyleLabel: string;
  aspectRatio: FilmAspectRatio;
  narration: FilmNarration;
};

/** @deprecated alias – dùng FilmProjectRecord */
export type FilmProject = FilmProjectRecord;

export const FILM_ART_STYLE_FREE = "";

/** localStorage legacy (migrate 1 lần sang IDB) */
export const FILM_PROJECTS_STORAGE_KEY = "film-projects-v1";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createFilmId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildFilmProjectRecord(input: FilmProjectCreateInput): FilmProjectRecord {
  const now = new Date().toISOString();
  const sceneCount =
    input.scenesPerEpisode != null
      ? input.episodeCount * input.scenesPerEpisode
      : input.episodeCount * 3;

  return {
    id: createFilmId("film"),
    name: input.name,
    episodeCount: Math.max(1, input.episodeCount || 1),
    scenesPerEpisode: input.scenesPerEpisode,
    artStyleId: input.artStyleId || FILM_ART_STYLE_FREE,
    artStyleLabel: input.artStyleLabel || "",
    aspectRatio: input.aspectRatio,
    narration: input.narration,
    progress: 5,
    characterCount: 0,
    sceneCount,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildFilmEpisodesForProject(project: FilmProjectRecord): FilmEpisodeRecord[] {
  const now = project.createdAt || new Date().toISOString();
  const scenesPerEp = project.scenesPerEpisode ?? Math.max(1, Math.ceil(project.sceneCount / project.episodeCount) || 3);

  return Array.from({ length: project.episodeCount }, (_, i) => ({
    id: createFilmId("ep"),
    projectId: project.id,
    index: i + 1,
    title: `Tập ${i + 1}`,
    status: "draft" as FilmEntityStatus,
    sceneCount: scenesPerEp,
    originalContent: "",
    createdAt: now,
    updatedAt: now,
  }));
}

export function buildFilmScenesForEpisode(
  projectId: string,
  episode: FilmEpisodeRecord
): FilmSceneRecord[] {
  const now = episode.createdAt || new Date().toISOString();
  const count = Math.max(0, episode.sceneCount || 0);

  return Array.from({ length: count }, (_, i) => ({
    id: createFilmId("sc"),
    projectId,
    episodeId: episode.id,
    index: i + 1,
    title: `Cảnh quay #${i + 1}`,
    summary: "",
    shotSize: "Toàn cảnh",
    cameraAngle: "",
    cameraMovement: "",
    location: "",
    durationSec: 8,
    characterNames: [],
    propNames: [],
    sceneTag: "",
    action: "",
    visualDescription: "",
    dialogue: "",
    imagePrompt: "",
    videoPrompt: "",
    audioPrompt: "",
    mediaStatus: "pending" as const,
    frameStatus: "pending" as const,
    frameImageUrl: "",
    videoStatus: "pending" as const,
    videoUrl: "",
    voiceStatus: "pending" as const,
    voiceUrl: "",
    speakerName: "",
    status: "draft" as FilmEntityStatus,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Tạo scene storyboard placeholder từ nội dung gốc (client-side, chưa gọi AI) */
export function buildStoryboardScenesFromContent(
  projectId: string,
  episode: FilmEpisodeRecord,
  originalContent: string,
  preferredCount?: number
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  const paragraphs = originalContent
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const chunks =
    paragraphs.length > 0
      ? paragraphs
      : originalContent
          .split(/[.!?。]\s+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 15);

  const target =
    preferredCount && preferredCount > 0
      ? preferredCount
      : Math.min(12, Math.max(3, chunks.length || 3));

  const list: FilmSceneRecord[] = [];
  for (let i = 0; i < target; i++) {
    const text = chunks[i % Math.max(1, chunks.length)] || `Cảnh quay ${i + 1}`;
    const snippet = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    list.push({
      id: createFilmId("sc"),
      projectId,
      episodeId: episode.id,
      index: i + 1,
      title: `Cảnh quay #${i + 1}`,
      summary: snippet,
      shotSize: i % 2 === 0 ? "Toàn cảnh" : "Trung cảnh",
      cameraAngle: i % 3 === 0 ? "Phía sau" : "Chính diện",
      cameraMovement: i % 2 === 0 ? "Theo sau" : "Tĩnh",
      location: "",
      durationSec: 8 + (i % 5),
      characterNames: [],
      propNames: [],
      sceneTag: "",
      action: snippet,
      visualDescription: snippet,
      dialogue: "",
      imagePrompt: "",
      videoPrompt: "",
      audioPrompt: "",
      mediaStatus: "pending",
      frameStatus: "pending",
      frameImageUrl: "",
      videoStatus: "pending",
      videoUrl: "",
      voiceStatus: "pending",
      voiceUrl: "",
      speakerName: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }
  return list;
}

export function filmScenesTotalDuration(scenes: FilmSceneRecord[]): number {
  return scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);
}

const DEFAULT_ROLES: FilmCharacterRole[] = ["main", "antagonist", "supporting", "supporting", "extra"];

/** Gộp tên nhân vật từ scenes + trích thô từ thoại trong nội dung */
export function collectCharacterNamesFromScenes(scenes: FilmSceneRecord[]): string[] {
  const set = new Set<string>();
  for (const s of scenes) {
    for (const n of s.characterNames || []) {
      const t = n.trim();
      if (t) set.add(t);
    }
    // "Tên: lời thoại"
    const dialogue = s.dialogue || "";
    const m = dialogue.match(/^([^:\n]{2,40})\s*:/);
    if (m?.[1]) set.add(m[1].trim());
  }
  return Array.from(set);
}

/** Trích tên nhân vật thô từ nội dung (pattern thường gặp) */
export function extractCharacterNamesFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const set = new Set<string>();
  // "Tên: " trên đầu dòng
  const nameColon = text.matchAll(/(?:^|\n)\s*([A-ZÀ-Ỹ][\wÀ-ỹ' ]{1,30})\s*:/g);
  for (const m of nameColon) {
    const n = m[1]?.trim();
    if (n && n.length >= 2 && n.length <= 40) set.add(n);
  }
  // Một số tên nổi tiếng (fallback demo) — bỏ nếu đã đủ
  return Array.from(set);
}

export function buildFilmCharactersFromNames(
  projectId: string,
  names: string[]
): FilmCharacterRecord[] {
  const now = new Date().toISOString();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  return unique.map((name, i) => ({
    id: createFilmId("ch"),
    projectId,
    name,
    role: DEFAULT_ROLES[Math.min(i, DEFAULT_ROLES.length - 1)],
    description: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmCharacterStatus,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function filmCharacterRoleLabel(role?: string): string {
  switch (role) {
    case "main":
      return "Main";
    case "antagonist":
      return "Antagonist";
    case "supporting":
      return "Supporting";
    case "extra":
      return "Extra";
    default:
      return role || "Supporting";
  }
}

const DEFAULT_PROP_CATEGORIES: FilmPropCategory[] = [
  "weapon",
  "container",
  "prop",
  "clothing",
  "other",
];

export function collectPropNamesFromScenes(scenes: FilmSceneRecord[]): string[] {
  const set = new Set<string>();
  for (const s of scenes) {
    for (const n of s.propNames || []) {
      const t = n.trim();
      if (t) set.add(t);
    }
  }
  return Array.from(set);
}

export function buildFilmPropsFromNames(
  projectId: string,
  names: string[],
  categories?: (FilmPropCategory | string)[]
): FilmPropRecord[] {
  const now = new Date().toISOString();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  return unique.map((name, i) => ({
    id: createFilmId("pr"),
    projectId,
    name,
    category: categories?.[i] || DEFAULT_PROP_CATEGORIES[Math.min(i, DEFAULT_PROP_CATEGORIES.length - 1)],
    description: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmPropStatus,
    locked: false,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function filmPropCategoryLabel(category?: string): string {
  switch (category) {
    case "weapon":
      return "Weapon";
    case "container":
      return "Container";
    case "prop":
      return "prop";
    case "clothing":
      return "Clothing";
    case "other":
      return "Other";
    default:
      return category || "prop";
  }
}

export function createEmptyFilmProp(projectId: string, index: number, name?: string): FilmPropRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("pr"),
    projectId,
    name: name || `Vật phẩm ${index}`,
    category: "prop",
    description: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending",
    locked: false,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  };
}

/** Gộp địa điểm từ scenes (unique theo location / tag / title) */
export function collectLocationsFromScenes(
  scenes: FilmSceneRecord[]
): { name: string; context: string }[] {
  const map = new Map<string, string>();
  for (const s of scenes) {
    const name = (s.location || s.sceneTag || s.title || "").trim();
    if (!name) continue;
    const ctx = (s.summary || s.action || s.visualDescription || "").trim().slice(0, 60);
    if (!map.has(name)) map.set(name, ctx || "Ngày");
  }
  return Array.from(map.entries()).map(([name, context]) => ({ name, context }));
}

export function buildFilmSceneImagesFromLocations(
  projectId: string,
  locations: { name: string; context?: string }[]
): FilmSceneImageRecord[] {
  const now = new Date().toISOString();
  return locations.map((loc, i) => ({
    id: createFilmId("loc"),
    projectId,
    name: loc.name,
    context: loc.context || "Ngày",
    description: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmSceneImageStatus,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function createEmptyFilmSceneImage(
  projectId: string,
  index: number,
  name?: string
): FilmSceneImageRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("loc"),
    projectId,
    name: name || `Cảnh ${index}`,
    context: "Ngày",
    description: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending",
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  };
}
