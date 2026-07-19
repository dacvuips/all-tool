/**
 * IndexedDB for video-affiliate-plus.
 * Database: video-affiliate-manager
 * - generate-video-config
 * - product-videos (link → enrich base64; key = mã sản phẩm)
 * - merged-videos (legacy Blob — fallback đọc)
 * - import-history (phiên import / làm việc)
 * - scrape-csv-sessions (CSV do extension gửi)
 * - threads (per-item record; source of truth cho lazy list)
 * - thread-meta (aggregate stats theo sessionId)
 * - users (danh sách tài khoản + item Generate đã gắn)
 * - proxies (danh sách proxy host:port:user:pass)
 * - upload-history (phiên Đăng video Shope)
 * - cookie-fetch-history (lịch sử lấy / gắn cookie)
 */

export const VIDEO_AFFILIATE_MANAGER_DB = "video-affiliate-manager";
const DB_VERSION = 10;
const STORE_CONFIG = "generate-video-config";
const STORE_PRODUCT_VIDEOS = "product-videos";
const STORE_MERGED_VIDEOS = "merged-videos";
const STORE_IMPORT_HISTORY = "import-history";
const STORE_SCRAPE_CSV = "scrape-csv-sessions";
const STORE_THREADS = "threads";
const STORE_THREAD_META = "thread-meta";
const STORE_USERS = "users";
const STORE_PROXIES = "proxies";
const STORE_UPLOAD_HISTORY = "upload-history";
const STORE_COOKIE_FETCH_HISTORY = "cookie-fetch-history";
const CONFIG_KEY = "config";
const IMPORT_HISTORY_KEY = "list";
const SELECTED_HISTORY_KEY = "selectedId";
const USERS_LIST_KEY = "list";
const PROXIES_LIST_KEY = "list";
const UPLOAD_HISTORY_KEY = "list";
const SELECTED_UPLOAD_HISTORY_KEY = "selectedId";
const COOKIE_FETCH_HISTORY_KEY = "list";

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

/** CSV phiên cào từ extension — ID riêng trong DB video-affiliate-manager. */
export type ScrapeCsvSessionRecord = {
  id: string;
  createdAt: number;
  keyword: string;
  marketHost: string;
  marketCode?: string;
  productCount: number;
  csv: string;
  durationMs: number;
};

/** Bản ghi 1 luồng (thread) trong 1 session — source of truth cho lazy list. */
export type ThreadRecord = {
  /** Item id */
  id: string;
  /** Session (= importHistory id hoặc `default`) */
  sessionId: string;
  /** Chuỗi đã normalize cho tìm kiếm: `shopName + " " + productName` */
  searchKey: string;
  /** Timestamp tạo (giữ ổn định — thứ tự import / hiển thị / generate) */
  createdAt?: number;
  /** Timestamp update cuối */
  updatedAt: number;
  /** Toàn bộ AffiliatePlusItem (media nặng vẫn ở product-videos) */
  data: Record<string, unknown>;
};

/** Aggregate stats cho từng session. */
export type ThreadMetaRecord = {
  sessionId: string;
  total: number;
  waiting: number;
  uploading: number;
  success: number;
  error: number;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let openedDbVersion = 0;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (dbPromise && openedDbVersion === DB_VERSION) return dbPromise;

  openedDbVersion = DB_VERSION;
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
      if (!db.objectStoreNames.contains(STORE_SCRAPE_CSV)) {
        db.createObjectStore(STORE_SCRAPE_CSV, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_THREADS)) {
        const store = db.createObjectStore(STORE_THREADS, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      } else {
        // Upgrade path — đảm bảo index tồn tại (best effort)
        try {
          const tx = req.transaction;
          const existing = tx?.objectStore(STORE_THREADS);
          if (existing && !existing.indexNames.contains("sessionId")) {
            existing.createIndex("sessionId", "sessionId", { unique: false });
          }
        } catch {
          // ignore
        }
      }
      if (!db.objectStoreNames.contains(STORE_THREAD_META)) {
        db.createObjectStore(STORE_THREAD_META, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS);
      }
      if (!db.objectStoreNames.contains(STORE_PROXIES)) {
        db.createObjectStore(STORE_PROXIES);
      }
      if (!db.objectStoreNames.contains(STORE_UPLOAD_HISTORY)) {
        db.createObjectStore(STORE_UPLOAD_HISTORY);
      }
      if (!db.objectStoreNames.contains(STORE_COOKIE_FETCH_HISTORY)) {
        db.createObjectStore(STORE_COOKIE_FETCH_HISTORY);
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

export async function idbGetScrapeCsvSessions(): Promise<ScrapeCsvSessionRecord[]> {
  try {
    const db = await openDB();
    return await new Promise<ScrapeCsvSessionRecord[]>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_SCRAPE_CSV, "readonly");
        const store = tx.objectStore(STORE_SCRAPE_CSV);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn("[video-affiliate-manager] get scrape csv sessions failed", err);
    return [];
  }
}

export async function idbPutScrapeCsvSession(record: ScrapeCsvSessionRecord): Promise<void> {
  await withStore(STORE_SCRAPE_CSV, "readwrite", (s) => s.put(record));
}

export async function idbDeleteScrapeCsvSession(id: string): Promise<void> {
  await withStore(STORE_SCRAPE_CSV, "readwrite", (s) => s.delete(id));
}

export async function idbClearScrapeCsvSessions(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_SCRAPE_CSV, "readwrite");
      tx.objectStore(STORE_SCRAPE_CSV).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/** ==================== THREADS ==================== */

/** Lấy 1 thread record theo id. */
export async function idbGetThread(id: string): Promise<ThreadRecord | undefined> {
  try {
    return await withStore<ThreadRecord | undefined>(
      STORE_THREADS,
      "readonly",
      (s) => s.get(id) as IDBRequest<ThreadRecord | undefined>
    );
  } catch (err) {
    console.warn("[video-affiliate-manager] get thread failed", err);
    return undefined;
  }
}

/** Put 1 thread record. */
export async function idbPutThread(rec: ThreadRecord): Promise<void> {
  await withStore(STORE_THREADS, "readwrite", (s) => s.put(rec));
}

/** Bulk put nhiều thread trong 1 transaction. */
export async function idbBulkPutThreads(records: ThreadRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_THREADS, "readwrite");
      const store = tx.objectStore(STORE_THREADS);
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/** Xóa 1 thread theo id. */
export async function idbDeleteThread(id: string): Promise<void> {
  try {
    await withStore(STORE_THREADS, "readwrite", (s) => s.delete(id));
  } catch (err) {
    console.warn("[video-affiliate-manager] delete thread failed", err);
  }
}

/** Xóa nhiều thread trong 1 transaction. */
export async function idbBulkDeleteThreads(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_THREADS, "readwrite");
      const store = tx.objectStore(STORE_THREADS);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/** Lấy tất cả thread của một session (dùng cho hydrate hoặc export). */
export async function idbGetThreadsBySession(sessionId: string): Promise<ThreadRecord[]> {
  if (!sessionId) return [];
  try {
    const db = await openDB();
    return await new Promise<ThreadRecord[]>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_THREADS, "readonly");
        const store = tx.objectStore(STORE_THREADS);
        const index = store.index("sessionId");
        const req = index.getAll(IDBKeyRange.only(sessionId));
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn("[video-affiliate-manager] get threads by session failed", err);
    return [];
  }
}

/** Xóa toàn bộ thread của một session. */
export async function idbClearThreadsBySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_THREADS, "readwrite");
      const store = tx.objectStore(STORE_THREADS);
      const index = store.index("sessionId");
      const req = index.openCursor(IDBKeyRange.only(sessionId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/** Đếm số thread trong session (không match search). */
export async function idbCountThreadsBySession(sessionId: string): Promise<number> {
  if (!sessionId) return 0;
  try {
    const db = await openDB();
    return await new Promise<number>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_THREADS, "readonly");
        const index = tx.objectStore(STORE_THREADS).index("sessionId");
        const req = index.count(IDBKeyRange.only(sessionId));
        req.onsuccess = () => resolve(Number(req.result) || 0);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn("[video-affiliate-manager] count threads by session failed", err);
    return 0;
  }
}

/** ==================== THREAD META ==================== */

export async function idbGetThreadMeta(
  sessionId: string
): Promise<ThreadMetaRecord | undefined> {
  if (!sessionId) return undefined;
  try {
    return await withStore<ThreadMetaRecord | undefined>(
      STORE_THREAD_META,
      "readonly",
      (s) => s.get(sessionId) as IDBRequest<ThreadMetaRecord | undefined>
    );
  } catch (err) {
    console.warn("[video-affiliate-manager] get thread meta failed", err);
    return undefined;
  }
}

export async function idbPutThreadMeta(rec: ThreadMetaRecord): Promise<void> {
  await withStore(STORE_THREAD_META, "readwrite", (s) => s.put(rec));
}

export async function idbDeleteThreadMeta(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await withStore(STORE_THREAD_META, "readwrite", (s) => s.delete(sessionId));
  } catch (err) {
    console.warn("[video-affiliate-manager] delete thread meta failed", err);
  }
}

/** ==================== USERS ==================== */

export async function idbGetUsersList<T>(): Promise<T[]> {
  try {
    const list = await withStore<T[] | undefined>(
      STORE_USERS,
      "readonly",
      (s) => s.get(USERS_LIST_KEY) as IDBRequest<T[] | undefined>
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[video-affiliate-manager] get users failed", err);
    return [];
  }
}

export async function idbSetUsersList<T>(list: T[]): Promise<void> {
  await withStore(STORE_USERS, "readwrite", (s) => s.put(list, USERS_LIST_KEY));
}

export async function idbClearUsersList(): Promise<void> {
  try {
    await withStore(STORE_USERS, "readwrite", (s) => s.delete(USERS_LIST_KEY));
  } catch (err) {
    console.warn("[video-affiliate-manager] clear users failed", err);
  }
}

/** ==================== PROXIES ==================== */

export async function idbGetProxiesList<T>(): Promise<T[]> {
  try {
    const list = await withStore<T[] | undefined>(
      STORE_PROXIES,
      "readonly",
      (s) => s.get(PROXIES_LIST_KEY) as IDBRequest<T[] | undefined>
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[video-affiliate-manager] get proxies failed", err);
    return [];
  }
}

export async function idbSetProxiesList<T>(list: T[]): Promise<void> {
  await withStore(STORE_PROXIES, "readwrite", (s) => s.put(list, PROXIES_LIST_KEY));
}

export async function idbClearProxiesList(): Promise<void> {
  try {
    await withStore(STORE_PROXIES, "readwrite", (s) => s.delete(PROXIES_LIST_KEY));
  } catch (err) {
    console.warn("[video-affiliate-manager] clear proxies failed", err);
  }
}

/** ==================== UPLOAD HISTORY (Đăng video Shope) ==================== */

export async function idbGetUploadHistoryList<T>(): Promise<T[]> {
  try {
    const list = await withStore<T[] | undefined>(
      STORE_UPLOAD_HISTORY,
      "readonly",
      (s) => s.get(UPLOAD_HISTORY_KEY) as IDBRequest<T[] | undefined>
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[video-affiliate-manager] get upload history failed", err);
    return [];
  }
}

export async function idbSetUploadHistoryList<T>(list: T[]): Promise<void> {
  await withStore(STORE_UPLOAD_HISTORY, "readwrite", (s) => s.put(list, UPLOAD_HISTORY_KEY));
}

export async function idbClearUploadHistory(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_UPLOAD_HISTORY, "readwrite");
    const store = tx.objectStore(STORE_UPLOAD_HISTORY);
    store.delete(UPLOAD_HISTORY_KEY);
    store.delete(SELECTED_UPLOAD_HISTORY_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[video-affiliate-manager] clear upload history failed", err);
  }
}

export async function idbGetSelectedUploadHistoryId(): Promise<string | null> {
  try {
    const id = await withStore<string | undefined>(
      STORE_UPLOAD_HISTORY,
      "readonly",
      (s) => s.get(SELECTED_UPLOAD_HISTORY_KEY) as IDBRequest<string | undefined>
    );
    return id ? String(id) : null;
  } catch (err) {
    console.warn("[video-affiliate-manager] get selected upload history failed", err);
    return null;
  }
}

export async function idbSetSelectedUploadHistoryId(id: string | null): Promise<void> {
  if (!id) {
    await withStore(STORE_UPLOAD_HISTORY, "readwrite", (s) =>
      s.delete(SELECTED_UPLOAD_HISTORY_KEY)
    );
    return;
  }
  await withStore(STORE_UPLOAD_HISTORY, "readwrite", (s) =>
    s.put(id, SELECTED_UPLOAD_HISTORY_KEY)
  );
}

/** ==================== COOKIE FETCH HISTORY ==================== */

export async function idbGetCookieFetchHistoryList<T>(): Promise<T[]> {
  try {
    const list = await withStore<T[] | undefined>(
      STORE_COOKIE_FETCH_HISTORY,
      "readonly",
      (s) => s.get(COOKIE_FETCH_HISTORY_KEY) as IDBRequest<T[] | undefined>
    );
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[video-affiliate-manager] get cookie-fetch history failed", err);
    return [];
  }
}

export async function idbSetCookieFetchHistoryList<T>(list: T[]): Promise<void> {
  await withStore(STORE_COOKIE_FETCH_HISTORY, "readwrite", (s) =>
    s.put(list, COOKIE_FETCH_HISTORY_KEY)
  );
}

export async function idbClearCookieFetchHistory(): Promise<void> {
  try {
    await withStore(STORE_COOKIE_FETCH_HISTORY, "readwrite", (s) =>
      s.delete(COOKIE_FETCH_HISTORY_KEY)
    );
  } catch (err) {
    console.warn("[video-affiliate-manager] clear cookie-fetch history failed", err);
  }
}
