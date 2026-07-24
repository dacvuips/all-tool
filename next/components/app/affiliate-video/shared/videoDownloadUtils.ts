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

/** HTTP(S) URL ngoài origin → download-proxy (tránh CORS khi preview / fetch). */
export function toDownloadProxyUrl(url: string, inline = false): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith(DOWNLOAD_PROXY_PATH)) {
    return trimmed;
  }
  if (!isHttpUrl(trimmed)) {
    return trimmed;
  }
  if (typeof window !== "undefined") {
    try {
      if (new URL(trimmed).origin === window.location.origin) {
        return trimmed;
      }
    } catch {
      return trimmed;
    }
  }
  const params = new URLSearchParams({ url: trimmed });
  if (inline) {
    params.set("inline", "1");
  }
  return `${DOWNLOAD_PROXY_PATH}?${params.toString()}`;
}

/** Fetch HTTP(S) URL as Blob.
 * Flow2 / media host không CORS → ưu tiên download-proxy.
 * Host khác: thử direct trước, fail thì fallback proxy.
 */
async function fetchHttpUriAsBlob(url: string): Promise<Blob> {
  const preferProxy = shouldPreferDownloadProxy(url);

  const tryProxy = async (): Promise<Blob> => {
    const proxyUrl = toDownloadProxyUrl(url);
    const proxyRes = await fetch(proxyUrl);
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
    const res = await fetch(url, { credentials: "omit", mode: "cors" });
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

/** Resolve a remote or data URI to a Blob. Data URIs are parsed locally. */
export async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith("data:")) {
    return dataUrlToBlob(uri);
  }
  return fetchHttpUriAsBlob(uri);
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
