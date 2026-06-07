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

/** Resolve a remote or data URI to a Blob. Data URIs are parsed locally. */
export async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith("data:")) {
    return dataUrlToBlob(uri);
  }
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  return res.blob();
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
