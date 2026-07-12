/**
 * IndexedDB for video-affiliate-plus.
 * Database: video-affiliate-manager
 * - generate-video-config
 * - product-videos (link → enrich base64; key = mã sản phẩm)
 * - merged-videos (legacy Blob — fallback đọc)
 * - import-history (phiên import / làm việc)
 */

export const VIDEO_AFFILIATE_MANAGER_DB = "video-affiliate-manager";
const DB_VERSION = 4;
const STORE_CONFIG = "generate-video-config";
const STORE_PRODUCT_VIDEOS = "product-videos";
const STORE_MERGED_VIDEOS = "merged-videos";
const STORE_IMPORT_HISTORY = "import-history";
const CONFIG_KEY = "config";
const IMPORT_HISTORY_KEY = "list";
const SELECTED_HISTORY_KEY = "selectedId";

/** Bản ghi video theo mã sản phẩm — giống pattern affiliate-video (link → base64). */
export type ProductVideoRecord = {
  productId: string;
  /** Link gốc từ Flow2 */
  videoUris: string[];
  /** base64 từng variant (null = chưa enrich) */
  videoBytesList: Array<string | null>;
  mimeType: string;
  /** base64 video đã nối (null = chưa có) */
  mergedVideoBytes: string | null;
  updatedAt: number;
};

/** @deprecated Legacy blob store */
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
      if (!db.objectStoreNames.contains(STORE_PRODUCT_VIDEOS)) {
        db.createObjectStore(STORE_PRODUCT_VIDEOS, { keyPath: "productId" });
      }
      if (!db.objectStoreNames.contains(STORE_MERGED_VIDEOS)) {
        db.createObjectStore(STORE_MERGED_VIDEOS, { keyPath: "itemId" });
      }
      if (!db.objectStoreNames.contains(STORE_IMPORT_HISTORY)) {
        db.createObjectStore(STORE_IMPORT_HISTORY);
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

export async function idbPutProductVideo(record: ProductVideoRecord): Promise<void> {
  await withStore(STORE_PRODUCT_VIDEOS, "readwrite", (s) => s.put(record));
}

export async function idbGetProductVideo(
  productId: string
): Promise<ProductVideoRecord | undefined> {
  try {
    return await withStore<ProductVideoRecord | undefined>(
      STORE_PRODUCT_VIDEOS,
      "readonly",
      (s) => s.get(productId) as IDBRequest<ProductVideoRecord | undefined>
    );
  } catch (err) {
    console.warn("[video-affiliate-manager] get product video failed", err);
    return undefined;
  }
}

export async function idbDeleteProductVideo(productId: string): Promise<void> {
  try {
    await withStore(STORE_PRODUCT_VIDEOS, "readwrite", (s) => s.delete(productId));
  } catch (err) {
    console.warn("[video-affiliate-manager] delete product video failed", err);
  }
}

/** @deprecated */
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

/** @deprecated */
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

export async function idbGetMergedVideoObjectUrl(itemId: string): Promise<string | ""> {
  const rec = await idbGetMergedVideo(itemId);
  if (!rec?.blob) return "";
  return URL.createObjectURL(rec.blob);
}

export async function idbGetImportHistoryList<T>(): Promise<T[]> {
  try {
    const list = await withStore<T[] | undefined>(
      STORE_IMPORT_HISTORY,
      "readonly",
      (s) => s.get(IMPORT_HISTORY_KEY) as IDBRequest<T[] | undefined>
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[video-affiliate-manager] get import history failed", err);
    return [];
  }
}

export async function idbSetImportHistoryList<T>(list: T[]): Promise<void> {
  await withStore(STORE_IMPORT_HISTORY, "readwrite", (s) => s.put(list, IMPORT_HISTORY_KEY));
}

export async function idbClearImportHistory(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_IMPORT_HISTORY, "readwrite");
      const store = tx.objectStore(STORE_IMPORT_HISTORY);
      store.delete(IMPORT_HISTORY_KEY);
      store.delete(SELECTED_HISTORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function idbGetSelectedImportHistoryId(): Promise<string | null> {
  try {
    const id = await withStore<string | undefined>(
      STORE_IMPORT_HISTORY,
      "readonly",
      (s) => s.get(SELECTED_HISTORY_KEY) as IDBRequest<string | undefined>
    );
    return id || null;
  } catch {
    return null;
  }
}

export async function idbSetSelectedImportHistoryId(id: string | null): Promise<void> {
  if (!id) {
    await withStore(STORE_IMPORT_HISTORY, "readwrite", (s) => s.delete(SELECTED_HISTORY_KEY));
    return;
  }
  await withStore(STORE_IMPORT_HISTORY, "readwrite", (s) => s.put(id, SELECTED_HISTORY_KEY));
}
