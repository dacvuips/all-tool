/** Client API — ưu tiên Local Agent (máy user), fallback thông báo rõ khi offline. */

import {
  clearScrapeCsvSessions,
  deleteScrapeCsvSession,
  listScrapeCsvSessions,
  saveScrapeCsvSession,
  ScrapeCsvSession,
} from "../scrape-csv-history";
import { agentFetch, probeScrapeAgent, SCRAPE_AGENT_BASE } from "./agent-client";

export type { ScrapeCsvSession };
export { SCRAPE_AGENT_BASE, probeScrapeAgent };

export type GemLoginProfileOption = {
  id: string;
  name: string;
};

async function ensureAgentOnline() {
  const st = await probeScrapeAgent(2500);
  if (!st.online) {
    throw new Error(
      st.message ||
        `Chưa thấy Local Agent (${SCRAPE_AGENT_BASE}). Mở Shopee Scrape Agent (BatDau.bat / .exe).`
    );
  }
  return st;
}

export async function fetchGemLoginStatus(): Promise<{
  online: boolean;
  apiBase: string;
  profileCount?: number;
  agentOnline?: boolean;
}> {
  const agent = await probeScrapeAgent(2500);
  if (!agent.online) {
    return {
      online: false,
      agentOnline: false,
      apiBase: SCRAPE_AGENT_BASE,
    };
  }
  const { res, json } = await agentFetch("/gemlogin-status", { method: "GET", timeoutMs: 8000 });
  if (!res.ok || !json?.ok) {
    return {
      online: false,
      agentOnline: true,
      apiBase: String(json?.apiBase || "http://127.0.0.1:1010"),
    };
  }
  return {
    online: Boolean(json.online),
    agentOnline: true,
    apiBase: String(json.apiBase || "http://127.0.0.1:1010"),
    profileCount: typeof json.profileCount === "number" ? json.profileCount : undefined,
  };
}

export async function fetchGemLoginProfiles(): Promise<GemLoginProfileOption[]> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/gemlogin-profiles", { method: "GET", timeoutMs: 15000 });
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
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/open-browser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
    timeoutMs: 120000,
  });
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

/** Xuất CSV qua Local Agent → lưu thẳng IndexedDB. */
export async function exportShopeeAffiliateCsv(input: {
  marketHost: string;
  keyword?: string;
  sortType?: number;
  maxProducts?: number;
  delayMs?: number;
  listType?: number;
  filterShopTypes?: number[];
}): Promise<ScrapeCsvSession> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/export-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 600000,
  });
  if (!res.ok || !json?.ok || !json.session) {
    throw new Error(json?.message || `Xuất CSV thất bại (${res.status})`);
  }
  const raw = json.session;
  const keyword = String(raw.keyword || "");
  return saveScrapeCsvSession({
    id: String(raw.id),
    createdAt: Number(raw.createdAt) || Date.now(),
    name: String(raw.name || keyword.trim() || "Xuất CSV"),
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
