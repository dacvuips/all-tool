/**
 * URL hiển thị list/UI: chỉ http(s) hoặc blob: object URL.
 * Media binary: IndexedDB + ref `__idb_media__:` (xem media-blob-store).
 */
import { isMediaBlobRef, toDisplayMediaSrc, toDisplayMediaSrcList } from "./media-blob-store";

export { isMediaBlobRef, toDisplayMediaSrc as toListMediaSrc, toDisplayMediaSrcList as toListMediaSrcList };

/**
 * Tham chiếu media trên thread/list item: chỉ http(s), marker IDB, tên file.
 * Loại blob:/data: (binary nằm IndexedDB).
 */
export function toLightThreadMediaRef(url: string | null | undefined): string {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return "";
  return s;
}

export function toLightThreadMediaRefs(urls: Array<string | null | undefined>): string[] {
  return urls.map((u) => toLightThreadMediaRef(u));
}
