import { fetchVoices, fetchVoiceJobOutputBlob, jobIdOf, voiceJobOutputUrl } from "./voice-api";
import {
  extractJobMedia,
  voiceIdOf,
  voicesFromPage,
  type MicroxJob,
  type MicroxVoice,
  type VoiceToolId,
} from "./voice-types";

const DB_NAME = "microx-voice";
const DB_VERSION = 2;
const STORE = "results";
const MAX_RESULTS = 40;

export type VoiceResultRecord = {
  id: string;
  ownerId: string;
  jobId: string;
  tool: VoiceToolId;
  status: string;
  createdAt: number;
  voiceId: string;
  voice: MicroxVoice | null;
  urls: string[];
  blobs: Blob[];
  mimeTypes: string[];
  texts: { label: string; value: string }[];
  credits?: number;
  job: MicroxJob;
};

export const FEATURE_TEXT_LABEL = "feature";

export function resultFeatureOf(
  item?: { texts?: { label: string; value: string }[] | null } | null,
  fallback = ""
): string {
  const tagged = item?.texts?.find((row) => row.label === FEATURE_TEXT_LABEL)?.value?.trim();
  return tagged || fallback;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function voiceOwnerIdOf(customerId?: string | null): string {
  return String(customerId || "").trim();
}

export function voiceResultId(ownerId: string, key: string): string {
  return `${ownerId}::${key}`;
}

export function voiceGeneratedId(ownerId: string, voiceId: string): string {
  return `${ownerId}::${voiceId}`;
}

function assertBrowser() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("[voice-idb] IndexedDB unavailable");
  }
}

function ensureSchema(db: IDBDatabase, tx?: IDBTransaction | null) {
  let store: IDBObjectStore;
  if (!db.objectStoreNames.contains(STORE)) {
    store = db.createObjectStore(STORE, { keyPath: "id" });
  } else if (tx) {
    store = tx.objectStore(STORE);
  } else {
    return;
  }
  if (!store.indexNames.contains("byCreatedAt")) {
    store.createIndex("byCreatedAt", "createdAt");
  }
  if (!store.indexNames.contains("byTool")) {
    store.createIndex("byTool", "tool");
  }
  if (!store.indexNames.contains("byOwnerId")) {
    store.createIndex("byOwnerId", "ownerId");
  }
  if (!store.indexNames.contains("byOwnerTool")) {
    store.createIndex("byOwnerTool", ["ownerId", "tool"]);
  }
}

function openVoiceDB(): Promise<IDBDatabase> {
  assertBrowser();
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      ensureSchema(req.result, req.transaction || undefined);
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
      reject(req.error || new Error("[voice-idb] open failed"));
    };
  });
  return dbPromise;
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openVoiceDB();
  const tx = db.transaction(STORE, mode);
  const store = tx.objectStore(STORE);
  const result = run(store);
  if (result instanceof Promise) return result;
  return reqPromise(result);
}

export async function putVoiceResult(record: VoiceResultRecord): Promise<void> {
  await withStore("readwrite", (store) => store.put(record));
  const all = await listVoiceResults(record.ownerId, record.tool);
  if (all.length <= MAX_RESULTS) return;
  const extra = all.slice(MAX_RESULTS);
  const db = await openVoiceDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  extra.forEach((item) => store.delete(item.id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVoiceResult(id: string): Promise<VoiceResultRecord | undefined> {
  return withStore("readonly", (store) => store.get(id));
}

export async function deleteVoiceResult(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function listVoiceResults(
  ownerId: string,
  tool?: VoiceToolId
): Promise<VoiceResultRecord[]> {
  const owner = voiceOwnerIdOf(ownerId);
  if (!owner) return [];
  const db = await openVoiceDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rows = await reqPromise(store.getAll() as IDBRequest<VoiceResultRecord[]>);
  return (rows || [])
    .filter((item) => item.ownerId === owner && (tool ? item.tool === tool : true))
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function resolveVoice(voiceId: string): Promise<MicroxVoice | null> {
  if (!voiceId) return null;
  try {
    const data = await fetchVoices({ query: voiceId, limit: 8 });
    const found = voicesFromPage(data).find((item) => voiceIdOf(item) === voiceId);
    return found || { id: voiceId, voice_id: voiceId, name: voiceId };
  } catch {
    return { id: voiceId, voice_id: voiceId, name: voiceId };
  }
}

export async function persistCompletedVoiceJob(
  job: MicroxJob | null,
  tool: VoiceToolId,
  ownerId: string,
  knownVoiceId = "",
  sourceFile?: File | Blob | null,
  extraTexts?: { label: string; value: string }[]
): Promise<VoiceResultRecord | null> {
  if (!job) return null;
  const owner = voiceOwnerIdOf(ownerId);
  if (!owner) return null;
  const status = String(job.status || "").toLowerCase();
  if (status !== "completed") return null;
  const jobId = jobIdOf(job) || `voice_${Date.now()}`;
  const media = extractJobMedia(job);
  const voiceId = String(knownVoiceId || media.voiceIds[0] || "").trim();
  const id = voiceResultId(owner, `${tool}::${jobId}`);
  const existing = await getVoiceResult(id).catch(() => undefined);

  const blobs: Blob[] = [];
  const mimeTypes: string[] = [];
  const urls: string[] = [];
  if (sourceFile && sourceFile.size >= 32) {
    blobs.push(sourceFile);
    mimeTypes.push(sourceFile.type || "audio/mpeg");
  } else if (tool !== "stt") {
    const fetchCount = Math.max(media.urls.length, 1);
    for (let i = 0; i < fetchCount; i += 1) {
      const blob = await fetchVoiceJobOutputBlob(jobId, i);
      if (!blob || blob.size < 32) continue;
      blobs.push(blob);
      mimeTypes.push(blob.type || "audio/mpeg");
      urls.push(voiceJobOutputUrl(jobId, i));
    }
  }

  const sourceName =
    sourceFile instanceof File
      ? sourceFile.name
      : existing?.voice?.name || (tool === "stt" ? "Audio" : "");

  const safeJob = JSON.parse(JSON.stringify(job)) as MicroxJob;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        rec[k] = voiceJobOutputUrl(jobId, 0);
      } else {
        visit(v);
      }
    }
  };
  visit(safeJob);

  const record: VoiceResultRecord = {
    id,
    ownerId: owner,
    jobId,
    tool,
    status,
    createdAt: existing?.createdAt || Date.now(),
    voiceId: voiceId || existing?.voiceId || "",
    voice:
      existing?.voice ||
      (await resolveVoice(voiceId)) ||
      (sourceName ? { id: jobId, voice_id: jobId, name: sourceName } : null),
    urls: urls.length ? urls : existing?.urls || [],
    blobs: blobs.length ? blobs : existing?.blobs || [],
    mimeTypes: mimeTypes.length ? mimeTypes : existing?.mimeTypes || [],
    texts: [
      ...(extraTexts || []),
      ...(media.texts.length ? media.texts : existing?.texts || []),
    ].filter(
      (row, index, list) =>
        !(row.label === FEATURE_TEXT_LABEL && list.findIndex((item) => item.label === row.label) !== index)
    ),
    credits: job.usage?.amount,
    job: safeJob,
  };
  await putVoiceResult(record);
  return record;
}

export async function persistLocalMedia(input: {
  ownerId: string;
  tool: VoiceToolId;
  blob: Blob;
  mimeType?: string;
  name?: string;
  texts?: { label: string; value: string }[];
}): Promise<VoiceResultRecord | null> {
  const owner = voiceOwnerIdOf(input.ownerId);
  if (!owner) return null;
  const jobId = `${input.tool}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const mime = input.mimeType || input.blob.type || "application/octet-stream";
  const name = String(input.name || jobId).trim() || jobId;
  const record: VoiceResultRecord = {
    id: voiceResultId(owner, `${input.tool}::${jobId}`),
    ownerId: owner,
    jobId,
    tool: input.tool,
    status: "completed",
    createdAt: Date.now(),
    voiceId: "",
    voice: { id: jobId, voice_id: jobId, name },
    urls: [],
    blobs: [input.blob],
    mimeTypes: [mime],
    texts: input.texts || [],
    job: { id: jobId, status: "completed" },
  };
  await putVoiceResult(record);
  return record;
}
