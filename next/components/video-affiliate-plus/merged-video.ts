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
import { mergeVideosInBrowser } from "./ffmpeg-browser";
import {
  idbDeleteMergedVideo,
  idbDeleteProductVideo,
  idbGetMergedVideo,
  idbGetProductVideo,
  idbPutMergedVideo,
  idbPutProductVideo,
  ProductVideoRecord,
} from "./idb";

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
export function hasVariantVideoUrls(item: ProductVideoKeySource): boolean {
  return (item.videoUrls || []).some((u) => String(u || "").trim());
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

/** Preview variant: ưu tiên base64 legacy → link qua proxy. Blob → resolveVariantPreviewUrls. */
export function getVariantPreviewUrls(record: ProductVideoRecord): string[] {
  const mime = record.mimeType || "video/mp4";
  return (record.videoUris || []).map((uri, idx) => {
    const bytes = record.videoBytesList?.[idx];
    if (bytes) return `data:${mime};base64,${bytes}`;
    const trimmed = String(uri || "").trim();
    if (!trimmed) return "";
    if (isDataUrl(trimmed)) return trimmed;
    // Có Blob local → placeholder; resolveVariantPreviewUrls tạo object URL
    if (record.videoBlobList?.[idx] && record.videoBlobList[idx]!.size > 0) {
      return `__idb_blob__:${idx}`;
    }
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
    if (!isHttpUrl(uri)) continue;

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
        console.warn("[enrichProductVideoBase64] QuotaExceeded — bỏ lưu variant, merge vẫn tải URL", err);
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

function resolveVariantBlobFromRecord(
  record: ProductVideoRecord | undefined,
  url: string,
  index: number,
  mime: string
): Blob | null {
  if (!record?.videoUris?.length) return null;

  let idx = record.videoUris.findIndex((u) => urlsLooselyMatch(u, url));
  if (idx < 0 && index < record.videoUris.length) {
    const sameOrderUri = String(record.videoUris[index] || "").trim();
    if (!sameOrderUri || urlsLooselyMatch(sameOrderUri, url)) idx = index;
  }
  if (idx < 0) return null;

  const blob = record.videoBlobList?.[idx];
  if (blob && blob.size > 0) return blob;

  const bytes = (record.videoBytesList?.[idx] || "").trim();
  if (bytes) return base64ToBlob(bytes, mime);
  return null;
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
 * Nối video bằng ffmpeg.wasm trong browser → lưu Blob vào IndexedDB.
 * Thread/UI chỉ giữ tên `merged.mp4`.
 *
 * - Ưu tiên Blob/base64 đã enrich trong IndexedDB (tránh URL flow2 hết hạn)
 * - Thiếu binary → tải URL (direct browser → proxy) rồi cache Blob
 * - Queue nội bộ: 1 job tại 1 lúc
 */
export async function mergeVideosToIndexedDb(
  storageKey: string,
  urls: string[],
  options?: { onProgress?: (ratio: number, message: string) => void }
): Promise<string> {
  const key = String(storageKey || "").trim();
  if (!key) throw new Error("Thiếu mã sản phẩm để lưu video nối");

  const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (clean.length < 2) throw new Error("Cần ít nhất 2 video để nối");

  options?.onProgress?.(0.02, "Đang lấy video từ IndexedDB...");

  // Enrich Blob ngầm nếu còn thiếu — không chặn cứng nếu fail (vẫn tải URL)
  let record = await idbGetProductVideo(key);
  if (!record || hasPendingVariantBase64(record)) {
    try {
      await enrichProductVideoBase64(key);
      record = await idbGetProductVideo(key);
    } catch (err) {
      console.warn("[mergeVideosToIndexedDb] enrich trước merge thất bại", err);
    }
  }

  const mime = record?.mimeType || "video/mp4";
  const blobs: Blob[] = [];
  const cachedBlobs = [...(record?.videoBlobList || [])];
  while (cachedBlobs.length < clean.length) cachedBlobs.push(null);
  let cacheDirty = false;

  for (let i = 0; i < clean.length; i++) {
    const url = clean[i];
    options?.onProgress?.(
      0.05 + (i / clean.length) * 0.2,
      `Đang lấy video ${i + 1}/${clean.length}...`
    );

    let blob = resolveVariantBlobFromRecord(record, url, i, mime);
    if (!blob) {
      try {
        blob = await uriToBlob(url);
      } catch (err: any) {
        throw new Error(
          `Không tải được video số ${i + 1} (${url.slice(0, 80)}…). Link flow2 có thể đã hết hạn và chưa kịp lưu IndexedDB — hãy generate lại.\n(${
            err?.message || err
          })`
        );
      }
    }

    if (!blob || blob.size <= 0) {
      throw new Error(`Video số ${i + 1} rỗng — hãy generate lại`);
    }

    blobs.push(blob);
    if (!cachedBlobs[i] || cachedBlobs[i]!.size <= 0) {
      cachedBlobs[i] = blob;
      cacheDirty = true;
    }
  }

  // Cache Blob nguồn (không base64) — để Nối lại không phụ thuộc flow2
  if (cacheDirty) {
    try {
      const existing = await idbGetProductVideo(key);
      await idbPutProductVideo({
        productId: key,
        videoUris: existing?.videoUris?.length ? existing.videoUris : clean,
        videoBlobList: cachedBlobs,
        // Không giữ base64 nặng song song với Blob
        videoBytesList: (existing?.videoUris || clean).map(() => null),
        mimeType: existing?.mimeType || mime,
        ...preserveMergedFields(
          existing || {
            productId: key,
            videoUris: clean,
            videoBytesList: clean.map(() => null),
            mimeType: mime,
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

  const blob = await mergeVideosInBrowser(blobs, {
    onProgress: options?.onProgress
      ? ({ ratio, message }) => options.onProgress!(0.25 + ratio * 0.75, message)
      : undefined,
  });

  const mimeType = blob.type || "video/mp4";

  /**
   * Lưu Blob vào store `merged-videos` (riêng) — không phụ thuộc product-videos.
   * Tránh race: enrich ghi đè product-videos làm mất mergedVideoBlob.
   */
  await putMergedVideoWithVerify(key, blob, mimeType);

  // Marker nhẹ trên product-videos (không nhét Blob nối vào đây)
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
    // Marker fail không sao — Blob đã nằm ở merged-videos
    console.warn("[mergeVideosToIndexedDb] product marker persist failed", err);
  }

  return MERGED_VIDEO_FILE_NAME;
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

      const videoUrls = rec?.videoUris?.length
        ? rec.videoUris.map((u) => String(u || "").trim())
        : item.videoUrls || [];
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

      if (rec && resolvedKey && hasPendingVariantBase64(rec)) {
        void enrichProductVideoBase64(resolvedKey);
      }

      const prevMerged = String(item.mergedVideoUrl || "").trim();
      // Thu hồi blob URL cũ trên item (nếu hydrate từng gắn object URL)
      if (prevMerged.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevMerged);
        } catch {
          // ignore
        }
      }

      // UI/thread: chỉ tên — giống scene chỉ lưu name
      const nextMerged = hasFile
        ? MERGED_VIDEO_FILE_NAME
        : isMergedVideoIdbMarker(prevMerged)
        ? MERGED_VIDEO_FILE_NAME
        : prevMerged.startsWith("blob:") || prevMerged.startsWith("data:")
        ? ""
        : prevMerged;

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

  if (rec?.videoUris?.length) {
    const previews = getVariantPreviewUrls(rec);
    return Array.from({ length: count }, (_, i) => {
      const p = previews[i] || "";
      if (p.startsWith("__idb_blob__:")) {
        const blob = rec!.videoBlobList?.[i];
        if (blob && blob.size > 0) {
          try {
            return URL.createObjectURL(blob);
          } catch {
            return "";
          }
        }
        return "";
      }
      return p;
    });
  }

  return Array.from({ length: count }, (_, i) => {
    const trimmed = String(fromItem[i] || "").trim();
    if (!trimmed) return "";
    if (isDataUrl(trimmed) || trimmed.startsWith("blob:")) return trimmed;
    const blob = rec?.videoBlobList?.[i];
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
