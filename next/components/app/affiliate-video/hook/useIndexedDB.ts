/**
 * useIndexedDB.ts
 *
 * A generic, reusable hook for reading and writing typed data to the browser's
 * IndexedDB. Each "store" is an independent object-store inside the shared
 * "app-cache" database.
 *
 * Usage:
 *   const db = useIndexedDB<ScriptData>("affiliate-video-scripts");
 *   await db.set("lastScript", myData);
 *   const data = await db.get("lastScript");
 *   await db.remove("lastScript");
 *   await db.clear();
 *   const all = await db.getAll();
 */

import { useCallback, useRef } from "react";
import { DB_NAME_TYPE, DB_VERSION } from "../constants";

// ── Config

// ── Internal: open (or reuse) the IDBDatabase ───────────────────────────────
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(storeName: string, dbName: DB_NAME_TYPE): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Create object stores on-the-fly when upgrading
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => {
      _dbPromise = null; // allow retry
      reject((e.target as IDBOpenDBRequest).error);
    };
    req.onblocked = () => {
      _dbPromise = null;
      reject(new Error("[useIndexedDB] Database blocked. Close other tabs."));
    };
  });

  return _dbPromise;
}

/**
 * Ensures the object store exists. If the current DB version does not have the
 * store yet, we close & re-open with an incremented version so IDB runs
 * onupgradeneeded again.
 */
async function ensureStore(storeName: string, dbName: DB_NAME_TYPE): Promise<IDBDatabase> {
  let db = await openDB(storeName, dbName);

  if (!db.objectStoreNames.contains(storeName)) {
    // Need to upgrade – bump version
    const newVersion = db.version + 1;
    db.close();
    _dbPromise = null;

    _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, newVersion);

      req.onupgradeneeded = (e) => {
        const upgraded = (e.target as IDBOpenDBRequest).result;
        if (!upgraded.objectStoreNames.contains(storeName)) {
          upgraded.createObjectStore(storeName);
        }
      };

      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = (e) => {
        _dbPromise = null;
        reject((e.target as IDBOpenDBRequest).error);
      };
    });

    db = await _dbPromise;
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
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
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
}

/**
 * useIndexedDB<T>(storeName)
 *
 * Returns stable async helpers bound to the given object-store.
 * Safe to call at the top level of any component or hook – operations are
 * lazy (the DB is opened only on first call).
 */
export function useIndexedDB<T = unknown>(
  storeName: string,
  dbName: DB_NAME_TYPE
): UseIndexedDBReturn<T> {
  // Keep storeName stable across renders via ref
  const storeRef = useRef(storeName);
  storeRef.current = storeName;

  const set = useCallback(async (key: IDBValidKey, value: T): Promise<void> => {
    const db = await ensureStore(storeRef.current, dbName);
    await txPromise<IDBValidKey>(db, storeRef.current, "readwrite", (s) => s.put(value, key));
  }, []);

  const get = useCallback(async (key: IDBValidKey): Promise<T | undefined> => {
    try {
      const db = await ensureStore(storeRef.current, dbName);
      return await txPromise<T>(db, storeRef.current, "readonly", (s) => s.get(key));
    } catch {
      return undefined;
    }
  }, []);

  const remove = useCallback(async (key: IDBValidKey): Promise<void> => {
    const db = await ensureStore(storeRef.current, dbName);
    await txPromise<undefined>(db, storeRef.current, "readwrite", (s) => s.delete(key));
  }, []);

  const clear = useCallback(async (): Promise<void> => {
    const db = await ensureStore(storeRef.current, dbName);
    await txPromise<undefined>(db, storeRef.current, "readwrite", (s) => s.clear());
  }, []);

  const getAll = useCallback(async (): Promise<T[]> => {
    try {
      const db = await ensureStore(storeRef.current, dbName);
      return await txPromise<T[]>(db, storeRef.current, "readonly", (s) => s.getAll());
    } catch {
      return [];
    }
  }, []);

  return { set, get, remove, clear, getAll };
}
