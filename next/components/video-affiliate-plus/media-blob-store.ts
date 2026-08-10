/**
 * Media binary ngoài config/thread:
 * - Persist: IndexedDB `media-blobs`
 * - Config/list: chỉ ref `__idb_media__:key` hoặc http(s)
 * - UI: object URL (blob:) cache từ Blob — không nhét data: base64
 */
import { base64ToBlob, dataUrlToBlob } from "../app/affiliate-video/shared/videoDownloadUtils";
import {
  idbGetAllProductVideos,
  idbGetMediaBlob,
  idbPutMediaBlob,
  idbPutProductVideo,
  ProductVideoRecord,
} from "./idb";
import { CharacterPose, GenerateVideoConfig } from "./types";

export const MEDIA_BLOB_REF_PREFIX = "__idb_media__:";

const CHARACTER_POSES: CharacterPose[] = ["standing", "sitting", "fashion"];

/** ref → object URL (session) */
const objectUrlByRef = new Map<string, string>();
/** data fingerprint → object URL (tạm khi chưa migrate) */
const objectUrlByDataFp = new Map<string, string>();
/** In-flight migrate/hydrate */
const hydrateInflight = new Map<string, Promise<string>>();

let productBytesMigrateStarted = false;

export function isMediaBlobRef(url: string | null | undefined): boolean {
  return String(url || "")
    .trim()
    .startsWith(MEDIA_BLOB_REF_PREFIX);
}

export function mediaBlobKeyFromRef(ref: string): string {
  const u = String(ref || "").trim();
  if (!u.startsWith(MEDIA_BLOB_REF_PREFIX)) return "";
  return u.slice(MEDIA_BLOB_REF_PREFIX.length);
}

export function toMediaBlobRef(key: string): string {
  const k = String(key || "").trim();
  return k ? `${MEDIA_BLOB_REF_PREFIX}${k}` : "";
}

export function characterImageMediaKey(characterId: string, pose: CharacterPose | string): string {
  return `char/${String(characterId || "unknown").trim()}/${String(pose || "fashion")}`;
}

function fingerprintDataUrl(u: string): string {
  const len = u.length;
  if (len < 240) return u;
  return `${len}:${u.slice(0, 96)}:${u.slice(-48)}`;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 80 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** data: / base64 → Blob (prefer fetch; fallback decode). */
export async function anyDataToBlob(src: string): Promise<Blob> {
  const u = String(src || "").trim();
  if (!u) throw new Error("empty media");
  if (u.startsWith("blob:")) {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`blob fetch ${res.status}`);
    return res.blob();
  }
  if (u.startsWith("data:")) {
    try {
      const res = await fetch(u);
      if (res.ok) return res.blob();
    } catch {
      // fall through
    }
    return dataUrlToBlob(u);
  }
  throw new Error("not data/blob url");
}

/** Ghi Blob → IDB, trả ref `__idb_media__:key`. */
export async function putMediaBlobRef(
  key: string,
  blob: Blob,
  mimeType?: string
): Promise<string> {
  const k = String(key || "").trim();
  if (!k) throw new Error("media key rỗng");
  await idbPutMediaBlob(k, blob, mimeType || blob.type || "application/octet-stream");
  const ref = toMediaBlobRef(k);
  // Refresh object URL cache
  const prev = objectUrlByRef.get(ref);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
  try {
    objectUrlByRef.set(ref, URL.createObjectURL(blob));
  } catch {
    // ignore
  }
  return ref;
}

/** data:/blob: → lưu IDB + ref; http(s)/ref giữ nguyên. */
export async function ensureMediaBlobRef(
  value: string | null | undefined,
  preferredKey: string
): Promise<{ ref: string; changed: boolean }> {
  const u = String(value || "").trim();
  if (!u) return { ref: "", changed: false };
  if (isMediaBlobRef(u)) return { ref: u, changed: false };
  if (/^https?:\/\//i.test(u)) return { ref: u, changed: false };

  if (u.startsWith("data:") || u.startsWith("blob:")) {
    try {
      const blob = await anyDataToBlob(u);
      if (!blob || blob.size <= 0) return { ref: "", changed: Boolean(u) };
      const ref = await putMediaBlobRef(preferredKey, blob);
      return { ref, changed: true };
    } catch (err) {
      console.warn("[ensureMediaBlobRef]", preferredKey, err);
      return { ref: "", changed: Boolean(u) };
    }
  }

  // raw / path lạ — giữ nếu ngắn
  if (u.length < 2048) return { ref: u, changed: false };
  return { ref: "", changed: true };
}

/** Lấy Blob từ ref / blob: / data: / http. */
export async function resolveMediaToBlob(src: string | null | undefined): Promise<Blob | null> {
  const u = String(src || "").trim();
  if (!u) return null;

  if (isMediaBlobRef(u)) {
    const rec = await idbGetMediaBlob(mediaBlobKeyFromRef(u));
    return rec?.blob && rec.blob.size > 0 ? rec.blob : null;
  }
  if (u.startsWith("blob:") || u.startsWith("data:")) {
    try {
      return await anyDataToBlob(u);
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(u)) {
    try {
      const res = await fetch(u);
      if (!res.ok) return null;
      return res.blob();
    } catch {
      return null;
    }
  }
  return null;
}

/** Object URL đồng bộ (sau hydrate). */
export function getCachedMediaObjectUrl(src: string | null | undefined): string {
  const u = String(src || "").trim();
  if (!u) return "";
  if (u.startsWith("blob:") || /^https?:\/\//i.test(u)) return u;
  if (isMediaBlobRef(u)) return objectUrlByRef.get(u) || "";
  if (u.startsWith("data:")) {
    return objectUrlByDataFp.get(fingerprintDataUrl(u)) || "";
  }
  return "";
}

/**
 * Resolve → blob: object URL cho img.
 * data: tạm convert + cache (nên migrate IDB để khỏi lưu base64 trong config).
 */
export async function resolveMediaToObjectUrl(src: string | null | undefined): Promise<string> {
  const u = String(src || "").trim();
  if (!u) return "";
  if (u.startsWith("blob:") || /^https?:\/\//i.test(u)) return u;

  const cached = getCachedMediaObjectUrl(u);
  if (cached) return cached;

  const inflight = hydrateInflight.get(u);
  if (inflight) return inflight;

  const job = (async () => {
    try {
      if (isMediaBlobRef(u)) {
        const blob = await resolveMediaToBlob(u);
        if (!blob) return "";
        const obj = URL.createObjectURL(blob);
        objectUrlByRef.set(u, obj);
        return obj;
      }
      if (u.startsWith("data:")) {
        const fp = fingerprintDataUrl(u);
        const hit = objectUrlByDataFp.get(fp);
        if (hit) return hit;
        const blob = await anyDataToBlob(u);
        const obj = URL.createObjectURL(blob);
        objectUrlByDataFp.set(fp, obj);
        return obj;
      }
      return u.length < 2048 ? u : "";
    } catch (err) {
      console.warn("[resolveMediaToObjectUrl]", err);
      return "";
    } finally {
      hydrateInflight.delete(u);
    }
  })();

  hydrateInflight.set(u, job);
  return job;
}

/** Sync list src — ưu tiên cache object URL; data: convert sync fallback. */
export function toDisplayMediaSrc(src: string | null | undefined): string {
  const u = String(src || "").trim();
  if (!u) return "";
  if (u.startsWith("blob:") || /^https?:\/\//i.test(u)) return u;

  const cached = getCachedMediaObjectUrl(u);
  if (cached) return cached;

  if (isMediaBlobRef(u)) return ""; // chờ hydrate

  if (u.startsWith("data:")) {
    const fp = fingerprintDataUrl(u);
    const hit = objectUrlByDataFp.get(fp);
    if (hit) return hit;
    try {
      // Sync path (migrate async sẽ dọn config) — tránh kẹt lặp main thread bằng cache
      const obj = URL.createObjectURL(dataUrlToBlob(u));
      objectUrlByDataFp.set(fp, obj);
      return obj;
    } catch {
      return "";
    }
  }
  return u.length < 2048 ? u : "";
}

export function toDisplayMediaSrcList(urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const url of urls) {
    const light = toDisplayMediaSrc(url);
    if (light) out.push(light);
  }
  return out;
}

/** Migrate ảnh nhân vật data:/blob: trong config → media-blobs + ref. */
export async function migrateGenerateConfigMedia(
  config: GenerateVideoConfig
): Promise<{ config: GenerateVideoConfig; changed: boolean }> {
  let changed = false;
  const characters = [];

  for (const character of config.characters || []) {
    const images = {
      standing: String(character.images?.standing || ""),
      sitting: String(character.images?.sitting || ""),
      fashion: String(character.images?.fashion || ""),
    };
    const nextImages = { ...images };

    for (const pose of CHARACTER_POSES) {
      const current = images[pose];
      if (!current) continue;
      // Yield giữa pose lớn để UI không đơ khi migrate lần đầu
      if (current.startsWith("data:") && current.length > 50_000) {
        await yieldToMain();
      }
      const key = characterImageMediaKey(character.id, pose);
      const { ref, changed: poseChanged } = await ensureMediaBlobRef(current, key);
      if (poseChanged || ref !== current) {
        nextImages[pose] = ref;
        changed = true;
      }
    }

    characters.push(
      nextImages.standing !== images.standing ||
        nextImages.sitting !== images.sitting ||
        nextImages.fashion !== images.fashion
        ? { ...character, images: nextImages }
        : character
    );
  }

  if (!changed) return { config, changed: false };
  return { config: { ...config, characters }, changed: true };
}

/** Preload object URL cho mọi ref nhân vật trong config. */
export async function hydrateCharacterMediaObjectUrls(config: GenerateVideoConfig): Promise<void> {
  const refs: string[] = [];
  for (const character of config.characters || []) {
    for (const pose of CHARACTER_POSES) {
      const u = String(character.images?.[pose] || "").trim();
      if (isMediaBlobRef(u) || u.startsWith("data:")) refs.push(u);
    }
  }
  // chunk để không block
  for (let i = 0; i < refs.length; i++) {
    await resolveMediaToObjectUrl(refs[i]);
    if (i % 2 === 1) await yieldToMain();
  }
}

/**
 * Nền: product-videos legacy `videoBytesList` base64 → `videoBlobList`, xóa bytes.
 * Giảm dung lượng IDB + tránh decode base64 lúc preview.
 */
export async function migrateProductVideoBytesToBlobsInBackground(): Promise<void> {
  if (typeof window === "undefined" || productBytesMigrateStarted) return;
  productBytesMigrateStarted = true;

  try {
    const all = await idbGetAllProductVideos();
    for (const rec of all) {
      const next = await migrateOneProductRecordBytes(rec);
      if (next) {
        await idbPutProductVideo(next);
        await yieldToMain();
      }
    }
  } catch (err) {
    console.warn("[migrateProductVideoBytesToBlobsInBackground]", err);
  }
}

async function migrateOneProductRecordBytes(
  rec: ProductVideoRecord
): Promise<ProductVideoRecord | null> {
  let changed = false;
  const mime = rec.mimeType || "video/mp4";
  const len = Math.max(
    rec.videoUris?.length || 0,
    rec.videoBytesList?.length || 0,
    rec.videoBlobList?.length || 0
  );
  const videoBlobList = [...(rec.videoBlobList || [])];
  const videoBytesList = [...(rec.videoBytesList || [])];
  while (videoBlobList.length < len) videoBlobList.push(null);
  while (videoBytesList.length < len) videoBytesList.push(null);

  for (let i = 0; i < len; i++) {
    const existing = videoBlobList[i];
    if (existing && existing.size > 0) {
      if (videoBytesList[i]) {
        videoBytesList[i] = null;
        changed = true;
      }
      continue;
    }
    const bytes = String(videoBytesList[i] || "").trim();
    if (!bytes) continue;
    try {
      await yieldToMain();
      videoBlobList[i] = base64ToBlob(bytes, mime);
      videoBytesList[i] = null;
      changed = true;
    } catch (err) {
      console.warn("[migrateOneProductRecordBytes] slot", i, err);
    }
  }

  let mergedVideoBlob = rec.mergedVideoBlob || null;
  let mergedVideoBytes = rec.mergedVideoBytes || null;
  if ((!mergedVideoBlob || mergedVideoBlob.size <= 0) && (mergedVideoBytes || "").trim()) {
    try {
      await yieldToMain();
      mergedVideoBlob = base64ToBlob(mergedVideoBytes!.trim(), mime);
      mergedVideoBytes = null;
      changed = true;
    } catch (err) {
      console.warn("[migrateOneProductRecordBytes] merged", err);
    }
  } else if (mergedVideoBlob && mergedVideoBlob.size > 0 && (mergedVideoBytes || "").trim()) {
    mergedVideoBytes = null;
    changed = true;
  }

  if (!changed) return null;
  return {
    ...rec,
    videoBlobList,
    videoBytesList,
    mergedVideoBlob,
    mergedVideoBytes,
    updatedAt: Date.now(),
  };
}
