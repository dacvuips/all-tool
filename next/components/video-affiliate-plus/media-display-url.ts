/**
 * URL hiển thị list/UI: chỉ http(s) hoặc blob: object URL.
 * Không nhét data: base64 khổng lồ vào DOM/React state (lặp theo từng hàng).
 */
import { dataUrlToBlob } from "../app/affiliate-video/shared/videoDownloadUtils";

/** Cache data: → blob: (fingerprint tránh giữ full base64 làm key map khi có thể). */
const objectUrlByFingerprint = new Map<string, string>();

function fingerprintMediaRef(u: string): string {
  const len = u.length;
  if (len < 240) return u;
  return `${len}:${u.slice(0, 96)}:${u.slice(-48)}`;
}

/** Link nhẹ cho thẻ img/video UI — data: chuyển 1 lần sang blob:. */
export function toListMediaSrc(src: string | null | undefined): string {
  const u = String(src || "").trim();
  if (!u) return "";
  if (u.startsWith("blob:") || u.startsWith("http://") || u.startsWith("https://")) {
    return u;
  }
  if (u.startsWith("data:")) {
    const fp = fingerprintMediaRef(u);
    const hit = objectUrlByFingerprint.get(fp);
    if (hit) return hit;
    try {
      const obj = URL.createObjectURL(dataUrlToBlob(u));
      objectUrlByFingerprint.set(fp, obj);
      return obj;
    } catch {
      return "";
    }
  }
  // marker / path ngắn giữ nguyên cho logic khác; list ảnh không dùng
  return u;
}

export function toListMediaSrcList(urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const url of urls) {
    const light = toListMediaSrc(url);
    if (light) out.push(light);
  }
  return out;
}

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
