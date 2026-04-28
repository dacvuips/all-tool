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

import { useCallback, useRef } from "react";
import { DB_NAME_TYPE } from "../../constants";

// ── Cache: one promise per dbName ────────────────────────────────────────────
const _dbCache = new Map<string, Promise<IDBDatabase>>();

/**
 * Open DB with the CURRENT version (no version = latest).
 * If the store doesn't exist yet, we'll upgrade in ensureStore.
 */
function openDB(dbName: DB_NAME_TYPE): Promise<IDBDatabase> {
  const cached = _dbCache.get(dbName);
  if (cached) return cached;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    // Open WITHOUT version → uses current/latest version
    const req = indexedDB.open(dbName);

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => {
      _dbCache.delete(dbName);
      reject((e.target as IDBOpenDBRequest).error);
    };
    req.onblocked = () => {
      _dbCache.delete(dbName);
      reject(new Error("[useIndexedDB] Database blocked. Close other tabs."));
    };
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
  let db = await openDB(dbName);

  if (!db.objectStoreNames.contains(storeName)) {
    // Need to upgrade – bump version by 1
    const newVersion = db.version + 1;
    db.close();
    _dbCache.delete(dbName);

    const upgradePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, newVersion);

      req.onupgradeneeded = (e) => {
        const upgraded = (e.target as IDBOpenDBRequest).result;
        if (!upgraded.objectStoreNames.contains(storeName)) {
          upgraded.createObjectStore(storeName);
        }
      };

      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = (e) => {
        _dbCache.delete(dbName);
        reject((e.target as IDBOpenDBRequest).error);
      };
      req.onblocked = () => {
        _dbCache.delete(dbName);
        reject(new Error("[useIndexedDB] Database upgrade blocked. Close other tabs."));
      };
    });

    _dbCache.set(dbName, upgradePromise);
    db = await upgradePromise;
  }

  return db;
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
    // If the connection was closed or version mismatch, clear cache and retry once
    if (
      err?.name === "InvalidStateError" ||
      err?.name === "VersionError" ||
      err?.message?.includes("closing")
    ) {
      console.warn("[useIndexedDB] Connection issue, retrying...", dbName, storeName, err?.message);
      _dbCache.delete(dbName);
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
    try {
      const db = await ensureStore(storeRef.current, dbNameRef.current);
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(storeRef.current, "readonly");
          const store = tx.objectStore(storeRef.current);
          const req = store.openCursor();
          const results: { key: IDBValidKey; value: T }[] = [];
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              results.push({ key: cursor.key, value: cursor.value });
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          req.onerror = () => reject(req.error);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch {
      return [];
    }
  }, []);

  return { set, get, remove, clear, getAll, getAllWithKeys };
}
