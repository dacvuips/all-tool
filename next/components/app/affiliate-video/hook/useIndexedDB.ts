/**
 * useIndexedDB.ts
 *
 * A generic, reusable hook for reading and writing typed data to the browser's
 * IndexedDB. Each "store" is an independent object-store inside its own database.
 *
 * Usage:
 *   const db = useIndexedDB<ScriptData>("affiliate-video-scripts", "my-db");
 *   await db.set("lastScript", myData);
 *   const data = await db.get("lastScript");
 *   await db.remove("lastScript");
 *   await db.clear();
 *   const all = await db.getAll();
 */

import { useCallback, useMemo, useRef } from "react";
import { DB_NAME_TYPE } from "../constants";

// ── Cache: one promise / live connection per dbName ──────────────────────────
const _dbCache = new Map<string, Promise<IDBDatabase>>();
const _liveConnections = new Map<string, IDBDatabase>();
/** Serialize open/upgrade per DB — tránh race khi nhiều store cùng DB. */
const _dbLocks = new Map<string, Promise<unknown>>();

function withDbLock<T>(dbName: string, fn: () => Promise<T>): Promise<T> {
  const prev = _dbLocks.get(dbName) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  _dbLocks.set(
    dbName,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

function trackConnection(dbName: string, db: IDBDatabase): void {
  const prev = _liveConnections.get(dbName);
  if (prev && prev !== db) {
    try {
      prev.close();
    } catch {
      // ignore
    }
  }
  _liveConnections.set(dbName, db);
  // Cho phép tab/request khác upgrade — đóng connection của mình khi version đổi
  db.onversionchange = () => {
    try {
      db.close();
    } catch {
      // ignore
    }
    if (_liveConnections.get(dbName) === db) {
      _liveConnections.delete(dbName);
    }
    _dbCache.delete(dbName);
  };
}

function closeLiveConnection(dbName: string): void {
  const db = _liveConnections.get(dbName);
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
    _liveConnections.delete(dbName);
  }
  _dbCache.delete(dbName);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openDBRequest(
  dbName: string,
  version?: number,
  onUpgrade?: (db: IDBDatabase) => void,
  options?: { timeoutMs?: number }
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version != null ? indexedDB.open(dbName, version) : indexedDB.open(dbName);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };

    const timer =
      options?.timeoutMs != null
        ? setTimeout(() => {
            finish(() => {
              closeLiveConnection(dbName);
              reject(
                new Error(
                  `[useIndexedDB] Database open timed out for "${dbName}" (likely blocked by another tab).`
                )
              );
            });
          }, options.timeoutMs)
        : undefined;

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      onUpgrade?.(db);
    };

    req.onsuccess = (e) => {
      finish(() => {
        const db = (e.target as IDBOpenDBRequest).result;
        trackConnection(dbName, db);
        resolve(db);
      });
    };

    req.onerror = (e) => {
      finish(() => {
        _dbCache.delete(dbName);
        reject((e.target as IDBOpenDBRequest).error ?? new Error("[useIndexedDB] open failed"));
      });
    };

    // Blocked: đóng connection local rồi chờ — KHÔNG reject ngay (thường do chính cache/tab này).
    req.onblocked = () => {
      console.warn(
        `[useIndexedDB] Database open blocked for "${dbName}" — closing live connections…`
      );
      closeLiveConnection(dbName);
    };
  });
}

/**
 * Open DB with the CURRENT version (no version = latest).
 * If the store doesn't exist yet, we'll upgrade in ensureStore.
 */
function openDB(dbName: DB_NAME_TYPE): Promise<IDBDatabase> {
  const cached = _dbCache.get(dbName);
  if (cached) return cached;

  const promise = openDBRequest(dbName).catch((err) => {
    _dbCache.delete(dbName);
    throw err;
  });

  _dbCache.set(dbName, promise);
  return promise;
}

/**
 * Ensures the object store exists. If the current DB version does not have the
 * store yet, we close & re-open with an incremented version so IDB runs
 * onupgradeneeded again.
 */
async function ensureStore(storeName: string, dbName: DB_NAME_TYPE): Promise<IDBDatabase> {
  return withDbLock(dbName, async () => {
    let db = await openDB(dbName);

    if (db.objectStoreNames.contains(storeName)) {
      return db;
    }

    const newVersion = db.version + 1;
    closeLiveConnection(dbName);

    // Retry upgrade vài lần nếu vẫn bị block (tab khác chưa kịp release).
    const maxAttempts = 5;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const upgradePromise = openDBRequest(
          dbName,
          newVersion,
          (upgraded) => {
            if (!upgraded.objectStoreNames.contains(storeName)) {
              upgraded.createObjectStore(storeName);
            }
          },
          { timeoutMs: 2500 }
        );
        _dbCache.set(dbName, upgradePromise);
        db = await upgradePromise;

        if (!db.objectStoreNames.contains(storeName)) {
          // Race với upgrade khác — thử lại
          closeLiveConnection(dbName);
          await sleep(50 * attempt);
          continue;
        }
        return db;
      } catch (err) {
        lastError = err;
        closeLiveConnection(dbName);
        await sleep(80 * attempt);
      }
    }

    throw (
      lastError ??
      new Error(
        `[useIndexedDB] Database upgrade blocked for "${dbName}". Close other tabs đang mở cùng app rồi thử lại.`
      )
    );
  });
}

// ── Low-level helpers ────────────────────────────────────────────────────────
function txPromise<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
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

function isRetryableIdbError(err: any): boolean {
  const msg = String(err?.message || "");
  return (
    err?.name === "InvalidStateError" ||
    err?.name === "VersionError" ||
    err?.name === "AbortError" ||
    msg.includes("closing") ||
    msg.includes("blocked") ||
    msg.includes("upgrade")
  );
}

/**
 * Wraps a DB operation with automatic retry on closed connection errors.
 */
async function withRetry<T>(
  storeName: string,
  dbName: DB_NAME_TYPE,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  try {
    const db = await ensureStore(storeName, dbName);
    return await txPromise<T>(db, storeName, mode, fn);
  } catch (err: any) {
    if (isRetryableIdbError(err)) {
      console.warn("[useIndexedDB] Connection issue, retrying...", dbName, storeName, err?.message);
      closeLiveConnection(dbName);
      const db = await ensureStore(storeName, dbName);
      return await txPromise<T>(db, storeName, mode, fn);
    }
    throw err;
  }
}

// ── Public hook ──────────────────────────────────────────────────────────────
export interface UseIndexedDBReturn<T> {
  /** Persist a value by key */
  set: (key: IDBValidKey, value: T) => Promise<void>;
  /** Retrieve a value by key (undefined if not found) */
  get: (key: IDBValidKey) => Promise<T | undefined>;
  /** Delete a single entry */
  remove: (key: IDBValidKey) => Promise<void>;
  /** Delete all entries in this store */
  clear: () => Promise<void>;
  /** Return all stored values */
  getAll: () => Promise<T[]>;
  /** Return all stored entries with their keys */
  getAllWithKeys: () => Promise<{ key: IDBValidKey; value: T }[]>;
}

/**
 * useIndexedDB<T>(storeName, dbName)
 *
 * Returns stable async helpers bound to the given object-store.
 * Safe to call at the top level of any component or hook – operations are
 * lazy (the DB is opened only on first call).
 */
export function useIndexedDB<T = unknown>(
  storeName: string,
  dbName: DB_NAME_TYPE
): UseIndexedDBReturn<T> {
  const storeRef = useRef(storeName);
  storeRef.current = storeName;

  const dbNameRef = useRef(dbName);
  dbNameRef.current = dbName;

  const set = useCallback(async (key: IDBValidKey, value: T): Promise<void> => {
    await withRetry<IDBValidKey>(storeRef.current, dbNameRef.current, "readwrite", (s) =>
      s.put(value, key)
    );
  }, []);

  const get = useCallback(async (key: IDBValidKey): Promise<T | undefined> => {
    try {
      return await withRetry<T>(storeRef.current, dbNameRef.current, "readonly", (s) => s.get(key));
    } catch {
      return undefined;
    }
  }, []);

  const remove = useCallback(async (key: IDBValidKey): Promise<void> => {
    await withRetry<undefined>(storeRef.current, dbNameRef.current, "readwrite", (s) =>
      s.delete(key)
    );
  }, []);

  const clear = useCallback(async (): Promise<void> => {
    await withRetry<undefined>(storeRef.current, dbNameRef.current, "readwrite", (s) => s.clear());
  }, []);

  const getAll = useCallback(async (): Promise<T[]> => {
    try {
      return await withRetry<T[]>(storeRef.current, dbNameRef.current, "readonly", (s) =>
        s.getAll()
      );
    } catch {
      return [];
    }
  }, []);

  const getAllWithKeys = useCallback(async (): Promise<{ key: IDBValidKey; value: T }[]> => {
    const storeName = storeRef.current;
    const dbName = dbNameRef.current;

    try {
      const keys = await withRetry<IDBValidKey[]>(storeName, dbName, "readonly", (s) =>
        s.getAllKeys()
      );
      const results: { key: IDBValidKey; value: T }[] = [];
      const unreadableKeys: IDBValidKey[] = [];

      for (const key of keys) {
        try {
          const value = await withRetry<T | undefined>(storeName, dbName, "readonly", (s) =>
            s.get(key)
          );
          if (value !== undefined) {
            results.push({ key, value });
          }
        } catch (err: unknown) {
          unreadableKeys.push(key);
          const name = err instanceof DOMException ? err.name : (err as Error)?.name;
          console.warn(
            `[useIndexedDB] Skipping unreadable record (${name})`,
            dbName,
            storeName,
            key,
            err
          );
        }
      }

      if (unreadableKeys.length > 0) {
        void Promise.all(
          unreadableKeys.map((key) =>
            withRetry<undefined>(storeName, dbName, "readwrite", (s) => s.delete(key)).catch(
              (delErr) =>
                console.warn(
                  "[useIndexedDB] Failed to remove unreadable record",
                  dbName,
                  storeName,
                  key,
                  delErr
                )
            )
          )
        );
      }

      return results;
    } catch {
      return [];
    }
  }, []);

  return useMemo(
    () => ({ set, get, remove, clear, getAll, getAllWithKeys }),
    [set, get, remove, clear, getAll, getAllWithKeys]
  );
}

/** Non-hook IDB client — dùng trong runner / storage module. */
export function openIndexedDBStore<T = unknown>(
  storeName: string,
  dbName: DB_NAME_TYPE
): UseIndexedDBReturn<T> {
  return {
    set: async (key, value) => {
      await withRetry<IDBValidKey>(storeName, dbName, "readwrite", (s) => s.put(value, key));
    },
    get: async (key) => {
      try {
        return await withRetry<T>(storeName, dbName, "readonly", (s) => s.get(key));
      } catch {
        return undefined;
      }
    },
    remove: async (key) => {
      await withRetry<undefined>(storeName, dbName, "readwrite", (s) => s.delete(key));
    },
    clear: async () => {
      await withRetry<undefined>(storeName, dbName, "readwrite", (s) => s.clear());
    },
    getAll: async () => {
      try {
        return await withRetry<T[]>(storeName, dbName, "readonly", (s) => s.getAll());
      } catch {
        return [];
      }
    },
    getAllWithKeys: async () => {
      try {
        const keys = await withRetry<IDBValidKey[]>(storeName, dbName, "readonly", (s) =>
          s.getAllKeys()
        );
        const results: { key: IDBValidKey; value: T }[] = [];
        for (const key of keys) {
          const value = await withRetry<T | undefined>(storeName, dbName, "readonly", (s) =>
            s.get(key)
          );
          if (value !== undefined) results.push({ key, value });
        }
        return results;
      } catch {
        return [];
      }
    },
  };
}
