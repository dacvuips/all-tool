/**
 * film-idb.ts
 *
 * IndexedDB layer riêng cho module Film.
 * Không dùng chung useIndexedDB / DB_NAME của affiliate-video hay video-affiliate-manager.
 *
 * DB name : film-short-projects  (FILM_DB_NAME)
 * Version : 4
 *
 * Stores
 * ─────────────────────────────────────────────────────────
 * projects     keyPath:id   indexes: byUpdatedAt, byCreatedAt
 * episodes     keyPath:id   indexes: byProjectId, byProjectIdIndex
 * characters   keyPath:id   indexes: byProjectId
 * props        keyPath:id   indexes: byProjectId
 * sceneImages  keyPath:id   indexes: byProjectId
 * scenes       keyPath:id   indexes: byProjectId, byEpisodeId, byEpisodeIdIndex
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
  buildFilmEpisodesForProject,
  buildFilmProjectRecord,
  buildFilmScenesForEpisode,
} from "./film-types";

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

    req.onupgradeneeded = () => {
      ensureFilmSchema(req.result);
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
        reject(new Error("[film-idb] schema incomplete"));
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
    narration: input.narration,
    sceneCount,
    updatedAt: new Date().toISOString(),
  };

  await putFilmProject(updated);
  return updated;
}

export async function deleteFilmProject(id: string): Promise<void> {
  const [episodes, characters, scenes, props, sceneImages] = await Promise.all([
    getFilmEpisodesByProject(id).catch(() => [] as FilmEpisodeRecord[]),
    getFilmCharactersByProject(id).catch(() => [] as FilmCharacterRecord[]),
    getFilmScenesByProject(id).catch(() => [] as FilmSceneRecord[]),
    getFilmPropsByProject(id).catch(() => [] as FilmPropRecord[]),
    getFilmSceneImagesByProject(id).catch(() => [] as FilmSceneImageRecord[]),
  ]);

  const db = await openFilmDB();
  const storeNames = [
    FILM_STORE.projects,
    FILM_STORE.episodes,
    FILM_STORE.characters,
    FILM_STORE.props,
    FILM_STORE.sceneImages,
    FILM_STORE.scenes,
  ].filter((name) => db.objectStoreNames.contains(name));

  const tx = db.transaction(storeNames, "readwrite");

  if (db.objectStoreNames.contains(FILM_STORE.projects)) {
    tx.objectStore(FILM_STORE.projects).delete(id);
  }
  if (db.objectStoreNames.contains(FILM_STORE.episodes)) {
    const epStore = tx.objectStore(FILM_STORE.episodes);
    for (const ep of episodes) epStore.delete(ep.id);
  }
  if (db.objectStoreNames.contains(FILM_STORE.characters)) {
    const chStore = tx.objectStore(FILM_STORE.characters);
    for (const ch of characters) chStore.delete(ch.id);
  }
  if (db.objectStoreNames.contains(FILM_STORE.props)) {
    const prStore = tx.objectStore(FILM_STORE.props);
    for (const pr of props) prStore.delete(pr.id);
  }
  if (db.objectStoreNames.contains(FILM_STORE.sceneImages)) {
    const locStore = tx.objectStore(FILM_STORE.sceneImages);
    for (const loc of sceneImages) locStore.delete(loc.id);
  }
  if (db.objectStoreNames.contains(FILM_STORE.scenes)) {
    const scStore = tx.objectStore(FILM_STORE.scenes);
    for (const sc of scenes) scStore.delete(sc.id);
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

// ── Migrate legacy localStorage → IndexedDB (1 lần) ──────────────────────────

const MIGRATION_META_KEY = "migrated_from_localStorage_v1";

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
          narration: legacy.narration === "third_person" ? "third_person" : "dialogue",
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
 * Mở DB + migrate localStorage cũ (nếu có). Gọi 1 lần khi load trang Film.
 */
export async function initFilmDB(): Promise<void> {
  await openFilmDB();

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
