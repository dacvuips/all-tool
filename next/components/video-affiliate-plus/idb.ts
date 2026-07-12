/**
 * IndexedDB for video-affiliate-plus.
 * Database: video-affiliate-manager
 * - generate-video-config
 * - merged-videos (Blob theo itemId)
 */

export const VIDEO_AFFILIATE_MANAGER_DB = "video-affiliate-manager";
const DB_VERSION = 2;
const STORE_CONFIG = "generate-video-config";
const STORE_MERGED_VIDEOS = "merged-videos";
const CONFIG_KEY = "config";

export type MergedVideoRecord = {
  itemId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEO_AFFILIATE_MANAGER_DB, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG);
      }
      if (!db.objectStoreNames.contains(STORE_MERGED_VIDEOS)) {
        db.createObjectStore(STORE_MERGED_VIDEOS, { keyPath: "itemId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error("[video-affiliate-manager] Database blocked"));
    };
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function idbGetConfig<T>(): Promise<T | undefined> {
  try {
    return await withStore<T>(STORE_CONFIG, "readonly", (s) => s.get(CONFIG_KEY) as IDBRequest<T>);
  } catch (err) {
    console.warn("[video-affiliate-manager] read failed", err);
    return undefined;
  }
}

export async function idbSetConfig<T>(value: T): Promise<void> {
  await withStore(STORE_CONFIG, "readwrite", (s) => s.put(value, CONFIG_KEY));
}

export async function idbClearConfig(): Promise<void> {
  await withStore(STORE_CONFIG, "readwrite", (s) => s.delete(CONFIG_KEY));
}

export async function idbPutMergedVideo(
  itemId: string,
  blob: Blob,
  mimeType = "video/mp4"
): Promise<void> {
  const record: MergedVideoRecord = {
    itemId,
    blob,
    mimeType,
    updatedAt: Date.now(),
  };
  await withStore(STORE_MERGED_VIDEOS, "readwrite", (s) => s.put(record));
}

export async function idbGetMergedVideo(itemId: string): Promise<MergedVideoRecord | undefined> {
  try {
    return await withStore<MergedVideoRecord | undefined>(
      STORE_MERGED_VIDEOS,
      "readonly",
      (s) => s.get(itemId) as IDBRequest<MergedVideoRecord | undefined>
    );
  } catch (err) {
    console.warn("[video-affiliate-manager] get merged video failed", err);
    return undefined;
  }
}

export async function idbDeleteMergedVideo(itemId: string): Promise<void> {
  try {
    await withStore(STORE_MERGED_VIDEOS, "readwrite", (s) => s.delete(itemId));
  } catch (err) {
    console.warn("[video-affiliate-manager] delete merged video failed", err);
  }
}

/** Tạo object URL từ blob đã lưu; caller revoke khi không dùng. */
export async function idbGetMergedVideoObjectUrl(itemId: string): Promise<string | ""> {
  const rec = await idbGetMergedVideo(itemId);
  if (!rec?.blob) return "";
  return URL.createObjectURL(rec.blob);
}
