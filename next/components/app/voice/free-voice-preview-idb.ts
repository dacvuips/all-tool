/**
 * Cache audio nghe thử giọng miễn phí (preview) vào IndexedDB.
 * Key = voiceId; chỉ tái dùng khi text preview khớp.
 */
import { FREE_VOICE_PREVIEW_TEXT } from "./free-voice-api";

const DB_NAME = "free-gen-audio-previews";
const DB_VERSION = 1;
const STORE = "previews";

export type FreeVoicePreviewRecord = {
  voiceId: string;
  blob: Blob;
  text: string;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function assertBrowser() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("[free-voice-preview-idb] IndexedDB unavailable");
  }
}

function openDb(): Promise<IDBDatabase> {
  assertBrowser();
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "voiceId" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error("[free-voice-preview-idb] open failed"));
    };
  });
  return dbPromise;
}

function normalizeVoiceId(voiceId: string): string {
  return String(voiceId || "")
    .trim()
    .toLowerCase();
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFreeVoicePreviewBlob(voiceId: string): Promise<Blob | null> {
  const id = normalizeVoiceId(voiceId);
  if (!id) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const row = await reqPromise(
      tx.objectStore(STORE).get(id) as IDBRequest<FreeVoicePreviewRecord | undefined>
    );
    if (!row?.blob || row.blob.size < 32) return null;
    if (String(row.text || "") !== FREE_VOICE_PREVIEW_TEXT) return null;
    return row.blob;
  } catch {
    return null;
  }
}

export async function putFreeVoicePreviewBlob(voiceId: string, blob: Blob): Promise<void> {
  const id = normalizeVoiceId(voiceId);
  if (!id || !blob || blob.size < 32) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const record: FreeVoicePreviewRecord = {
      voiceId: id,
      blob,
      text: FREE_VOICE_PREVIEW_TEXT,
      updatedAt: Date.now(),
    };
    await reqPromise(tx.objectStore(STORE).put(record));
  } catch {
    // cache miss / fail không chặn nghe thử
  }
}

export async function hasFreeVoicePreview(voiceId: string): Promise<boolean> {
  const blob = await getFreeVoicePreviewBlob(voiceId);
  return !!blob;
}

export async function listFreeVoicePreviewIds(): Promise<string[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const rows = await reqPromise(
      tx.objectStore(STORE).getAll() as IDBRequest<FreeVoicePreviewRecord[]>
    );
    return (rows || [])
      .filter(
        (row) =>
          row?.voiceId &&
          row.blob &&
          row.blob.size >= 32 &&
          String(row.text || "") === FREE_VOICE_PREVIEW_TEXT
      )
      .map((row) => row.voiceId);
  } catch {
    return [];
  }
}
