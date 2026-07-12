/**
 * Persist video kết quả theo mã sản phẩm:
 * 1) Lưu link vào IndexedDB ngay
 * 2) Hiển thị qua download-proxy
 * 3) Chạy ngầm fetch → base64 → ghi lại IndexedDB
 * (Cùng pattern affiliate-video `persistGeneratedVideoWithEnrichment`)
 */
import { fetchUrlToBase64Payload } from "../app/affiliate-video/shared/generatedMediaUtils";
import {
  base64ToBlob,
  dataUrlToBlob,
  toDownloadProxyUrl,
  uriToBlob,
} from "../app/affiliate-video/shared/videoDownloadUtils";
import { extractShopeeProductId } from "./csv-parser";
import {
  idbDeleteMergedVideo,
  idbDeleteProductVideo,
  idbGetMergedVideo,
  idbGetMergedVideoObjectUrl,
  idbGetProductVideo,
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

export function getMergedVideoStorageKey(item: ProductVideoKeySource): string {
  const fromField = String(item.productId || "").trim();
  if (fromField) return fromField;
  const fromLink = extractShopeeProductId(item.productLink || "");
  if (fromLink) return fromLink;
  return String(item.id || "").trim();
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function isDataUrl(url: string): boolean {
  return String(url || "").trim().startsWith("data:");
}

/** Preview variant: ưu tiên base64, fallback link qua proxy. Giữ index slot. */
export function getVariantPreviewUrls(record: ProductVideoRecord): string[] {
  const mime = record.mimeType || "video/mp4";
  return (record.videoUris || []).map((uri, idx) => {
    const bytes = record.videoBytesList?.[idx];
    if (bytes) return `data:${mime};base64,${bytes}`;
    const trimmed = String(uri || "").trim();
    if (!trimmed) return "";
    if (isDataUrl(trimmed)) return trimmed;
    return toDownloadProxyUrl(trimmed, true);
  });
}

export function getMergedPreviewUrl(record: ProductVideoRecord): string {
  if (record.mergedVideoBytes) {
    return `data:${record.mimeType || "video/mp4"};base64,${record.mergedVideoBytes}`;
  }
  return "";
}

export function hasPendingVariantBase64(record: ProductVideoRecord): boolean {
  return (record.videoUris || []).some((uri, idx) => {
    if (!isHttpUrl(uri)) return false;
    return !(record.videoBytesList?.[idx] || "").trim();
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
      // Giữ base64 cũ nếu cùng URL
      if (existing?.videoUris?.[idx] === uri && existing.videoBytesList?.[idx]) {
        return existing.videoBytesList[idx];
      }
      return null;
    }),
    mimeType,
    mergedVideoBytes: existing?.mergedVideoBytes || null,
    updatedAt: Date.now(),
  };
  await idbPutProductVideo(record);
  return record;
}

/** Bước 2 (ngầm): chuyển từng link → base64 và ghi lại IDB. */
export async function enrichProductVideoBase64(
  productId: string,
  options?: { onUpdate?: (record: ProductVideoRecord) => void }
): Promise<ProductVideoRecord | undefined> {
  const key = String(productId || "").trim();
  if (!key) return undefined;

  const current = await idbGetProductVideo(key);
  if (!current || !hasPendingVariantBase64(current)) return current;

  const videoBytesList = [...(current.videoBytesList || [])];
  while (videoBytesList.length < current.videoUris.length) {
    videoBytesList.push(null);
  }

  let changed = false;
  for (let i = 0; i < current.videoUris.length; i++) {
    if ((videoBytesList[i] || "").trim()) continue;
    const uri = current.videoUris[i];
    if (!isHttpUrl(uri)) continue;
    const fetched = await fetchUrlToBase64Payload(uri, current.mimeType || "video/mp4");
    if (!fetched?.bytes) continue;
    videoBytesList[i] = fetched.bytes;
    changed = true;
    const partial: ProductVideoRecord = {
      ...current,
      videoBytesList: [...videoBytesList],
      mimeType: fetched.mimeType || current.mimeType,
      updatedAt: Date.now(),
    };
    await idbPutProductVideo(partial);
    options?.onUpdate?.(partial);
  }

  if (!changed) return current;
  const enriched: ProductVideoRecord = {
    ...current,
    videoBytesList,
    updatedAt: Date.now(),
  };
  await idbPutProductVideo(enriched);
  options?.onUpdate?.(enriched);
  return enriched;
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Nối video (ffmpeg API) → hiện blob URL ngay → ngầm lưu base64 vào IndexedDB.
 */
export async function mergeVideosToIndexedDb(
  storageKey: string,
  urls: string[],
  options?: { onBase64Ready?: (dataUrl: string) => void }
): Promise<string> {
  const key = String(storageKey || "").trim();
  if (!key) throw new Error("Thiếu mã sản phẩm để lưu video nối");

  const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (clean.length < 2) throw new Error("Cần ít nhất 2 video để nối");

  const res = await fetch("/api/app/merge-videos/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: clean }),
  });

  if (!res.ok) {
    let message = `Nối video thất bại (${res.status})`;
    try {
      const json = await res.json();
      if (json?.message) message = String(json.message);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const mimeType = blob.type || "video/mp4";
  const objectUrl = URL.createObjectURL(blob);

  // Ngầm: blob → base64 → IndexedDB (cùng record product)
  void (async () => {
    try {
      const bytes = await blobToBase64(blob);
      if (!bytes) return;
      const existing = await idbGetProductVideo(key);
      const record: ProductVideoRecord = {
        productId: key,
        videoUris: existing?.videoUris || clean,
        videoBytesList: existing?.videoBytesList || clean.map(() => null),
        mimeType,
        mergedVideoBytes: bytes,
        updatedAt: Date.now(),
      };
      await idbPutProductVideo(record);
      options?.onBase64Ready?.(`data:${mimeType};base64,${bytes}`);
    } catch (err) {
      console.warn("[mergeVideosToIndexedDb] base64 persist failed", err);
    }
  })();

  return objectUrl;
}

export async function hydrateMergedVideoUrls<T extends ProductVideoKeySource>(
  items: T[]
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const key = getMergedVideoStorageKey(item);
      const rec = key ? await idbGetProductVideo(key) : undefined;

      // Giữ http link trên item (UI); base64 chỉ nằm trong IndexedDB — giữ index slot
      const videoUrls = rec?.videoUris?.length
        ? rec.videoUris.map((u) => String(u || "").trim())
        : item.videoUrls || [];
      const videoDisabled = videoUrls.map((_, idx) => Boolean(item.videoDisabled?.[idx]));
      let mergedUrl = "";
      if (rec?.mergedVideoBytes) {
        const blob = base64ToBlob(rec.mergedVideoBytes, rec.mimeType || "video/mp4");
        mergedUrl = URL.createObjectURL(blob);
      } else {
        // Legacy blob store
        mergedUrl =
          (key ? await idbGetMergedVideoObjectUrl(key) : "") ||
          (item.id && item.id !== key ? await idbGetMergedVideoObjectUrl(item.id) : "");
      }

      // Resume enrich nền nếu còn link chưa base64
      if (rec && hasPendingVariantBase64(rec)) {
        void enrichProductVideoBase64(key);
      }

      if (item.mergedVideoUrl?.startsWith("blob:") && mergedUrl && item.mergedVideoUrl !== mergedUrl) {
        try {
          URL.revokeObjectURL(item.mergedVideoUrl);
        } catch {
          // ignore
        }
      }

      return {
        ...item,
        videoUrls,
        videoDisabled,
        mergedVideoUrl: mergedUrl || "",
      };
    })
  );
}

/** Resolve URL xem preview theo slot (giữ index; slot trống = ""). */
export async function resolveVariantPreviewUrls(
  item: ProductVideoKeySource,
  slotCount?: number
): Promise<string[]> {
  const key = getMergedVideoStorageKey(item);
  const rec = key ? await idbGetProductVideo(key) : undefined;
  const fromItem = item.videoUrls || [];
  const count = Math.max(
    slotCount || 0,
    rec?.videoUris?.length || 0,
    fromItem.length,
    1
  );

  if (rec?.videoUris?.length) {
    const fromRec = getVariantPreviewUrls(rec);
    return Array.from({ length: count }, (_, i) => fromRec[i] || "");
  }

  return Array.from({ length: count }, (_, i) => {
    const trimmed = String(fromItem[i] || "").trim();
    if (!trimmed) return "";
    if (isDataUrl(trimmed) || trimmed.startsWith("blob:")) return trimmed;
    return toDownloadProxyUrl(trimmed, true);
  });
}

export async function resolveMergedPreviewUrl(item: ProductVideoKeySource): Promise<string> {
  const key = getMergedVideoStorageKey(item);
  const rec = key ? await idbGetProductVideo(key) : undefined;
  if (rec?.mergedVideoBytes) return getMergedPreviewUrl(rec);
  if (item.mergedVideoUrl) return item.mergedVideoUrl;
  if (key) return (await idbGetMergedVideoObjectUrl(key)) || "";
  return "";
}

/** Lấy Blob video đã nối từ IndexedDB (base64 / legacy) hoặc URL trên item. */
export async function getMergedVideoBlob(
  item: ProductVideoKeySource
): Promise<Blob | null> {
  const key = getMergedVideoStorageKey(item);
  const rec = key ? await idbGetProductVideo(key) : undefined;
  if (rec?.mergedVideoBytes) {
    return base64ToBlob(rec.mergedVideoBytes, rec.mimeType || "video/mp4");
  }

  const legacy = key ? await idbGetMergedVideo(key) : undefined;
  if (legacy?.blob) return legacy.blob;
  if (item.id && item.id !== key) {
    const legacyById = await idbGetMergedVideo(item.id);
    if (legacyById?.blob) return legacyById.blob;
  }

  const url = String(item.mergedVideoUrl || "").trim();
  if (!url) return null;
  try {
    if (url.startsWith("data:")) return dataUrlToBlob(url);
    return await uriToBlob(url);
  } catch (err) {
    console.warn("[getMergedVideoBlob]", err);
    return null;
  }
}

export async function removeMergedVideoFromIndexedDb(
  item: ProductVideoKeySource | string
): Promise<void> {
  if (typeof item === "string") {
    await idbDeleteProductVideo(item);
    await idbDeleteMergedVideo(item);
    return;
  }
  const key = getMergedVideoStorageKey(item);
  if (key) {
    await idbDeleteProductVideo(key);
    await idbDeleteMergedVideo(key);
  }
  if (item.id && item.id !== key) {
    await idbDeleteProductVideo(item.id);
    await idbDeleteMergedVideo(item.id);
  }
}
