/** Client API — GemLogin local → CDP + CSV sessions (IndexedDB). */

import {
  clearScrapeCsvSessions,
  deleteScrapeCsvSession,
  listScrapeCsvSessions,
  saveScrapeCsvSession,
  ScrapeCsvSession,
} from "../scrape-csv-history";

export type { ScrapeCsvSession };

export type GemLoginProfileOption = {
  id: string;
  name: string;
};

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGemLoginStatus(): Promise<{
  online: boolean;
  apiBase: string;
  profileCount?: number;
}> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/gemlogin-status", {
    method: "GET",
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `GemLogin status lỗi (${res.status})`);
  }
  return {
    online: Boolean(json.online),
    apiBase: String(json.apiBase || "http://127.0.0.1:1010"),
    profileCount: typeof json.profileCount === "number" ? json.profileCount : undefined,
  };
}

export async function fetchGemLoginProfiles(): Promise<GemLoginProfileOption[]> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/gemlogin-profiles", {
    method: "GET",
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không lấy được profile GemLogin (${res.status})`);
  }
  const list = Array.isArray(json.profiles) ? json.profiles : [];
  return list.map((p: any) => ({
    id: String(p.id),
    name: String(p.name || p.id),
  }));
}

export async function openShopeeAffiliateBrowser(input?: {
  marketHost?: string;
  gemloginProfileId?: string;
  allowChromeFallback?: boolean;
}): Promise<{
  marketHost: string;
  offerUrl: string;
  cdpEndpoint?: string;
  source?: string;
  gemloginProfileId?: string;
  debugAddr?: string;
  cookieCount?: number;
  profileStopped?: boolean;
}> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/open-browser", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không mở được trình duyệt (${res.status})`);
  }
  return {
    marketHost: String(json.marketHost || input?.marketHost || ""),
    offerUrl: String(json.offerUrl || ""),
    cdpEndpoint: json.cdpEndpoint ? String(json.cdpEndpoint) : undefined,
    source: json.source ? String(json.source) : undefined,
    gemloginProfileId: json.gemloginProfileId ? String(json.gemloginProfileId) : undefined,
    debugAddr: json.debugAddr ? String(json.debugAddr) : undefined,
    cookieCount: typeof json.cookieCount === "number" ? json.cookieCount : undefined,
    profileStopped: Boolean(json.profileStopped),
  };
}

/** Xuất CSV qua GemLogin CDP → lưu thẳng IndexedDB (không qua extension). */
export async function exportShopeeAffiliateCsv(input: {
  marketHost: string;
  keyword?: string;
  sortType?: number;
  maxProducts?: number;
  delayMs?: number;
  listType?: number;
  filterShopTypes?: number[];
}): Promise<ScrapeCsvSession> {
  const res = await fetch("/api/app/scrape-shopee-affiliate/export-csv", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok || !json.session) {
    throw new Error(json?.message || `Xuất CSV thất bại (${res.status})`);
  }
  const raw = json.session;
  const keyword = String(raw.keyword || "");
  return saveScrapeCsvSession({
    id: String(raw.id),
    createdAt: Number(raw.createdAt) || Date.now(),
    name: keyword.trim() || "Xuất CSV",
    keyword,
    marketHost: String(raw.marketHost || ""),
    marketCode: String(raw.marketCode || ""),
    productCount: Number(raw.productCount) || 0,
    csv: String(raw.csv || ""),
    durationMs: Number(raw.durationMs) || 0,
  });
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
