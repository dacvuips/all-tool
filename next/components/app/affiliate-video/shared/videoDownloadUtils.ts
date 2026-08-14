/** Decode base64 string to Blob (no network). */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType });
}

/** Parse a data: URL into a Blob without fetch (avoids CSP connect-src blocks). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL");
  }
  const header = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:([^;,]+)/);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";

  if (header.includes(";base64")) {
    return base64ToBlob(payload, mimeType);
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

const DOWNLOAD_PROXY_PATH = "/api/file/download-proxy";

/** Host media thường không gửi CORS — fetch thẳng từ browser sẽ fail. */
const PREFER_PROXY_HOST_SUFFIXES = [
  "flow2.viettheo.site",
  "flow-content.google",
  "viettheo.site",
];

/** Cùng URL: 1 request dang dở được share (enrich + merge + preview). */
const _uriBlobInflight = new Map<string, Promise<Blob>>();

/** 404/410 cache ngắn — tránh storm retry proxy cùng link chết. */
const _uriBlobFailCache = new Map<string, { until: number; error: Error }>();
const FAIL_CACHE_TTL_MS = 60_000;

/** OuterHTML / copy-paste hay biến `&` thành `&amp;` — decode lại trước khi parse. */
function decodeHtmlAmpersands(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#x0*26;/gi, "&");
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldPreferDownloadProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PREFER_PROXY_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

/** HTTP 404/410 / link hết hạn — retry không giúp. */
export function isNonRetryableMediaFetchError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err || "");
  return (
    /HTTP\s*404|HTTP\s*410/i.test(msg) ||
    /Upstream HTTP\s*404|Upstream HTTP\s*410/i.test(msg) ||
    /proxy\s*404|proxy\s*410/i.test(msg) ||
    /không còn tồn tại/i.test(msg) ||
    /không tồn tại hoặc đã hết hạn/i.test(msg) ||
    /Video URL không còn tồn tại/i.test(msg)
  );
}

/**
 * HTTP(S) URL ngoài origin → download-proxy (tránh CORS khi preview / fetch).
 * Luôn build `?...&inline=1` với `&` thật (URLSearchParams). Không dùng `&amp;`.
 * Nếu truyền sẵn path proxy (có thể dính &amp;), normalize lại.
 */
export function toDownloadProxyUrl(url: string, inline = false): string {
  const raw = decodeHtmlAmpersands(String(url || "").trim());
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  // Đã là proxy (relative hoặc absolute cùng path)
  const proxyPathIdx = raw.indexOf(DOWNLOAD_PROXY_PATH);
  if (proxyPathIdx >= 0) {
    try {
      const absolute =
        raw.startsWith("http://") || raw.startsWith("https://")
          ? raw
          : `http://local.invalid${raw.startsWith("/") ? "" : "/"}${raw}`;
      const parsed = new URL(absolute);
      const target = decodeHtmlAmpersands(parsed.searchParams.get("url") || "");
      if (target && isHttpUrl(target)) {
        const wantInline =
          inline ||
          parsed.searchParams.get("inline") === "1" ||
          parsed.searchParams.get("inline") === "true";
        const params = new URLSearchParams();
        params.set("url", target);
        if (wantInline) params.set("inline", "1");
        return `${DOWNLOAD_PROXY_PATH}?${params.toString()}`;
      }
    } catch {
      // fall through
    }
    // path-only already proxy — return decoded ampersands form
    return raw.startsWith("http") ? raw : raw.slice(proxyPathIdx);
  }

  if (!isHttpUrl(raw)) {
    return raw;
  }
  if (typeof window !== "undefined") {
    try {
      if (new URL(raw).origin === window.location.origin) {
        return raw;
      }
    } catch {
      return raw;
    }
  }
  const params = new URLSearchParams();
  params.set("url", raw);
  if (inline) {
    params.set("inline", "1");
  }
  // URLSearchParams luôn join bằng `&` (không phải &amp;)
  return `${DOWNLOAD_PROXY_PATH}?${params.toString()}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch HTTP(S) URL as Blob (không dedupe — chỉ gọi qua fetchHttpUriAsBlobDeduped). */
async function fetchHttpUriAsBlobOnce(url: string): Promise<Blob> {
  const preferProxy = shouldPreferDownloadProxy(url);

  const tryProxy = async (): Promise<Blob> => {
    const proxyUrl = toDownloadProxyUrl(url);
    const proxyRes = await fetchWithTimeout(proxyUrl);
    if (proxyRes.ok) {
      return proxyRes.blob();
    }

    let detail = "";
    try {
      const json = await proxyRes.json();
      if (json?.details) detail = `: ${json.details}`;
      else if (json?.error) detail = `: ${json.error}`;
    } catch {
      // ignore
    }
    throw new Error(`Không tải được video (proxy ${proxyRes.status})${detail}`);
  };

  if (preferProxy) {
    return tryProxy();
  }

  // Direct browser fetch — CDN/cookie thực tế
  try {
    const res = await fetchWithTimeout(url, { credentials: "omit", mode: "cors" });
    if (res.ok) {
      return res.blob();
    }
    if (res.status === 404 || res.status === 410) {
      throw new Error(`Video URL không còn tồn tại (HTTP ${res.status})`);
    }
  } catch (err: any) {
    if (/không còn tồn tại|HTTP 404|HTTP 410/i.test(String(err?.message || ""))) {
      throw err;
    }
    // CORS / network → thử proxy
  }

  return tryProxy();
}

async function fetchHttpUriAsBlob(url: string): Promise<Blob> {
  const key = String(url || "").trim();
  if (!key) throw new Error("Thiếu URL video");

  const cachedFail = _uriBlobFailCache.get(key);
  if (cachedFail && cachedFail.until > Date.now()) {
    throw cachedFail.error;
  }

  const inflight = _uriBlobInflight.get(key);
  if (inflight) return inflight;

  const promise = fetchHttpUriAsBlobOnce(key)
    .then((blob) => {
      _uriBlobFailCache.delete(key);
      return blob;
    })
    .catch((err) => {
      if (isNonRetryableMediaFetchError(err)) {
        const error = err instanceof Error ? err : new Error(String(err));
        _uriBlobFailCache.set(key, { until: Date.now() + FAIL_CACHE_TTL_MS, error });
      }
      throw err;
    })
    .finally(() => {
      _uriBlobInflight.delete(key);
    });

  _uriBlobInflight.set(key, promise);
  return promise;
}

/** Resolve a remote or data/blob URI to a Blob. Data URIs are parsed locally. */
export async function uriToBlob(uri: string): Promise<Blob> {
  const trimmed = String(uri || "").trim();
  if (!trimmed) throw new Error("Thiếu URI video");

  if (trimmed.startsWith("data:")) {
    return dataUrlToBlob(trimmed);
  }

  if (trimmed.startsWith("blob:")) {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(`Blob URL không còn hiệu lực (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    if (!blob || blob.size <= 0) {
      throw new Error("Blob URL rỗng");
    }
    return blob;
  }

  return fetchHttpUriAsBlob(trimmed);
}

/** Trigger a browser file download from a Blob. */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
