/**
 * Nối video qua API rồi lưu Blob vào IndexedDB (theo itemId).
 */
import { idbDeleteMergedVideo, idbGetMergedVideoObjectUrl, idbPutMergedVideo } from "./idb";

export async function mergeVideosToIndexedDb(
  itemId: string,
  urls: string[]
): Promise<string> {
  const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (clean.length < 2) {
    throw new Error("Cần ít nhất 2 video để nối");
  }

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
  await idbPutMergedVideo(itemId, blob, blob.type || "video/mp4");
  return URL.createObjectURL(blob);
}

export async function hydrateMergedVideoUrls<T extends { id: string; mergedVideoUrl?: string }>(
  items: T[]
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const url = await idbGetMergedVideoObjectUrl(item.id);
      if (!url) return item;
      if (item.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
      return { ...item, mergedVideoUrl: url };
    })
  );
}

export async function removeMergedVideoFromIndexedDb(itemId: string): Promise<void> {
  await idbDeleteMergedVideo(itemId);
}
