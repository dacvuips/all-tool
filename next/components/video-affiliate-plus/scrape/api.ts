/** Client API — mở browser + sync CSV từ extension. */

import {
  clearScrapeCsvSessions,
  deleteScrapeCsvSession,
  listScrapeCsvSessions,
  saveScrapeCsvSession,
  ScrapeCsvSession,
} from "../scrape-csv-history";

export type { ScrapeCsvSession };

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function openShopeeAffiliateBrowser(marketHost?: string): Promise<{
  marketHost: string;
  offerUrl: string;
  openedOnServer: boolean;
}> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/open-browser", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(marketHost ? { marketHost } : {}),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không mở được trình duyệt (${res.status})`);
  }
  const offerUrl = String(json.offerUrl || "");
  // Luôn mở trên máy user (nơi có extension). Server spawn Chrome chỉ khi API chạy local.
  if (offerUrl && typeof window !== "undefined") {
    window.open(offerUrl, "_blank", "noopener,noreferrer");
  }
  return {
    marketHost: String(json.marketHost || marketHost || ""),
    offerUrl,
    openedOnServer: Boolean(json.openedOnServer),
  };
}

export async function downloadShopeeExtensionPackage(): Promise<void> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/extension-package", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const json = await parseJson(res);
    throw new Error(json?.message || `Không tải được extension (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shopee-affiliate-bridge.zip";
  a.click();
  URL.revokeObjectURL(url);
}

/** Poll server → lưu phiên mới vào IndexedDB video-affiliate-manager. */
export async function syncExtensionCsvToIdb(): Promise<ScrapeCsvSession[]> {
  const existing = await listScrapeCsvSessions();
  const knownIds = existing.map((s) => s.id);
  const res = await fetch(
    `/api/app/scrape-shopee-affiliate/extension-pending?knownIds=${encodeURIComponent(knownIds.join(","))}`,
    { method: "GET", credentials: "include" }
  );
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Sync lỗi (${res.status})`);
  }

  const incoming = Array.isArray(json.sessions) ? json.sessions : [];
  const savedIds: string[] = [];
  for (const raw of incoming) {
    const session = await saveScrapeCsvSession({
      id: String(raw.id),
      createdAt: Number(raw.createdAt) || Date.now(),
      keyword: String(raw.keyword || ""),
      marketHost: String(raw.marketHost || ""),
      marketCode: String(raw.marketCode || ""),
      productCount: Number(raw.productCount) || 0,
      csv: String(raw.csv || ""),
      durationMs: Number(raw.durationMs) || 0,
    });
    savedIds.push(session.id);
  }

  if (savedIds.length) {
    await fetch("/api/app/scrape-shopee-affiliate/extension-ack", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: savedIds }),
    }).catch(() => undefined);
  }

  return listScrapeCsvSessions();
}

export async function loadScrapeCsvSessions(): Promise<ScrapeCsvSession[]> {
  return listScrapeCsvSessions();
}

export async function removeScrapeCsvSession(id: string): Promise<ScrapeCsvSession[]> {
  await deleteScrapeCsvSession(id);
  return listScrapeCsvSessions();
}

export async function removeAllScrapeCsvSessions(): Promise<void> {
  await clearScrapeCsvSessions();
}

export function downloadCsvText(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
