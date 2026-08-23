/**
 * film-idb.ts
 *
 * IndexedDB layer riêng cho module Film.
 * Không dùng chung useIndexedDB / DB_NAME của affiliate-video hay video-affiliate-manager.
 *
 * DB name : film-short-projects  (FILM_DB_NAME)
 * Version : 6
 *
 * Stores
 * ─────────────────────────────────────────────────────────
 * projects     keyPath:id   indexes: byUpdatedAt, byCreatedAt
 * episodes     keyPath:id   indexes: byProjectId, byProjectIdIndex
 * characters   keyPath:id   indexes: byProjectId
 * props        keyPath:id   indexes: byProjectId
 * sceneImages  keyPath:id   indexes: byProjectId
 * scenes       keyPath:id   indexes: byProjectId, byEpisodeId, byEpisodeIdIndex
 * studioTimelines keyPath:episodeId  indexes: byProjectId
 * meta         no keyPath   (key/value settings)
 */

import {
  FILM_DB_NAME,
  FILM_DB_VERSION,
  FILM_PROJECTS_STORAGE_KEY,
  FILM_STORE,
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmMetaRecord,
  FilmProjectCreateInput,
  FilmProjectRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
  FilmStudioTimelineRecord,
  buildFilmEpisodesForProject,
  buildFilmProjectRecord,
  buildFilmScenesForEpisode,
  createFilmId,
  normalizeFilmNarration,
} from "./film-types";
import { formatFilmDialogueText } from "./film-dialogue";
import {
  isFilmCreateVideoScene,
  resetFilmStudioTimelineFromScratch,
} from "./film-studio-timeline";
import { buildFilmSceneImagePrompt } from "./film-scene-image-prompt";
import {
  buildFilmSceneAudioPrompt,
  buildFilmSceneVideoPrompt,
} from "./film-scene-video-prompt";
import {
  FILM_DEFAULT_LANGUAGE,
  FILM_DEFAULT_SYSTEM_INSTRUCTION,
  FILM_LANGUAGE_META_KEY,
  FILM_SYSTEM_INSTRUCTION_META_KEY,
  isFilmLanguageValue,
  type FilmLanguageValue,
} from "./film-screenplay-system-instruction";

// ── Open / upgrade ───────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

const REQUIRED_STORES = Object.values(FILM_STORE);

function assertBrowser(): void {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("[film-idb] IndexedDB unavailable");
  }
}

function createStoreWithIndexes(
  db: IDBDatabase,
  name: string,
  keyPath: string,
  indexes: { name: string; keyPath: string | string[]; unique?: boolean }[]
): void {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath });
  for (const idx of indexes) {
    store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
  }
}

function ensureFilmSchema(db: IDBDatabase): void {
  createStoreWithIndexes(db, FILM_STORE.projects, "id", [
    { name: "byUpdatedAt", keyPath: "updatedAt" },
    { name: "byCreatedAt", keyPath: "createdAt" },
  ]);

  createStoreWithIndexes(db, FILM_STORE.episodes, "id", [
    { name: "byProjectId", keyPath: "projectId" },
    { name: "byProjectIdIndex", keyPath: ["projectId", "index"], unique: true },
  ]);

  createStoreWithIndexes(db, FILM_STORE.characters, "id", [
    { name: "byProjectId", keyPath: "projectId" },
  ]);

  createStoreWithIndexes(db, FILM_STORE.props, "id", [
    { name: "byProjectId", keyPath: "projectId" },
  ]);

  createStoreWithIndexes(db, FILM_STORE.sceneImages, "id", [
    { name: "byProjectId", keyPath: "projectId" },
  ]);

  createStoreWithIndexes(db, FILM_STORE.scenes, "id", [
    { name: "byProjectId", keyPath: "projectId" },
    { name: "byEpisodeId", keyPath: "episodeId" },
    { name: "byEpisodeIdIndex", keyPath: ["episodeId", "index"], unique: true },
  ]);

  createStoreWithIndexes(db, FILM_STORE.studioTimelines, "episodeId", [
    { name: "byProjectId", keyPath: "projectId" },
  ]);

  if (!db.objectStoreNames.contains(FILM_STORE.meta)) {
    db.createObjectStore(FILM_STORE.meta);
  }
}

function hasRequiredStores(db: IDBDatabase): boolean {
  return REQUIRED_STORES.every((name) => db.objectStoreNames.contains(name));
}

function isDbUsable(db: IDBDatabase): boolean {
  try {
    if (!hasRequiredStores(db)) return false;
    // Chỉ tạo transaction — connection đã đóng sẽ throw InvalidStateError
    db.transaction(FILM_STORE.projects, "readonly");
    return true;
  } catch {
    return false;
  }
}

function resetFilmDBCache(db?: IDBDatabase | null): void {
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
}

function openFilmDBOnce(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILM_DB_NAME, FILM_DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      ensureFilmSchema(db);
      console.info(
        `[film-idb] upgraded ${event.oldVersion} → ${FILM_DB_VERSION}`,
        "stores:",
        Array.from(db.objectStoreNames)
      );
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        resetFilmDBCache(db);
      };

      if (!hasRequiredStores(db)) {
        console.error(
          "[film-idb] Missing object stores after open. Expected:",
          REQUIRED_STORES,
          "got:",
          Array.from(db.objectStoreNames)
        );
        try {
          db.close();
        } catch {
          // ignore
        }
        reject(
          new Error(
            "[film-idb] schema incomplete — đóng mọi tab Film rồi reload trang (upgrade IndexedDB)"
          )
        );
        return;
      }

      resolve(db);
    };

    req.onerror = () => {
      reject(req.error ?? new Error("[film-idb] open failed"));
    };

    req.onblocked = () => {
      console.warn(
        "[film-idb] open blocked — đóng tab khác đang dùng DB film (film-short-projects) rồi thử lại"
      );
    };
  });
}

export function openFilmDB(): Promise<IDBDatabase> {
  assertBrowser();

  if (dbPromise) {
    return dbPromise.then((db) => {
      if (isDbUsable(db)) return db;
      resetFilmDBCache(db);
      return openFilmDB();
    });
  }

  dbPromise = openFilmDBOnce().catch((err) => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Xóa mọi bản ghi có `projectId` khớp — dùng index byProjectId trong cùng transaction. */
function deleteStoreRowsByProjectId(
  store: IDBObjectStore,
  projectId: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!store.indexNames.contains("byProjectId")) {
      resolve(0);
      return;
    }
    let deleted = 0;
    const req = store.index("byProjectId").openCursor(IDBKeyRange.only(projectId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(deleted);
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("[film-idb] transaction error"));
    tx.onabort = () => reject(tx.error || new Error("[film-idb] transaction aborted"));
  });
}

async function withStoreRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  retried = false
): Promise<T> {
  try {
    const db = await openFilmDB();
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`[film-idb] missing store: ${storeName}`);
    }
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await reqPromise(fn(store));
    await txComplete(tx);
    return result;
  } catch (err) {
    if (!retried) {
      resetFilmDBCache();
      return withStoreRequest(storeName, mode, fn, true);
    }
    throw err;
  }
}

async function getByIndexAll<T>(
  storeName: string,
  indexName: string,
  key: IDBValidKey,
  retried = false
): Promise<T[]> {
  try {
    const db = await openFilmDB();
    if (!db.objectStoreNames.contains(storeName)) {
      return [];
    }
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    if (!store.indexNames.contains(indexName)) {
      console.warn(`[film-idb] missing index ${indexName} on ${storeName}`);
      return [];
    }
    const rows = await reqPromise(store.index(indexName).getAll(key));
    await txComplete(tx);
    return (rows as T[]) || [];
  } catch (err) {
    if (!retried) {
      resetFilmDBCache();
      return getByIndexAll(storeName, indexName, key, true);
    }
    throw err;
  }
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function listFilmProjects(): Promise<FilmProjectRecord[]> {
  const rows = await withStoreRequest<FilmProjectRecord[]>(FILM_STORE.projects, "readonly", (s) =>
    s.getAll()
  );
  return (rows || []).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getFilmProject(id: string): Promise<FilmProjectRecord | undefined> {
  if (!id) return undefined;
  return withStoreRequest(FILM_STORE.projects, "readonly", (s) => s.get(id));
}

export async function putFilmProject(project: FilmProjectRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.projects, "readwrite", (s) => s.put(project));
}

/**
 * Cập nhật metadata dự án (không xoá episodes/scenes đã có).
 */
export async function updateFilmProject(
  id: string,
  input: FilmProjectCreateInput
): Promise<FilmProjectRecord> {
  const existing = await getFilmProject(id);
  if (!existing) {
    throw new Error(`[film-idb] Project not found: ${id}`);
  }

  const episodeCount = Math.max(1, input.episodeCount || 1);
  const sceneCount =
    input.scenesPerEpisode != null
      ? episodeCount * input.scenesPerEpisode
      : existing.sceneCount;

  const updated: FilmProjectRecord = {
    ...existing,
    name: input.name.trim(),
    episodeCount,
    scenesPerEpisode: input.scenesPerEpisode,
    artStyleId: input.artStyleId || "",
    artStyleLabel: input.artStyleLabel || "",
    aspectRatio: input.aspectRatio,
    narration: normalizeFilmNarration(input.narration),
    sceneCount,
    updatedAt: new Date().toISOString(),
  };

  await putFilmProject(updated);
  return updated;
}

/** Cập nhật artStyleId / artStyleLabel dự án ngay khi đổi phong cách. */
export async function updateFilmProjectArtStyle(
  id: string,
  artStyleId: string,
  artStyleLabel: string
): Promise<FilmProjectRecord> {
  const existing = await getFilmProject(id);
  if (!existing) {
    throw new Error(`[film-idb] Project not found: ${id}`);
  }

  const nextId = String(artStyleId || "").trim();
  const nextLabel = nextId ? String(artStyleLabel || "").trim() : "";

  if (existing.artStyleId === nextId && (existing.artStyleLabel || "") === nextLabel) {
    return existing;
  }

  const updated: FilmProjectRecord = {
    ...existing,
    artStyleId: nextId,
    artStyleLabel: nextLabel,
    updatedAt: new Date().toISOString(),
  };

  await putFilmProject(updated);
  return updated;
}

export type FilmProjectImagePromptTemplatesInput = {
  characterImagePromptTemplate: string;
  propImagePromptTemplate: string;
  locationImagePromptTemplate: string;
};

/**
 * Lưu prompt mẫu Nhân vật / Vật phẩm / Bối cảnh theo dự án.
 * Chuỗi rỗng hoặc trùng mặc định → xoá custom (fallback template code).
 */
export async function updateFilmProjectImagePromptTemplates(
  id: string,
  input: FilmProjectImagePromptTemplatesInput,
  defaults: {
    character: string;
    prop: string;
    location: string;
  }
): Promise<FilmProjectRecord> {
  const existing = await getFilmProject(id);
  if (!existing) {
    throw new Error(`[film-idb] Project not found: ${id}`);
  }

  const normalize = (value: string, fallback: string): string | undefined => {
    const next = String(value ?? "").trim();
    if (!next) return undefined;
    if (next === fallback.trim()) return undefined;
    return next;
  };

  const updated: FilmProjectRecord = {
    ...existing,
    characterImagePromptTemplate: normalize(
      input.characterImagePromptTemplate,
      defaults.character
    ),
    propImagePromptTemplate: normalize(input.propImagePromptTemplate, defaults.prop),
    locationImagePromptTemplate: normalize(
      input.locationImagePromptTemplate,
      defaults.location
    ),
    updatedAt: new Date().toISOString(),
  };

  await putFilmProject(updated);
  return updated;
}

export type FilmProjectStoryboardPromptsInput = {
  storyboardImagePrompt: string;
  storyboardVideoPrompt: string;
  storyboardAudioPrompt: string;
};

/**
 * Lưu prompt storyboard chung + (nếu field có giá trị) ghi sang mọi scene của dự án.
 */
export async function updateFilmProjectStoryboardPrompts(
  id: string,
  input: FilmProjectStoryboardPromptsInput
): Promise<{ project: FilmProjectRecord; updatedScenes: FilmSceneRecord[] }> {
  const existing = await getFilmProject(id);
  if (!existing) {
    throw new Error(`[film-idb] Project not found: ${id}`);
  }

  const image = String(input.storyboardImagePrompt ?? "").trim();
  const video = String(input.storyboardVideoPrompt ?? "").trim();
  const audio = String(input.storyboardAudioPrompt ?? "").trim();
  const now = new Date().toISOString();

  const project: FilmProjectRecord = {
    ...existing,
    storyboardImagePrompt: image || undefined,
    storyboardVideoPrompt: video || undefined,
    storyboardAudioPrompt: audio || undefined,
    updatedAt: now,
  };
  await putFilmProject(project);

  const scenes = await getFilmScenesByProject(id);
  const updatedScenes: FilmSceneRecord[] = [];
  if (image || video || audio) {
    for (const s of scenes) {
      let changed = false;
      const next: FilmSceneRecord = { ...s, updatedAt: now };
      // Prompt ảnh = ngữ nghĩa scene + style Setting (không đè một chuỗi giống nhau)
      const builtImage = image
        ? buildFilmSceneImagePrompt(s, image)
        : next.imagePrompt;
      if (image && !next.imagePromptCustom && builtImage && next.imagePrompt !== builtImage) {
        next.imagePrompt = builtImage;
        changed = true;
      }
      // Prompt video = Cỡ cảnh / Góc máy / Lia máy / thoại + style Setting
      const builtVideo = video
        ? buildFilmSceneVideoPrompt(s, video)
        : next.videoPrompt;
      if (video && !next.videoPromptCustom && builtVideo && next.videoPrompt !== builtVideo) {
        next.videoPrompt = builtVideo;
        changed = true;
      } else if (video && !next.videoPromptCustom && !builtVideo && next.videoPrompt !== video) {
        next.videoPrompt = video;
        changed = true;
      }
      const builtAudio = buildFilmSceneAudioPrompt(s, audio || undefined);
      if (builtAudio && !next.audioPromptCustom && next.audioPrompt !== builtAudio) {
        next.audioPrompt = builtAudio;
        changed = true;
      } else if (audio && !next.audioPromptCustom && !builtAudio && next.audioPrompt !== audio) {
        next.audioPrompt = audio;
        changed = true;
      }
      if (!changed) continue;
      await putFilmScene(next);
      updatedScenes.push(next);
    }
  }

  return { project, updatedScenes };
}

/**
 * Xóa dự án và toàn bộ dữ liệu liên quan:
 * episodes, scenes, characters, props, sceneImages, studioTimelines
 * (blob ảnh/video/voice nằm trong các record → bị dọn theo).
 */
export async function deleteFilmProject(id: string): Promise<void> {
  const episodes = await getFilmEpisodesByProject(id).catch(() => [] as FilmEpisodeRecord[]);

  const db = await openFilmDB();
  const storeNames = [
    FILM_STORE.projects,
    FILM_STORE.episodes,
    FILM_STORE.characters,
    FILM_STORE.props,
    FILM_STORE.sceneImages,
    FILM_STORE.scenes,
    FILM_STORE.studioTimelines,
  ].filter((name) => db.objectStoreNames.contains(name));

  const tx = db.transaction(storeNames, "readwrite");

  if (db.objectStoreNames.contains(FILM_STORE.projects)) {
    tx.objectStore(FILM_STORE.projects).delete(id);
  }

  // Cursor theo byProjectId — dọn hết kể cả bản ghi orphan (ảnh/video/voice blob theo record)
  for (const storeName of [
    FILM_STORE.episodes,
    FILM_STORE.characters,
    FILM_STORE.props,
    FILM_STORE.sceneImages,
    FILM_STORE.scenes,
    FILM_STORE.studioTimelines,
  ] as const) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    await deleteStoreRowsByProjectId(tx.objectStore(storeName), id);
  }

  // Studio timeline keyPath = episodeId — xóa thêm theo id tập phòng khi thiếu/sai projectId
  if (db.objectStoreNames.contains(FILM_STORE.studioTimelines)) {
    const tlStore = tx.objectStore(FILM_STORE.studioTimelines);
    for (const ep of episodes) {
      tlStore.delete(ep.id);
    }
  }

  await txComplete(tx);
}

/**
 * Tạo project + scaffold episodes/scenes mặc định trong 1 transaction.
 */
export async function createFilmProject(
  input: FilmProjectCreateInput
): Promise<FilmProjectRecord> {
  const project = buildFilmProjectRecord(input);
  const episodes = buildFilmEpisodesForProject(project);
  const scenes = episodes.flatMap((ep) => buildFilmScenesForEpisode(project.id, ep));

  project.sceneCount = scenes.length;
  project.characterCount = 0;

  const db = await openFilmDB();
  const tx = db.transaction(
    [FILM_STORE.projects, FILM_STORE.episodes, FILM_STORE.scenes],
    "readwrite"
  );

  tx.objectStore(FILM_STORE.projects).put(project);
  const epStore = tx.objectStore(FILM_STORE.episodes);
  for (const ep of episodes) epStore.put(ep);
  const scStore = tx.objectStore(FILM_STORE.scenes);
  for (const sc of scenes) scStore.put(sc);

  await txComplete(tx);
  return project;
}

// ── Episodes ─────────────────────────────────────────────────────────────────

export async function getFilmEpisodesByProject(projectId: string): Promise<FilmEpisodeRecord[]> {
  const rows = await getByIndexAll<FilmEpisodeRecord>(
    FILM_STORE.episodes,
    "byProjectId",
    projectId
  );
  return rows.sort((a, b) => a.index - b.index);
}

export async function putFilmEpisode(episode: FilmEpisodeRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.episodes, "readwrite", (s) => s.put(episode));
}

function defaultEpisodeTitle(index: number): string {
  return `Tập ${index}`;
}

function isDefaultEpisodeTitle(title: string, index: number): boolean {
  const trimmed = title.trim();
  return trimmed === defaultEpisodeTitle(index) || trimmed === `Episode ${index}`;
}

function tagEpisodeIdsOnAdd(
  entityEpisodeIds: string[] | undefined,
  oldEpisodeIds: string[],
  newEpisodeId: string
): string[] | undefined {
  if (!entityEpisodeIds?.length) {
    return [...oldEpisodeIds, newEpisodeId];
  }
  const hadAll = oldEpisodeIds.every((id) => entityEpisodeIds.includes(id));
  if (!hadAll) return entityEpisodeIds;
  return [...entityEpisodeIds, newEpisodeId];
}

function tagEpisodeIdsOnDelete(
  entityEpisodeIds: string[] | undefined,
  episodeId: string
): string[] | undefined {
  if (!entityEpisodeIds?.length) return entityEpisodeIds;
  const next = entityEpisodeIds.filter((id) => id !== episodeId);
  return next.length ? next : undefined;
}

export type FilmEpisodeMutationResult = {
  episodes: FilmEpisodeRecord[];
  project: FilmProjectRecord;
  characters: FilmCharacterRecord[];
  props: FilmPropRecord[];
  sceneImages: FilmSceneImageRecord[];
};

/** Thêm tập mới — scaffold scenes mặc định, cập nhật project + entity episodeIds */
export async function addFilmEpisode(projectId: string): Promise<
  FilmEpisodeMutationResult & {
    addedEpisode: FilmEpisodeRecord;
    addedScenes: FilmSceneRecord[];
  }
> {
  const project = await getFilmProject(projectId);
  if (!project) {
    throw new Error(`[film-idb] Project not found: ${projectId}`);
  }

  const existing = await getFilmEpisodesByProject(projectId);
  const oldEpisodeIds = existing.map((ep) => ep.id);
  const nextIndex = existing.length + 1;
  const now = new Date().toISOString();
  const scenesPerEp =
    project.scenesPerEpisode ??
    Math.max(1, Math.ceil((project.sceneCount || 0) / Math.max(1, project.episodeCount)) || 3);

  const addedEpisode: FilmEpisodeRecord = {
    id: createFilmId("ep"),
    projectId,
    index: nextIndex,
    title: defaultEpisodeTitle(nextIndex),
    status: "draft",
    sceneCount: scenesPerEp,
    originalContent: "",
    createdAt: now,
    updatedAt: now,
  };
  const addedScenes = buildFilmScenesForEpisode(projectId, addedEpisode);
  const updatedProject: FilmProjectRecord = {
    ...project,
    episodeCount: nextIndex,
    sceneCount: (project.sceneCount || 0) + addedScenes.length,
    updatedAt: now,
  };

  const [characters, props, sceneImages] = await Promise.all([
    getFilmCharactersByProject(projectId).catch(() => [] as FilmCharacterRecord[]),
    getFilmPropsByProject(projectId).catch(() => [] as FilmPropRecord[]),
    getFilmSceneImagesByProject(projectId).catch(() => [] as FilmSceneImageRecord[]),
  ]);

  const nextCharacters = characters.map((c) => {
    const episodeIds = tagEpisodeIdsOnAdd(c.episodeIds, oldEpisodeIds, addedEpisode.id);
    if (episodeIds === c.episodeIds) return c;
    return { ...c, episodeIds, updatedAt: now };
  });
  const nextProps = props.map((p) => {
    const episodeIds = tagEpisodeIdsOnAdd(p.episodeIds, oldEpisodeIds, addedEpisode.id);
    if (episodeIds === p.episodeIds) return p;
    return { ...p, episodeIds, updatedAt: now };
  });
  const nextSceneImages = sceneImages.map((loc) => {
    const episodeIds = tagEpisodeIdsOnAdd(loc.episodeIds, oldEpisodeIds, addedEpisode.id);
    if (episodeIds === loc.episodeIds) return loc;
    return { ...loc, episodeIds, updatedAt: now };
  });

  const db = await openFilmDB();
  const storeNames = [
    FILM_STORE.projects,
    FILM_STORE.episodes,
    FILM_STORE.scenes,
    FILM_STORE.characters,
    FILM_STORE.props,
    FILM_STORE.sceneImages,
  ].filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(storeNames, "readwrite");

  tx.objectStore(FILM_STORE.projects).put(updatedProject);
  tx.objectStore(FILM_STORE.episodes).put(addedEpisode);
  const sceneStore = tx.objectStore(FILM_STORE.scenes);
  for (const sc of addedScenes) sceneStore.put(sc);

  if (db.objectStoreNames.contains(FILM_STORE.characters)) {
    const chStore = tx.objectStore(FILM_STORE.characters);
    for (const ch of nextCharacters) {
      if (ch.updatedAt === now) chStore.put(ch);
    }
  }
  if (db.objectStoreNames.contains(FILM_STORE.props)) {
    const propStore = tx.objectStore(FILM_STORE.props);
    for (const p of nextProps) {
      if (p.updatedAt === now) propStore.put(p);
    }
  }
  if (db.objectStoreNames.contains(FILM_STORE.sceneImages)) {
    const locStore = tx.objectStore(FILM_STORE.sceneImages);
    for (const loc of nextSceneImages) {
      if (loc.updatedAt === now) locStore.put(loc);
    }
  }

  await txComplete(tx);

  return {
    episodes: [...existing, addedEpisode],
    project: updatedProject,
    characters: nextCharacters,
    props: nextProps,
    sceneImages: nextSceneImages,
    addedEpisode,
    addedScenes,
  };
}

/** Xóa tập — không cho xóa tập cuối cùng; reindex các tập còn lại */
export async function deleteFilmEpisode(
  projectId: string,
  episodeId: string
): Promise<FilmEpisodeMutationResult> {
  const project = await getFilmProject(projectId);
  if (!project) {
    throw new Error(`[film-idb] Project not found: ${projectId}`);
  }

  const existing = await getFilmEpisodesByProject(projectId);
  if (existing.length <= 1) {
    throw new Error("[film-idb] Cannot delete the last episode");
  }
  const target = existing.find((ep) => ep.id === episodeId);
  if (!target) {
    throw new Error(`[film-idb] Episode not found: ${episodeId}`);
  }

  const scenes = await getFilmScenesByEpisode(episodeId);
  const now = new Date().toISOString();
  const remaining = existing
    .filter((ep) => ep.id !== episodeId)
    .sort((a, b) => a.index - b.index)
    .map((ep, i) => {
      const nextIndex = i + 1;
      const title = isDefaultEpisodeTitle(ep.title, ep.index)
        ? defaultEpisodeTitle(nextIndex)
        : ep.title;
      return {
        ...ep,
        index: nextIndex,
        title,
        updatedAt: now,
      };
    });

  const updatedProject: FilmProjectRecord = {
    ...project,
    episodeCount: remaining.length,
    sceneCount: Math.max(0, (project.sceneCount || 0) - scenes.length),
    updatedAt: now,
  };

  const [characters, props, sceneImages] = await Promise.all([
    getFilmCharactersByProject(projectId).catch(() => [] as FilmCharacterRecord[]),
    getFilmPropsByProject(projectId).catch(() => [] as FilmPropRecord[]),
    getFilmSceneImagesByProject(projectId).catch(() => [] as FilmSceneImageRecord[]),
  ]);

  const nextCharacters = characters.map((c) => {
    const episodeIds = tagEpisodeIdsOnDelete(c.episodeIds, episodeId);
    if (episodeIds === c.episodeIds) return c;
    return { ...c, episodeIds, updatedAt: now };
  });
  const nextProps = props.map((p) => {
    const episodeIds = tagEpisodeIdsOnDelete(p.episodeIds, episodeId);
    if (episodeIds === p.episodeIds) return p;
    return { ...p, episodeIds, updatedAt: now };
  });
  const nextSceneImages = sceneImages.map((loc) => {
    const episodeIds = tagEpisodeIdsOnDelete(loc.episodeIds, episodeId);
    if (episodeIds === loc.episodeIds) return loc;
    return { ...loc, episodeIds, updatedAt: now };
  });

  const db = await openFilmDB();
  const storeNames = [
    FILM_STORE.projects,
    FILM_STORE.episodes,
    FILM_STORE.scenes,
    FILM_STORE.characters,
    FILM_STORE.props,
    FILM_STORE.sceneImages,
    FILM_STORE.studioTimelines,
  ].filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(storeNames, "readwrite");

  tx.objectStore(FILM_STORE.projects).put(updatedProject);
  const epStore = tx.objectStore(FILM_STORE.episodes);
  epStore.delete(episodeId);
  for (const ep of remaining) epStore.put(ep);

  const sceneStore = tx.objectStore(FILM_STORE.scenes);
  for (const sc of scenes) sceneStore.delete(sc.id);

  if (db.objectStoreNames.contains(FILM_STORE.characters)) {
    const chStore = tx.objectStore(FILM_STORE.characters);
    for (const ch of nextCharacters) {
      if (ch.updatedAt === now) chStore.put(ch);
    }
  }
  if (db.objectStoreNames.contains(FILM_STORE.props)) {
    const propStore = tx.objectStore(FILM_STORE.props);
    for (const p of nextProps) {
      if (p.updatedAt === now) propStore.put(p);
    }
  }
  if (db.objectStoreNames.contains(FILM_STORE.sceneImages)) {
    const locStore = tx.objectStore(FILM_STORE.sceneImages);
    for (const loc of nextSceneImages) {
      if (loc.updatedAt === now) locStore.put(loc);
    }
  }
  if (db.objectStoreNames.contains(FILM_STORE.studioTimelines)) {
    tx.objectStore(FILM_STORE.studioTimelines).delete(episodeId);
  }

  await txComplete(tx);

  return {
    episodes: remaining,
    project: updatedProject,
    characters: nextCharacters,
    props: nextProps,
    sceneImages: nextSceneImages,
  };
}

export async function getFilmEpisode(id: string): Promise<FilmEpisodeRecord | undefined> {
  return withStoreRequest(FILM_STORE.episodes, "readonly", (s) => s.get(id));
}

/** Lưu nội dung gốc của 1 tập */
export async function saveFilmEpisodeOriginalContent(
  episodeId: string,
  originalContent: string
): Promise<FilmEpisodeRecord> {
  const existing = await getFilmEpisode(episodeId);
  if (!existing) {
    throw new Error(`[film-idb] Episode not found: ${episodeId}`);
  }
  const updated: FilmEpisodeRecord = {
    ...existing,
    originalContent,
    updatedAt: new Date().toISOString(),
  };
  await putFilmEpisode(updated);
  return updated;
}

export async function updateFilmEpisodeOriginalContent(
  episodeId: string,
  originalContent: string
): Promise<FilmEpisodeRecord> {
  const db = await openFilmDB();
  const tx = db.transaction(FILM_STORE.episodes, "readwrite");
  const store = tx.objectStore(FILM_STORE.episodes);
  const existing = await reqPromise(store.get(episodeId) as IDBRequest<FilmEpisodeRecord | undefined>);
  if (!existing) {
    throw new Error(`[film-idb] Episode not found: ${episodeId}`);
  }
  const updated: FilmEpisodeRecord = {
    ...existing,
    originalContent,
    updatedAt: new Date().toISOString(),
  };
  store.put(updated);
  await txComplete(tx);
  return updated;
}

export async function touchFilmProject(projectId: string): Promise<void> {
  const project = await getFilmProject(projectId);
  if (!project) return;
  await putFilmProject({
    ...project,
    updatedAt: new Date().toISOString(),
  });
}

// ── Characters ───────────────────────────────────────────────────────────────

export async function getFilmCharactersByProject(
  projectId: string
): Promise<FilmCharacterRecord[]> {
  const rows = await getByIndexAll<FilmCharacterRecord>(
    FILM_STORE.characters,
    "byProjectId",
    projectId
  );
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function putFilmCharacter(character: FilmCharacterRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.characters, "readwrite", (s) => s.put(character));
}

export async function deleteFilmCharacter(id: string): Promise<void> {
  await withStoreRequest(FILM_STORE.characters, "readwrite", (s) => s.delete(id));
}

/** Thay toàn bộ characters của project */
export async function replaceFilmCharactersForProject(
  projectId: string,
  characters: FilmCharacterRecord[]
): Promise<FilmCharacterRecord[]> {
  const existing = await getFilmCharactersByProject(projectId);
  const now = new Date().toISOString();
  const normalized = characters.map((c, i) => ({
    ...c,
    projectId,
    sortOrder: i,
    updatedAt: now,
  }));

  const project = await getFilmProject(projectId);
  const db = await openFilmDB();
  const tx = db.transaction([FILM_STORE.characters, FILM_STORE.projects], "readwrite");

  const chStore = tx.objectStore(FILM_STORE.characters);
  for (const old of existing) {
    chStore.delete(old.id);
  }
  for (const c of normalized) {
    chStore.put(c);
  }

  if (project) {
    tx.objectStore(FILM_STORE.projects).put({
      ...project,
      characterCount: normalized.length,
      updatedAt: now,
    });
  }

  await txComplete(tx);
  return normalized;
}

// ── Props (vật phẩm) ─────────────────────────────────────────────────────────

export async function getFilmPropsByProject(projectId: string): Promise<FilmPropRecord[]> {
  const rows = await getByIndexAll<FilmPropRecord>(FILM_STORE.props, "byProjectId", projectId);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function putFilmProp(prop: FilmPropRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.props, "readwrite", (s) => s.put(prop));
}

export async function deleteFilmProp(id: string): Promise<void> {
  await withStoreRequest(FILM_STORE.props, "readwrite", (s) => s.delete(id));
}

export async function replaceFilmPropsForProject(
  projectId: string,
  props: FilmPropRecord[]
): Promise<FilmPropRecord[]> {
  const existing = await getFilmPropsByProject(projectId);
  const now = new Date().toISOString();
  const normalized = props.map((p, i) => ({
    ...p,
    projectId,
    sortOrder: i,
    updatedAt: now,
  }));

  const db = await openFilmDB();
  const tx = db.transaction(FILM_STORE.props, "readwrite");
  const store = tx.objectStore(FILM_STORE.props);
  for (const old of existing) {
    store.delete(old.id);
  }
  for (const p of normalized) {
    store.put(p);
  }
  await txComplete(tx);
  return normalized;
}

// ── Scene images (Ảnh Cảnh / bối cảnh) ───────────────────────────────────────

export async function getFilmSceneImagesByProject(
  projectId: string
): Promise<FilmSceneImageRecord[]> {
  const rows = await getByIndexAll<FilmSceneImageRecord>(
    FILM_STORE.sceneImages,
    "byProjectId",
    projectId
  );
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function putFilmSceneImage(item: FilmSceneImageRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.sceneImages, "readwrite", (s) => s.put(item));
}

export async function deleteFilmSceneImage(id: string): Promise<void> {
  await withStoreRequest(FILM_STORE.sceneImages, "readwrite", (s) => s.delete(id));
}

export async function replaceFilmSceneImagesForProject(
  projectId: string,
  items: FilmSceneImageRecord[]
): Promise<FilmSceneImageRecord[]> {
  const existing = await getFilmSceneImagesByProject(projectId);
  const now = new Date().toISOString();
  const normalized = items.map((p, i) => ({
    ...p,
    projectId,
    sortOrder: i,
    updatedAt: now,
  }));

  const db = await openFilmDB();
  const tx = db.transaction(FILM_STORE.sceneImages, "readwrite");
  const store = tx.objectStore(FILM_STORE.sceneImages);
  for (const old of existing) {
    store.delete(old.id);
  }
  for (const p of normalized) {
    store.put(p);
  }
  await txComplete(tx);
  return normalized;
}

// ── Scenes ───────────────────────────────────────────────────────────────────

export async function getFilmScenesByProject(projectId: string): Promise<FilmSceneRecord[]> {
  const rows = await getByIndexAll<FilmSceneRecord>(FILM_STORE.scenes, "byProjectId", projectId);
  return rows.sort((a, b) => a.index - b.index);
}

export async function getFilmScenesByEpisode(episodeId: string): Promise<FilmSceneRecord[]> {
  const rows = await getByIndexAll<FilmSceneRecord>(FILM_STORE.scenes, "byEpisodeId", episodeId);
  return rows.sort((a, b) => a.index - b.index);
}

export async function putFilmScene(scene: FilmSceneRecord): Promise<void> {
  await withStoreRequest(FILM_STORE.scenes, "readwrite", (s) => s.put(scene));
}

// ── Studio timelines (per episode, isolated from scenes) ─────────────────────

export async function getFilmStudioTimeline(
  episodeId: string
): Promise<FilmStudioTimelineRecord | null> {
  const row = await withStoreRequest<FilmStudioTimelineRecord | undefined>(
    FILM_STORE.studioTimelines,
    "readonly",
    (s) => s.get(episodeId)
  );
  return row || null;
}

export async function putFilmStudioTimeline(
  record: FilmStudioTimelineRecord
): Promise<FilmStudioTimelineRecord> {
  const next: FilmStudioTimelineRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await withStoreRequest(FILM_STORE.studioTimelines, "readwrite", (s) => s.put(next));
  return next;
}

export async function deleteFilmStudioTimeline(episodeId: string): Promise<void> {
  await withStoreRequest(FILM_STORE.studioTimelines, "readwrite", (s) => s.delete(episodeId));
}

/** Clone nông scenes để Studio edit — không chia sẻ mảng dialogueLines với bản gốc. */
export function cloneFilmScenesForStudio(scenes: FilmSceneRecord[]): FilmSceneRecord[] {
  return scenes.map((s) => ({
    ...s,
    dialogueLines: (s.dialogueLines || []).map((l) => ({ ...l })),
    videoRefSlots: s.videoRefSlots
      ? s.videoRefSlots.map((slot) => (slot ? { ...slot } : null))
      : undefined,
  }));
}

/**
 * Gỡ artifact Studio khỏi store `scenes` gốc (studioDerived + studioOnly lines).
 * Trả về danh sách scenes gốc đã sạch.
 */
export async function purgeStudioArtifactsFromEpisodeScenes(
  projectId: string,
  episodeId: string
): Promise<FilmSceneRecord[]> {
  const existing = await getFilmScenesByEpisode(episodeId);
  const needsPurge = existing.some(
    (s) =>
      !!s.studioDerived || (s.dialogueLines || []).some((l) => !!l.studioOnly)
  );
  const base = existing.filter((s) => !s.studioDerived);
  if (!needsPurge) {
    return base.filter(isFilmCreateVideoScene);
  }

  const cleaned = base.map((s) => {
    const lines = (s.dialogueLines || [])
      .filter((l) => !l.studioOnly)
      .map((l) => {
        const next = { ...l };
        delete next.studioOnly;
        return next;
      });
    const { studioDerived: _drop, ...rest } = s;
    return {
      ...rest,
      dialogueLines: lines,
      dialogue: formatFilmDialogueText(lines) || s.dialogue,
    };
  });

  const saved = await replaceFilmScenesForEpisode(projectId, episodeId, cleaned);
  return saved.filter(isFilmCreateVideoScene);
}

/**
 * Load / seed timeline Studio cho tập.
 * Chỉ đọc scenes gốc để seed lần đầu — không ghi ngược vào scenes.
 */
export async function loadOrSeedFilmStudioTimeline(
  projectId: string,
  episodeId: string,
  sourceScenes: FilmSceneRecord[]
): Promise<FilmStudioTimelineRecord> {
  const existing = await getFilmStudioTimeline(episodeId);
  if (existing?.scenes?.length) {
    return existing;
  }
  const seed = resetFilmStudioTimelineFromScratch(
    cloneFilmScenesForStudio(sourceScenes.filter(isFilmCreateVideoScene))
  );
  return putFilmStudioTimeline({
    episodeId,
    projectId,
    scenes: seed,
    updatedAt: new Date().toISOString(),
  });
}

/** Xoá toàn bộ scene của episode rồi ghi danh sách mới; cập nhật denormalized counts */
export async function replaceFilmScenesForEpisode(
  projectId: string,
  episodeId: string,
  scenes: FilmSceneRecord[]
): Promise<FilmSceneRecord[]> {
  const [existing, episode, project] = await Promise.all([
    getFilmScenesByEpisode(episodeId),
    getFilmEpisode(episodeId),
    getFilmProject(projectId),
  ]);

  const now = new Date().toISOString();
  const normalized = scenes.map((s, i) => ({
    ...s,
    projectId,
    episodeId,
    index: i + 1,
    updatedAt: now,
  }));

  const db = await openFilmDB();
  const tx = db.transaction(
    [FILM_STORE.scenes, FILM_STORE.episodes, FILM_STORE.projects],
    "readwrite"
  );

  const sceneStore = tx.objectStore(FILM_STORE.scenes);
  for (const old of existing) {
    sceneStore.delete(old.id);
  }
  for (const sc of normalized) {
    sceneStore.put(sc);
  }

  if (episode) {
    tx.objectStore(FILM_STORE.episodes).put({
      ...episode,
      sceneCount: normalized.length,
      updatedAt: now,
    });
  }

  if (project) {
    const delta = normalized.length - existing.length;
    tx.objectStore(FILM_STORE.projects).put({
      ...project,
      sceneCount: Math.max(0, (project.sceneCount || 0) + delta),
      updatedAt: now,
    });
  }

  await txComplete(tx);
  return normalized;
}

export async function addFilmScene(scene: FilmSceneRecord): Promise<FilmSceneRecord> {
  const rows = await getFilmScenesByEpisode(scene.episodeId);
  const next: FilmSceneRecord = {
    ...scene,
    index: rows.length + 1,
    updatedAt: new Date().toISOString(),
  };
  await putFilmScene(next);

  const episode = await getFilmEpisode(scene.episodeId);
  if (episode) {
    await putFilmEpisode({
      ...episode,
      sceneCount: rows.length + 1,
      updatedAt: next.updatedAt,
    });
  }

  const project = await getFilmProject(scene.projectId);
  if (project) {
    await putFilmProject({
      ...project,
      sceneCount: (project.sceneCount || 0) + 1,
      updatedAt: next.updatedAt,
    });
  }

  return next;
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export async function getFilmMeta<T = unknown>(key: string): Promise<T | undefined> {
  const row = await withStoreRequest<FilmMetaRecord | undefined>(FILM_STORE.meta, "readonly", (s) =>
    s.get(key)
  );
  return row?.value as T | undefined;
}

export async function setFilmMeta(key: string, value: unknown): Promise<void> {
  const record: FilmMetaRecord = { value, updatedAt: new Date().toISOString() };
  await withStoreRequest(FILM_STORE.meta, "readwrite", (s) => s.put(record, key));
}

// ── System instruction (screenplay) ──────────────────────────────────────────

/** Đọc systemInstruction đã lưu; fallback về template mặc định. */
export async function getFilmSystemInstruction(): Promise<string> {
  const saved = await getFilmMeta<string>(FILM_SYSTEM_INSTRUCTION_META_KEY);
  if (typeof saved === "string" && saved.trim()) return saved;
  return FILM_DEFAULT_SYSTEM_INSTRUCTION;
}

/** Lưu systemInstruction (chuỗi rỗng → xóa để fallback default). */
export async function setFilmSystemInstruction(value: string): Promise<void> {
  const next = String(value ?? "").trim();
  if (!next) {
    await setFilmMeta(FILM_SYSTEM_INSTRUCTION_META_KEY, "");
    return;
  }
  await setFilmMeta(FILM_SYSTEM_INSTRUCTION_META_KEY, next);
}

/** Đọc ngôn ngữ output screenplay; fallback Vietnamese. */
export async function getFilmOutputLanguage(): Promise<FilmLanguageValue> {
  const saved = await getFilmMeta<string>(FILM_LANGUAGE_META_KEY);
  if (typeof saved === "string" && isFilmLanguageValue(saved)) return saved;
  return FILM_DEFAULT_LANGUAGE;
}

/** Lưu ngôn ngữ output screenplay. */
export async function setFilmOutputLanguage(value: string): Promise<FilmLanguageValue> {
  const next = isFilmLanguageValue(value) ? value : FILM_DEFAULT_LANGUAGE;
  await setFilmMeta(FILM_LANGUAGE_META_KEY, next);
  return next;
}

// ── Migrate legacy localStorage → IndexedDB (1 lần) ──────────────────────────

const MIGRATION_META_KEY = "migrated_from_localStorage_v1";
/** Migrate: tách clip Studio khỏi scenes → studioTimelines */
const STUDIO_ISOLATION_META_KEY = "migrated_studio_isolation_v6";

function readLegacyLocalProjects(): FilmProjectRecord[] {
  try {
    const raw = localStorage.getItem(FILM_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
      .map((p) => {
        const legacy = p as Partial<FilmProjectRecord> & { artStyleId?: string };
        return {
          id: legacy.id!,
          name: legacy.name!,
          episodeCount: legacy.episodeCount ?? 1,
          scenesPerEpisode: legacy.scenesPerEpisode,
          artStyleId: legacy.artStyleId ?? "",
          artStyleLabel: legacy.artStyleLabel ?? "",
          aspectRatio: legacy.aspectRatio === "9:16" ? "9:16" : "16:9",
          narration: normalizeFilmNarration(legacy.narration),
          progress: typeof legacy.progress === "number" ? legacy.progress : 5,
          characterCount: legacy.characterCount ?? 0,
          sceneCount: legacy.sceneCount ?? 0,
          createdAt: legacy.createdAt || new Date().toISOString(),
          updatedAt: legacy.updatedAt || new Date().toISOString(),
        } satisfies FilmProjectRecord;
      });
  } catch {
    return [];
  }
}

/**
 * Mọi episode: chuyển studioDerived sang studioTimelines (nếu chưa có), rồi purge scenes gốc.
 */
export async function migrateFilmStudioIsolation(): Promise<void> {
  const done = await getFilmMeta<boolean>(STUDIO_ISOLATION_META_KEY);
  if (done) return;

  const episodes = await withStoreRequest<FilmEpisodeRecord[]>(
    FILM_STORE.episodes,
    "readonly",
    (s) => s.getAll()
  );

  for (const ep of episodes || []) {
    if (!ep?.id || !ep.projectId) continue;
    try {
      const all = await getFilmScenesByEpisode(ep.id);
      const derived = all.filter((s) => !!s.studioDerived);
      const source = all.filter((s) => !s.studioDerived);
      const existingTl = await getFilmStudioTimeline(ep.id);

      if (!existingTl?.scenes?.length) {
        const seedScenes =
          derived.length > 0
            ? cloneFilmScenesForStudio(
                [...source, ...derived].sort((a, b) => a.index - b.index)
              )
            : resetFilmStudioTimelineFromScratch(cloneFilmScenesForStudio(source));
        await putFilmStudioTimeline({
          episodeId: ep.id,
          projectId: ep.projectId,
          scenes: seedScenes,
          updatedAt: new Date().toISOString(),
        });
      }

      await purgeStudioArtifactsFromEpisodeScenes(ep.projectId, ep.id);
    } catch (err) {
      console.warn("[film-idb] studio isolation migrate episode failed:", ep.id, err);
    }
  }

  await setFilmMeta(STUDIO_ISOLATION_META_KEY, true);
  console.info("[film-idb] migrated studio isolation v6");
}

/**
 * Mở DB + migrate schema/data. Gọi 1 lần khi load trang Film.
 */
export async function initFilmDB(): Promise<void> {
  await openFilmDB();

  try {
    await migrateFilmStudioIsolation();
  } catch (err) {
    console.warn("[film-idb] studio isolation migrate failed:", err);
  }

  const migrated = await getFilmMeta<boolean>(MIGRATION_META_KEY);
  if (migrated) return;

  const legacy = readLegacyLocalProjects();
  if (legacy.length > 0) {
    const db = await openFilmDB();
    const tx = db.transaction(FILM_STORE.projects, "readwrite");
    const store = tx.objectStore(FILM_STORE.projects);
    for (const p of legacy) {
      store.put(p);
    }
    await txComplete(tx);
    try {
      localStorage.removeItem(FILM_PROJECTS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  await setFilmMeta(MIGRATION_META_KEY, true);
}
