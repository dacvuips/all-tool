/**
 * Persist video kết quả theo mã sản phẩm — giống scene generate image/video:
 * - Thread/UI: chỉ lưu tên/marker (merged.mp4), không nhét binary
 * - IndexedDB: lưu Blob (giống mediaBlob), không nhét base64
 * - Variant: lưu link ngay + enrich binary ngầm
 */
import {
  base64ToBlob,
  dataUrlToBlob,
  toDownloadProxyUrl,
  uriToBlob,
} from "../app/affiliate-video/shared/videoDownloadUtils";
import { extractShopeeProductId } from "./csv-parser";
import { destroyFFmpegInstance, mergeVideosInBrowser } from "./ffmpeg-browser";
import {
  idbDeleteMergedVideo,
  idbDeleteProductVideo,
  idbGetMergedVideo,
  idbGetProductVideo,
  idbPutMergedVideo,
  idbPutProductVideo,
  ProductVideoRecord,
} from "./idb";
import { toLightThreadMediaRef, toLightThreadMediaRefs } from "./media-display-url";

/** Cùng productId: 1 enrich dang dở được share (merge + persist + UI). */
const _enrichInflightByKey = new Map<string, Promise<ProductVideoRecord | undefined>>();

/** Job đang bay theo storageKey — dedup cùng urls (không xếp hàng serial toàn app). */
const _mergeInflightByKey = new Map<
  string,
  { sig: string; promise: Promise<string> }
>();

function urlsSignature(urls: string[], slotIndices?: number[]): string {
  const slots = (slotIndices || []).join(",");
  return `${slots}\n${urls.map((u) => String(u || "").trim()).join("\n")}`;
}

export type ProductVideoKeySource = {
  id: string;
  productId?: string;
  productLink?: string;
  mergedVideoUrl?: string;
  videoUrls?: string[];
  videoDisabled?: boolean[];
};

/**
 * Tên file nhẹ persist trên thread/UI — giống scene-N-video.mp4.
 * Binary thật nằm product-videos IndexedDB.
 */
export const MERGED_VIDEO_FILE_NAME = "merged.mp4";

/** @deprecated Alias cũ — vẫn nhận khi đọc bản ghi legacy */
export const MERGED_VIDEO_IDB_MARKER = "indexeddb";

export function isMergedVideoIdbMarker(url?: string): boolean {
  const u = String(url || "").trim();
  return u === MERGED_VIDEO_FILE_NAME || u === MERGED_VIDEO_IDB_MARKER;
}

/** Có ref video nối (tên file / blob / http) — dùng cho UI hasMerged. */
export function hasMergedVideoRef(url?: string): boolean {
  return Boolean(String(url || "").trim());
}

function recordHasMergedBinary(rec?: ProductVideoRecord | null): boolean {
  if (!rec) return false;
  if (rec.mergedVideoBlob && rec.mergedVideoBlob.size > 0) return true;
  if ((rec.mergedVideoBytes || "").trim()) return true;
  return false;
}

function recordHasVariantVideos(rec?: ProductVideoRecord | null): boolean {
  if (!rec) return false;
  if ((rec.videoUris || []).some((u) => String(u || "").trim())) return true;
  if ((rec.videoBlobList || []).some((b) => Boolean(b && b.size > 0))) return true;
  if ((rec.videoBytesList || []).some((b) => String(b || "").trim())) return true;
  return false;
}

/** Đã có ít nhất 1 variant trên item (URL không rỗng). */
export function hasVariantVideoUrls(item: { videoUrls?: string[] } | null | undefined): boolean {
  return (item?.videoUrls || []).some((u) => String(u || "").trim());
}

/**
 * Đã có video generate (variant trên item / IndexedDB của phiên) hoặc video nối.
 * Dùng khi Bắt Đầu — bỏ qua trong CÙNG phiên; không xem video phiên khác.
 */
export async function hasExistingGeneratedVideo(
  item: ProductVideoKeySource,
  sessionId?: string
): Promise<boolean> {
  if (hasVariantVideoUrls(item)) return true;
  if (hasMergedVideoRef(item.mergedVideoUrl)) return true;
  // Chỉ tra IDB theo key phiên — tránh skip vì video của lần import cũ
  if (await hasMergedVideoFile(item, sessionId, { sessionOnly: true })) return true;
  const key = getMergedVideoStorageKey(item, sessionId);
  if (key) {
    const rec = await idbGetProductVideo(key);
    if (recordHasVariantVideos(rec)) return true;
  }
  return false;
}

/**
 * Đã có file video nối thật (ref trên item / Blob IndexedDB / legacy).
 * Không decode full base64 — chỉ kiểm tra tồn tại.
 */
export async function hasMergedVideoFile(
  item: ProductVideoKeySource,
  sessionId?: string,
  opts?: { sessionOnly?: boolean }
): Promise<boolean> {
  const url = String(item.mergedVideoUrl || "").trim();
  if (url && !isMergedVideoIdbMarker(url)) {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return true;
    }
    if (url.startsWith("blob:")) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0) return true;
        }
      } catch {
        // fall through → check IDB
      }
    } else {
      return true;
    }
  }

  const keys = opts?.sessionOnly
    ? [getMergedVideoStorageKey(item, sessionId)].filter(Boolean)
    : videoStorageKeysToTry(item, sessionId);

  for (const key of keys) {
    const rec = await idbGetProductVideo(key);
    if (recordHasMergedBinary(rec)) return true;
    const legacy = await idbGetMergedVideo(key);
    if (legacy?.blob && legacy.blob.size > 0) return true;
  }
  if (item.id && !keys.includes(item.id)) {
    const legacyById = await idbGetMergedVideo(item.id);
    if (legacyById?.blob && legacyById.blob.size > 0) return true;
  }

  return isMergedVideoIdbMarker(url);
}

/**
 * Chuẩn hóa trước khi ghi thread store — chỉ giữ tên file (giống scene chỉ lưu name).
 * Không persist blob:/data:.
 */
export function toPersistedMergedVideoUrl(url?: string): string {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.startsWith("blob:") || u.startsWith("data:") || isMergedVideoIdbMarker(u)) {
    return MERGED_VIDEO_FILE_NAME;
  }
  return u;
}

/** Key sản phẩm thuần (legacy) — không gắn phiên. */
export function getProductStorageKey(item: ProductVideoKeySource): string {
  const fromField = String(item.productId || "").trim();
  if (fromField) return fromField;
  const fromLink = extractShopeeProductId(item.productLink || "");
  if (fromLink) return fromLink;
  return String(item.id || "").trim();
}

/** Phân tách sessionId khỏi product key trong IndexedDB. */
export const SESSION_VIDEO_KEY_SEP = "::";

/**
 * Key lưu video IndexedDB.
 * Có sessionId → `sessionId::productId` (mỗi lần import một bộ video riêng).
 * Không có sessionId → legacy `productId` (upload / bản ghi cũ).
 */
export function getMergedVideoStorageKey(
  item: ProductVideoKeySource,
  sessionId?: string
): string {
  const productKey = getProductStorageKey(item);
  if (!productKey) return "";
  const sid = String(sessionId || "").trim();
  if (sid) return `${sid}${SESSION_VIDEO_KEY_SEP}${productKey}`;
  return productKey;
}

/** Các key cần thử khi đọc (phiên trước, rồi legacy productId). */
export function videoStorageKeysToTry(
  item: ProductVideoKeySource,
  sessionId?: string
): string[] {
  const keys: string[] = [];
  const sessionKey = getMergedVideoStorageKey(item, sessionId);
  if (sessionKey) keys.push(sessionKey);
  const productKey = getProductStorageKey(item);
  if (productKey && productKey !== sessionKey) keys.push(productKey);
  return keys;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function isDataUrl(url: string): boolean {
  return String(url || "")
    .trim()
    .startsWith("data:");
}

/**
 * Preview variant refs (nhẹ) — không trả data: base64.
 * Binary → marker; http → proxy; materialize blob: chỉ trong resolveVariantPreviewUrls.
 */
export function getVariantPreviewUrls(record: ProductVideoRecord): string[] {
  return (record.videoUris || []).map((uri, idx) => {
    const bytes = (record.videoBytesList?.[idx] || "").trim();
    if (bytes) return `__idb_bytes__:${idx}`;
    const trimmed = String(uri || "").trim();
    if (!trimmed) {
      if (record.videoBlobList?.[idx] && record.videoBlobList[idx]!.size > 0) {
        return `__idb_blob__:${idx}`;
      }
      return "";
    }
    if (isDataUrl(trimmed)) return `__idb_data__:${idx}`;
    // Có Blob local → placeholder; resolveVariantPreviewUrls tạo object URL
    if (record.videoBlobList?.[idx] && record.videoBlobList[idx]!.size > 0) {
      return `__idb_blob__:${idx}`;
    }
    if (trimmed.startsWith("blob:")) return `__idb_blob__:${idx}`;
    return toDownloadProxyUrl(trimmed, true);
  });
}

function urlsLooselyMatch(a: string, b: string): boolean {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y) return false;
  if (x === y) return true;
  // flow2: .../video/ID và .../video/ID/1
  const norm = (u: string) => u.replace(/\/+$/, "").replace(/\/\d+$/, "");
  return norm(x) === norm(y);
}

function slotHasBinary(record: ProductVideoRecord, idx: number): boolean {
  const blob = record.videoBlobList?.[idx];
  if (blob && blob.size > 0) return true;
  return Boolean((record.videoBytesList?.[idx] || "").trim());
}

function isQuotaExceeded(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: number } | null;
  if (!e) return false;
  if (e.name === "QuotaExceededError" || e.code === 22) return true;
  return /quota|storage/i.test(String(e.message || ""));
}

/** @deprecated Dùng resolveMergedPreviewUrl — tránh data: quá lớn */
export function getMergedPreviewUrl(record: ProductVideoRecord): string {
  if (record.mergedVideoBlob && record.mergedVideoBlob.size > 0) {
    return URL.createObjectURL(record.mergedVideoBlob);
  }
  if (record.mergedVideoBytes) {
    return `data:${record.mimeType || "video/mp4"};base64,${record.mergedVideoBytes}`;
  }
  return "";
}

export function hasPendingVariantBase64(record: ProductVideoRecord): boolean {
  return (record.videoUris || []).some((uri, idx) => {
    if (!isHttpUrl(uri)) return false;
    return !slotHasBinary(record, idx);
  });
}

/** Bước 1: lưu link ngay vào IndexedDB (giữ index slot, kể cả chuỗi rỗng). */
export async function persistProductVideoLinks(
  productId: string,
  videoUris: string[],
  mimeType = "video/mp4"
): Promise<ProductVideoRecord> {
  const key = String(productId || "").trim();
  if (!key) throw new Error("Thiếu mã sản phẩm để lưu video");

  const uris = videoUris.map((u) => String(u || "").trim());
  const existing = await idbGetProductVideo(key);
  const record: ProductVideoRecord = {
    productId: key,
    videoUris: uris,
    videoBytesList: uris.map((uri, idx) => {
      if (!uri) return null;
      if (
        existing?.videoUris?.[idx] === uri &&
        (existing.videoBytesList?.[idx] || "").trim()
      ) {
        return existing.videoBytesList![idx];
      }
      return null;
    }),
    videoBlobList: uris.map((uri, idx) => {
      if (!uri) return null;
      const prev = existing?.videoBlobList?.[idx];
      if (existing?.videoUris?.[idx] === uri && prev && prev.size > 0) return prev;
      return null;
    }),
    mimeType,
    mergedVideoBytes: existing?.mergedVideoBlob ? null : existing?.mergedVideoBytes || null,
    mergedVideoBlob: existing?.mergedVideoBlob || null,
    mergedVideoName: existing?.mergedVideoName || undefined,
    updatedAt: Date.now(),
  };
  await idbPutProductVideo(record);
  return record;
}

/** Giữ field video đã nối khi ghi đè bản ghi product-videos (tránh race với enrich). */
function preserveMergedFields(
  base: ProductVideoRecord,
  latest?: ProductVideoRecord | null
): Pick<ProductVideoRecord, "mergedVideoBytes" | "mergedVideoBlob" | "mergedVideoName"> {
  const src = latest || base;
  return {
    mergedVideoBytes: src.mergedVideoBlob ? null : src.mergedVideoBytes || null,
    mergedVideoBlob: src.mergedVideoBlob || null,
    mergedVideoName: src.mergedVideoName || undefined,
  };
}

/** Bước 2 (ngầm): tải từng link → Blob và ghi IDB (không nhét base64 — tránh QuotaExceeded). */
export async function enrichProductVideoBase64(
  productId: string,
  options?: { onUpdate?: (record: ProductVideoRecord) => void }
): Promise<ProductVideoRecord | undefined> {
  const key = String(productId || "").trim();
  if (!key) return undefined;

  const inflight = _enrichInflightByKey.get(key);
  if (inflight) {
    // Share promise; onUpdate của caller sau có thể không nhận partial — OK (merge đọc lại IDB).
    return inflight;
  }

  const run = (async (): Promise<ProductVideoRecord | undefined> => {
    const current = await idbGetProductVideo(key);
    if (!current || !hasPendingVariantBase64(current)) return current;

    const videoBlobList = [...(current.videoBlobList || [])];
    while (videoBlobList.length < current.videoUris.length) {
      videoBlobList.push(null);
    }
    // Giữ base64 cũ nếu có; không tạo thêm base64 mới
    const videoBytesList = [...(current.videoBytesList || [])];
    while (videoBytesList.length < current.videoUris.length) {
      videoBytesList.push(null);
    }

    let changed = false;
    let lastWritten: ProductVideoRecord = current;

    for (let i = 0; i < current.videoUris.length; i++) {
      if (slotHasBinary({ ...current, videoBlobList, videoBytesList }, i)) continue;
      const uri = current.videoUris[i];
      if (!isHttpUrl(uri) && !String(uri || "").trim().startsWith("blob:")) continue;

      let blob: Blob | null = null;
      try {
        blob = await uriToBlob(uri);
      } catch (err) {
        console.warn("[enrichProductVideoBase64] fetch failed", uri, err);
        continue;
      }
      if (!blob || blob.size <= 0) continue;

      videoBlobList[i] = blob;
      // Không ghi base64 mới — giảm dung lượng IDB
      videoBytesList[i] = null;
      changed = true;

      try {
        const latest = await idbGetProductVideo(key);
        const partial: ProductVideoRecord = {
          ...(latest || current),
          videoUris: (latest || current).videoUris,
          videoBlobList: [...videoBlobList],
          videoBytesList: [...videoBytesList],
          mimeType: blob.type || (latest || current).mimeType || "video/mp4",
          ...preserveMergedFields(current, latest),
          updatedAt: Date.now(),
        };
        await idbPutProductVideo(partial);
        lastWritten = partial;
        options?.onUpdate?.(partial);
      } catch (err) {
        if (isQuotaExceeded(err)) {
          console.warn(
            "[enrichProductVideoBase64] QuotaExceeded — bỏ lưu variant, merge vẫn tải URL",
            err
          );
          break;
        }
        throw err;
      }
    }

    if (!changed) return current;

    try {
      const latest = await idbGetProductVideo(key);
      const enriched: ProductVideoRecord = {
        ...(latest || lastWritten),
        videoBlobList,
        videoBytesList,
        ...preserveMergedFields(lastWritten, latest),
        updatedAt: Date.now(),
      };
      await idbPutProductVideo(enriched);
      options?.onUpdate?.(enriched);
      return enriched;
    } catch (err) {
      if (isQuotaExceeded(err)) {
        console.warn("[enrichProductVideoBase64] QuotaExceeded on final put", err);
        return lastWritten;
      }
      throw err;
    }
  })();

  _enrichInflightByKey.set(key, run);
  try {
    return await run;
  } finally {
    if (_enrichInflightByKey.get(key) === run) {
      _enrichInflightByKey.delete(key);
    }
  }
}

/** Lưu link trước + enrich ngầm (giống persistGeneratedVideoWithEnrichment). */
export async function persistProductVideosWithEnrichment(
  productId: string,
  videoUris: string[],
  options?: { onUpdate?: (record: ProductVideoRecord) => void; mimeType?: string }
): Promise<ProductVideoRecord> {
  const preview = await persistProductVideoLinks(
    productId,
    videoUris,
    options?.mimeType || "video/mp4"
  );
  options?.onUpdate?.(preview);

  void (async () => {
    try {
      if (!hasPendingVariantBase64(preview)) return;
      await enrichProductVideoBase64(productId, { onUpdate: options?.onUpdate });
    } catch (err) {
      console.warn("[persistProductVideosWithEnrichment]", err);
    }
  })();

  return preview;
}

function getVariantBlobAt(
  record: ProductVideoRecord | undefined,
  index: number,
  mime: string
): Blob | null {
  if (!record || index < 0) return null;
  const blob = record.videoBlobList?.[index];
  if (blob && blob.size > 0) return blob;
  const bytes = (record.videoBytesList?.[index] || "").trim();
  if (bytes) return base64ToBlob(bytes, mime);
  return null;
}

function resolveVariantBlobFromRecord(
  record: ProductVideoRecord | undefined,
  url: string,
  index: number,
  mime: string
): Blob | null {
  if (!record) return null;

  const trimmedUrl = String(url || "").trim();
  const uris = record.videoUris || [];

  // 1) Binary đúng slot gốc
  const bySlot = getVariantBlobAt(record, index, mime);
  if (bySlot) return bySlot;

  if (!trimmedUrl || trimmedUrl === "__idb__") return null;

  // 2) Khớp URL chính xác
  const exactIdx = uris.findIndex((u) => String(u || "").trim() === trimmedUrl);
  if (exactIdx >= 0) {
    const exact = getVariantBlobAt(record, exactIdx, mime);
    if (exact) return exact;
  }

  // 3) Khớp loose (flow2 .../id vs .../id/1)
  const looseIdx = uris.findIndex((u) => urlsLooselyMatch(String(u || "").trim(), trimmedUrl));
  if (looseIdx >= 0) {
    const loose = getVariantBlobAt(record, looseIdx, mime);
    if (loose) return loose;
  }

  return null;
}

function isRemoteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function isFetchableMediaUrl(url: string): boolean {
  const u = String(url || "").trim();
  if (!u || u === "__idb__") return false;
  return isRemoteHttpUrl(u) || u.startsWith("data:") || u.startsWith("blob:");
}

async function putMergedVideoWithVerify(
  key: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const tryPut = async () => {
    await idbPutMergedVideo(key, blob, mimeType);
    const verify = await idbGetMergedVideo(key);
    if (!verify?.blob || verify.blob.size <= 0) {
      throw new Error("verify-empty");
    }
  };

  try {
    await tryPut();
  } catch (err) {
    if (isQuotaExceeded(err)) {
      throw new Error(
        "IndexedDB đầy — không lưu được video nối. Xóa bớt phiên/CSV cũ rồi thử Nối lại."
      );
    }
    // Retry 1 lần (race / transaction)
    try {
      await new Promise((r) => setTimeout(r, 80));
      await tryPut();
    } catch (retryErr) {
      if (isQuotaExceeded(retryErr)) {
        throw new Error(
          "IndexedDB đầy — không lưu được video nối. Xóa bớt phiên/CSV cũ rồi thử Nối lại."
        );
      }
      throw new Error(
        `Lưu video nối vào IndexedDB thất bại — thử Nối lại (${
          (retryErr as Error)?.message || retryErr
        })`
      );
    }
  }
}

/**
 * Core pipeline (không queue).
 * load Blob: link thật (http → download-proxy) trước → fallback Blob IDB → ffmpeg.
 */
async function runMergeVideosToIndexedDbPipeline(
  key: string,
  clean: string[],
  options?: {
    onProgress?: (ratio: number, message: string) => void;
    /** Index slot gốc trong videoUrls/videoBlobList (khi clean đã filter disabled). */
    slotIndices?: number[];
  }
): Promise<string> {
  // Giữ local refs ngắn — null sau khi xong để GC bớt spike
  let blobs: Array<Blob | null> = [];
  let resultBlob: Blob | null = null;

  try {
    options?.onProgress?.(0.02, "Đang chuẩn bị video nguồn...");

    let record = await idbGetProductVideo(key);
    const mime = record?.mimeType || "video/mp4";
    const slotOf = (i: number) =>
      options?.slotIndices && options.slotIndices[i] != null
        ? options.slotIndices[i]!
        : i;

    // Enrich ngầm chỉ khi có slot không có link thật (sẽ cần Blob local)
    const needsBlobFallback = clean.some((url, i) => {
      const u = String(url || "").trim();
      if (isFetchableMediaUrl(u) && u !== "__idb__") return false;
      return !getVariantBlobAt(record, slotOf(i), mime);
    });
    if (needsBlobFallback && (!record || hasPendingVariantBase64(record))) {
      try {
        await enrichProductVideoBase64(key);
        record = await idbGetProductVideo(key);
      } catch (err) {
        console.warn("[mergeVideosToIndexedDb] enrich trước merge thất bại", err);
      }
    }

    const mimeAfter = record?.mimeType || mime;
    const maxSlot = Math.max(
      clean.length,
      ...(options?.slotIndices || []).map((n) => n + 1),
      record?.videoBlobList?.length || 0,
      record?.videoUris?.length || 0
    );
    const cachedBlobs: Array<Blob | null> = [...(record?.videoBlobList || [])];
    while (cachedBlobs.length < maxSlot) cachedBlobs.push(null);
    let cacheDirty = false;

    for (let i = 0; i < clean.length; i++) {
      const url = clean[i];
      const slotIdx = slotOf(i);
      const trimmedUrl = String(url || "").trim();
      options?.onProgress?.(
        0.05 + (i / clean.length) * 0.2,
        `Đang lấy video ${i + 1}/${clean.length}...`
      );

      let blob: Blob | null = null;

      // 1) Ưu tiên link thật qua proxy / fetch (http, blob:, data:)
      if (isFetchableMediaUrl(trimmedUrl)) {
        try {
          blob = await uriToBlob(trimmedUrl);
          if (blob && blob.size > 0 && isRemoteHttpUrl(trimmedUrl)) {
            // Cache local sau khi tải proxy thành công
            if (!cachedBlobs[slotIdx] || cachedBlobs[slotIdx]!.size <= 0) {
              cachedBlobs[slotIdx] = blob;
              cacheDirty = true;
            }
          }
        } catch (err: any) {
          // 2) Link fail → Blob video local (IDB)
          blob = resolveVariantBlobFromRecord(record, trimmedUrl, slotIdx, mimeAfter);
          if (!blob) {
            throw new Error(
              `Không tải được video số ${i + 1} (${trimmedUrl.slice(0, 80)}…). Link proxy lỗi và chưa có Blob local — hãy generate lại.\n(${
                err?.message || err
              })`
            );
          }
        }
      } else {
        // 3) Không có link thật → lấy Blob video (IndexedDB / legacy base64)
        blob = resolveVariantBlobFromRecord(record, trimmedUrl, slotIdx, mimeAfter);
      }

      if (!blob || blob.size <= 0) {
        throw new Error(`Video số ${i + 1} rỗng — hãy generate lại`);
      }

      blobs.push(blob);
      if (!cachedBlobs[slotIdx] || cachedBlobs[slotIdx]!.size <= 0) {
        cachedBlobs[slotIdx] = blob;
        cacheDirty = true;
      }
    }

    // Cache Blob nguồn (không base64) — để Nối lại không phụ thuộc flow2
    if (cacheDirty) {
      try {
        const existing = await idbGetProductVideo(key);
        const uris =
          existing?.videoUris?.length
            ? existing.videoUris
            : Array.from({ length: maxSlot }, (_, idx) => {
                const j = options?.slotIndices?.indexOf(idx) ?? -1;
                return j >= 0 ? clean[j] : "";
              });
        await idbPutProductVideo({
          productId: key,
          videoUris: uris,
          videoBlobList: cachedBlobs,
          videoBytesList: uris.map(() => null),
          mimeType: existing?.mimeType || mimeAfter,
          ...preserveMergedFields(
            existing || {
              productId: key,
              videoUris: uris,
              videoBytesList: uris.map(() => null),
              mimeType: mimeAfter,
              mergedVideoBytes: null,
              updatedAt: Date.now(),
            },
            existing
          ),
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn("[mergeVideosToIndexedDb] cache variant blobs failed", err);
      }
    }

    const inputs = blobs.filter((b): b is Blob => Boolean(b && b.size > 0));
    if (inputs.length < 2) {
      throw new Error("Cần ít nhất 2 video để nối");
    }

    resultBlob = await mergeVideosInBrowser(inputs, {
      onProgress: options?.onProgress
        ? ({ ratio, message }) => options.onProgress!(0.25 + ratio * 0.75, message)
        : undefined,
    });

    for (let i = 0; i < blobs.length; i++) blobs[i] = null;
    blobs = [];

    const mimeType = resultBlob.type || "video/mp4";

    await putMergedVideoWithVerify(key, resultBlob, mimeType);
    resultBlob = null;

    try {
      const existing = await idbGetProductVideo(key);
      const next: ProductVideoRecord = {
        productId: key,
        videoUris: existing?.videoUris || clean,
        videoBytesList: existing?.videoBytesList || clean.map(() => null),
        videoBlobList: existing?.videoBlobList || cachedBlobs,
        mimeType: existing?.mimeType || mimeType,
        mergedVideoBytes: null,
        mergedVideoBlob: null,
        mergedVideoName: MERGED_VIDEO_FILE_NAME,
        updatedAt: Date.now(),
      };
      await idbPutProductVideo(next);
    } catch (err) {
      console.warn("[mergeVideosToIndexedDb] product marker persist failed", err);
    }

    options?.onProgress?.(1, "Hoàn tất");
    return MERGED_VIDEO_FILE_NAME;
  } finally {
    for (let i = 0; i < blobs.length; i++) blobs[i] = null;
    blobs = [];
    resultBlob = null;
    try {
      destroyFFmpegInstance();
    } catch {
      // ignore
    }
  }
}

/**
 * Nối video bằng ffmpeg.wasm trong browser → lưu Blob vào IndexedDB.
 * Thread/UI chỉ giữ tên `merged.mp4`.
 *
 * - Ưu tiên link thật (http → download-proxy)
 * - Không có / proxy fail → Blob video IndexedDB
 * - Không xếp hàng serial giữa các SP (dedup cùng key+urls nếu đang bay)
 */
export async function mergeVideosToIndexedDb(
  storageKey: string,
  urls: string[],
  options?: {
    onProgress?: (ratio: number, message: string) => void;
    slotIndices?: number[];
  }
): Promise<string> {
  const key = String(storageKey || "").trim();
  if (!key) throw new Error("Thiếu mã sản phẩm để lưu video nối");

  const clean = urls.map((u) => String(u || "").trim());
  if (clean.length < 2) throw new Error("Cần ít nhất 2 video để nối");

  const sig = urlsSignature(clean, options?.slotIndices);
  const existing = _mergeInflightByKey.get(key);
  if (existing && existing.sig === sig) {
    options?.onProgress?.(0.01, "Đang nối cùng SP...");
    return existing.promise;
  }

  const promise = (async () => {
    await runMergeVideosToIndexedDbPipeline(key, clean, options);
    return MERGED_VIDEO_FILE_NAME;
  })();

  _mergeInflightByKey.set(key, { sig, promise });

  try {
    return await promise;
  } finally {
    const cur = _mergeInflightByKey.get(key);
    if (cur?.promise === promise) {
      _mergeInflightByKey.delete(key);
    }
  }
}

/**
 * Nguồn nối: ưu tiên link thật (proxy); không có thì Blob video IDB (`__idb__`).
 */
export async function resolveMergeableVideoSources(
  item: ProductVideoKeySource,
  sessionId?: string
): Promise<{ urls: string[]; slotIndices: number[] }> {
  const urls: string[] = [];
  const slotIndices: number[] = [];
  const list = item.videoUrls || [];
  const disabled = item.videoDisabled || [];

  for (let i = 0; i < list.length; i++) {
    if (disabled[i]) continue;
    const raw = String(list[i] || "").trim();

    // 1) Link thật (http / data / blob object URL)
    if (isFetchableMediaUrl(raw)) {
      urls.push(raw);
      slotIndices.push(i);
      continue;
    }

    // 2) Không có link thật → Blob IndexedDB
    const blob = await getGeneratedVideoBlob(item, sessionId, i);
    if (blob && blob.size > 0) {
      urls.push("__idb__");
      slotIndices.push(i);
    }
  }

  return { urls, slotIndices };
}

/**
 * Hydrate list theo phiên:
 * - Video IDB gắn `sessionId::productId` → chỉ phiên đó thấy.
 * - Import mới (item trống) không kéo video phiên cũ.
 * - Phiên cũ (đã có videoUrls / merged trên thread) vẫn fallback legacy productId.
 */
export async function hydrateMergedVideoUrls<T extends ProductVideoKeySource>(
  items: T[],
  sessionId?: string
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const itemHasOwn =
        hasVariantVideoUrls(item) || hasMergedVideoRef(item.mergedVideoUrl);
      const sessionKey = getMergedVideoStorageKey(item, sessionId);
      let rec = sessionKey ? await idbGetProductVideo(sessionKey) : undefined;
      let resolvedKey = sessionKey;

      // Bản ghi cũ lưu theo productId — chỉ dùng khi item đã gen trong phiên này
      if (!rec && itemHasOwn) {
        const productKey = getProductStorageKey(item);
        if (productKey && productKey !== sessionKey) {
          rec = await idbGetProductVideo(productKey);
          if (rec) resolvedKey = productKey;
        }
      }

      // Import mới / item trống: không kéo video từ phiên khác
      if (!rec && !itemHasOwn) {
        return {
          ...item,
          videoUrls: item.videoUrls || [],
          videoDisabled: (item.videoUrls || []).map((_, idx) =>
            Boolean(item.videoDisabled?.[idx])
          ),
          mergedVideoUrl: "",
        };
      }

      // List/thread: chỉ link http(s) hoặc marker — không gắn data:/blob:
      const videoUrls = toLightThreadMediaRefs(
        rec?.videoUris?.length ? rec.videoUris : item.videoUrls || []
      );
      const videoDisabled = videoUrls.map((_, idx) => Boolean(item.videoDisabled?.[idx]));

      // Migrate legacy base64 → Blob (một lần, nền)
      if (rec && resolvedKey && (rec.mergedVideoBytes || "").trim() && !rec.mergedVideoBlob) {
        void migrateMergedBytesToBlob(resolvedKey, rec);
      }

      let hasFile = recordHasMergedBinary(rec);
      if (!hasFile) {
        for (const key of videoStorageKeysToTry(item, sessionId)) {
          const legacy = await idbGetMergedVideo(key);
          if (legacy?.blob && legacy.blob.size > 0) {
            hasFile = true;
            break;
          }
        }
      }
      if (!hasFile && item.id) {
        const legacyById = await idbGetMergedVideo(item.id);
        hasFile = Boolean(legacyById?.blob && legacyById.blob.size > 0);
      }

      // Không auto-enrich cả list khi hydrate — tránh storm download-proxy.
      // Binary được lazy-load khi merge / preview / persist sau generate.

      const prevMerged = String(item.mergedVideoUrl || "").trim();
      // Thu hồi blob URL cũ trên item (nếu hydrate từng gắn object URL)
      if (prevMerged.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevMerged);
        } catch {
          // ignore
        }
      }

      // UI/thread: chỉ marker/name — không data:/blob:
      const nextMerged = hasFile
        ? MERGED_VIDEO_FILE_NAME
        : isMergedVideoIdbMarker(prevMerged)
        ? MERGED_VIDEO_FILE_NAME
        : toLightThreadMediaRef(prevMerged);

      return {
        ...item,
        videoUrls,
        videoDisabled,
        mergedVideoUrl: nextMerged,
      };
    })
  );
}

async function migrateMergedBytesToBlob(key: string, rec: ProductVideoRecord): Promise<void> {
  try {
    const bytes = (rec.mergedVideoBytes || "").trim();
    if (!bytes) return;
    const existing = await idbGetMergedVideo(key);
    if (existing?.blob && existing.blob.size > 0) return;
    const blob = base64ToBlob(bytes, rec.mimeType || "video/mp4");
    await idbPutMergedVideo(key, blob, rec.mimeType || "video/mp4");
    await idbPutProductVideo({
      ...rec,
      mergedVideoBlob: null,
      mergedVideoBytes: null,
      mergedVideoName: rec.mergedVideoName || MERGED_VIDEO_FILE_NAME,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("[migrateMergedBytesToBlob]", err);
  }
}

/** Resolve URL xem preview theo slot (giữ index; slot trống = ""). */
export async function resolveVariantPreviewUrls(
  item: ProductVideoKeySource,
  slotCount?: number,
  sessionId?: string
): Promise<string[]> {
  const keys = videoStorageKeysToTry(item, sessionId);
  let rec: ProductVideoRecord | undefined;
  for (const key of keys) {
    rec = await idbGetProductVideo(key);
    if (rec) break;
  }
  const fromItem = item.videoUrls || [];
  const count = Math.max(slotCount || 0, rec?.videoUris?.length || 0, fromItem.length, 1);

  const materializeSlot = (i: number, previewOrUrl: string): string => {
    const p = String(previewOrUrl || "").trim();
    const mime = rec?.mimeType || "video/mp4";

    if (p.startsWith("__idb_blob__:")) {
      const blob = rec?.videoBlobList?.[i];
      if (blob && blob.size > 0) {
        try {
          return URL.createObjectURL(blob);
        } catch {
          return "";
        }
      }
      return "";
    }

    if (p.startsWith("__idb_bytes__:")) {
      const bytes = (rec?.videoBytesList?.[i] || "").trim();
      if (!bytes) return "";
      try {
        return URL.createObjectURL(base64ToBlob(bytes, mime));
      } catch {
        return "";
      }
    }

    if (p.startsWith("__idb_data__:")) {
      const raw = String(rec?.videoUris?.[i] || fromItem[i] || "").trim();
      if (isDataUrl(raw)) {
        try {
          return URL.createObjectURL(dataUrlToBlob(raw));
        } catch {
          return "";
        }
      }
      return "";
    }

    if (isDataUrl(p)) {
      try {
        return URL.createObjectURL(dataUrlToBlob(p));
      } catch {
        return "";
      }
    }

    // không đưa blob: “trôi” vào list — luôn recreate từ IDB nếu có
    if (p.startsWith("blob:")) {
      const blob = getVariantBlobAt(rec, i, mime);
      if (blob) {
        try {
          return URL.createObjectURL(blob);
        } catch {
          return "";
        }
      }
      return "";
    }

    return p;
  };

  if (rec?.videoUris?.length) {
    const previews = getVariantPreviewUrls(rec);
    return Array.from({ length: count }, (_, i) => materializeSlot(i, previews[i] || ""));
  }

  return Array.from({ length: count }, (_, i) => {
    const trimmed = String(fromItem[i] || "").trim();
    if (!trimmed) {
      const blob = getVariantBlobAt(rec, i, rec?.mimeType || "video/mp4");
      if (blob) {
        try {
          return URL.createObjectURL(blob);
        } catch {
          return "";
        }
      }
      return "";
    }
    if (isDataUrl(trimmed)) {
      try {
        return URL.createObjectURL(dataUrlToBlob(trimmed));
      } catch {
        return "";
      }
    }
    if (trimmed.startsWith("blob:")) {
      return materializeSlot(i, `__idb_blob__:${i}`);
    }
    const blob = getVariantBlobAt(rec, i, rec?.mimeType || "video/mp4");
    if (blob && blob.size > 0) {
      try {
        return URL.createObjectURL(blob);
      } catch {
        // fall through
      }
    }
    return toDownloadProxyUrl(trimmed, true);
  });
}

export async function resolveMergedPreviewUrl(
  item: ProductVideoKeySource,
  sessionId?: string
): Promise<string> {
  // Luôn tạo Object URL mới từ Blob — tránh data: quá lớn và blob: đã revoke
  const blob = await getMergedVideoBlob(item, sessionId);
  if (blob && blob.size > 0) {
    return URL.createObjectURL(blob);
  }

  const url = String(item.mergedVideoUrl || "").trim();
  if (!url || url.startsWith("blob:") || url.startsWith("data:") || isMergedVideoIdbMarker(url)) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) return toDownloadProxyUrl(url, true);
  return url;
}

/**
 * Lấy Blob video generate (variant) theo slot.
 * Dùng khi `videosPerJob === 1` — không có video nối, tải luôn file generate.
 */
export async function getGeneratedVideoBlob(
  item: ProductVideoKeySource,
  sessionId?: string,
  slotIndex = 0
): Promise<Blob | null> {
  const keys = videoStorageKeysToTry(item, sessionId);
  const idx = Math.max(0, slotIndex);

  for (const key of keys) {
    const rec = await idbGetProductVideo(key);
    if (!rec) continue;

    const blob = rec.videoBlobList?.[idx];
    if (blob && blob.size > 0) return blob;

    const bytes = (rec.videoBytesList?.[idx] || "").trim();
    if (bytes) return base64ToBlob(bytes, rec.mimeType || "video/mp4");

    const uri = String(rec.videoUris?.[idx] || "").trim();
    if (!uri) continue;
    try {
      if (uri.startsWith("data:")) return dataUrlToBlob(uri);
      if (uri.startsWith("blob:")) {
        const res = await fetch(uri);
        if (res.ok) {
          const live = await res.blob();
          if (live.size > 0) return live;
        }
      } else {
        return await uriToBlob(uri);
      }
    } catch (err) {
      console.warn("[getGeneratedVideoBlob] idb uri", err);
    }
  }

  const url = String(item.videoUrls?.[idx] || "").trim();
  if (!url) return null;
  try {
    if (url.startsWith("data:")) return dataUrlToBlob(url);
    if (url.startsWith("blob:")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const live = await res.blob();
      return live.size > 0 ? live : null;
    }
    return await uriToBlob(url);
  } catch (err) {
    console.warn("[getGeneratedVideoBlob]", err);
    return null;
  }
}

/** Lấy Blob video đã nối từ IndexedDB (Blob / base64 legacy) hoặc URL trên item. */
export async function getMergedVideoBlob(
  item: ProductVideoKeySource,
  sessionId?: string
): Promise<Blob | null> {
  const keys = videoStorageKeysToTry(item, sessionId);

  // Store riêng `merged-videos` là nguồn chính (không bị enrich ghi đè)
  for (const key of keys) {
    const primary = await idbGetMergedVideo(key);
    if (primary?.blob && primary.blob.size > 0) return primary.blob;
  }
  if (item.id && !keys.includes(item.id)) {
    const byId = await idbGetMergedVideo(item.id);
    if (byId?.blob && byId.blob.size > 0) return byId.blob;
  }

  for (const key of keys) {
    const rec = await idbGetProductVideo(key);
    if (rec?.mergedVideoBlob && rec.mergedVideoBlob.size > 0) {
      return rec.mergedVideoBlob;
    }
    if (rec?.mergedVideoBytes) {
      const blob = base64ToBlob(rec.mergedVideoBytes, rec.mimeType || "video/mp4");
      void migrateMergedBytesToBlob(key, rec);
      return blob;
    }
  }

  const url = String(item.mergedVideoUrl || "").trim();
  if (!url || isMergedVideoIdbMarker(url)) return null;
  try {
    if (url.startsWith("data:")) return dataUrlToBlob(url);
    if (url.startsWith("blob:")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const live = await res.blob();
      return live.size > 0 ? live : null;
    }
    return await uriToBlob(url);
  } catch (err) {
    console.warn("[getMergedVideoBlob]", err);
    return null;
  }
}

export async function removeMergedVideoFromIndexedDb(
  item: ProductVideoKeySource | string,
  sessionId?: string
): Promise<void> {
  if (typeof item === "string") {
    await idbDeleteProductVideo(item);
    await idbDeleteMergedVideo(item);
    return;
  }
  // Có sessionId → chỉ xóa key phiên (không đụng legacy / phiên khác cùng productId)
  const keys = sessionId
    ? [getMergedVideoStorageKey(item, sessionId)].filter(Boolean)
    : videoStorageKeysToTry(item);
  for (const key of keys) {
    const rec = await idbGetProductVideo(key);
    if (rec) {
      await idbPutProductVideo({
        ...rec,
        mergedVideoBytes: null,
        mergedVideoBlob: null,
        mergedVideoName: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await idbDeleteProductVideo(key);
    }
    await idbDeleteMergedVideo(key);
  }
  if (item.id && !keys.includes(item.id)) {
    await idbDeleteMergedVideo(item.id);
  }
}
