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

export type GpmLoginProfileOption = {
  id: string;
  name: string;
  groupId?: string;
  rawProxy?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  storagePath?: string;
  browserName?: string;
  browserVersion?: string;
  os?: string;
  tags?: string[];
};

export type GpmLoginGroupOption = {
  id: string;
  name: string;
  sortOrder?: number;
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

export async function fetchGpmLoginStatus(): Promise<{
  online: boolean;
  apiBase: string;
  profileCount?: number;
  agentOnline?: boolean;
  message?: string;
}> {
  const agent = await probeScrapeAgent(2500);
  if (!agent.online) {
    return {
      online: false,
      agentOnline: false,
      apiBase: SCRAPE_AGENT_BASE,
      message:
        agent.message ||
        `Chưa thấy Local Agent (${SCRAPE_AGENT_BASE}). Mở Shopee Scrape Agent (BatDau.bat / .exe).`,
    };
  }
  const { res, json } = await agentFetch("/gpmlogin-status", { method: "GET", timeoutMs: 8000 });
  if (!res.ok || !json?.ok) {
    return {
      online: false,
      agentOnline: true,
      apiBase: String(json?.apiBase || "http://127.0.0.1:9495"),
      message: String(json?.message || "GPM Login status không OK"),
    };
  }
  return {
    online: Boolean(json.online),
    agentOnline: true,
    apiBase: String(json.apiBase || "http://127.0.0.1:9495"),
    profileCount: typeof json.profileCount === "number" ? json.profileCount : undefined,
  };
}

export async function fetchGpmLoginProfiles(input?: {
  groupId?: string;
  search?: string;
}): Promise<GpmLoginProfileOption[]> {
  await ensureAgentOnline();
  const params = new URLSearchParams();
  if (input?.groupId) params.set("group_id", input.groupId);
  if (input?.search) params.set("search", input.search);
  const qs = params.toString();
  const { res, json } = await agentFetch(`/gpmlogin-profiles${qs ? `?${qs}` : ""}`, {
    method: "GET",
    timeoutMs: 15000,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không lấy được profile GPM Login (${res.status})`);
  }
  const list = Array.isArray(json.profiles) ? json.profiles : [];
  return list.map((p: any) => ({
    id: String(p.id),
    name: String(p.name || p.id),
    groupId: p.groupId ? String(p.groupId) : undefined,
    rawProxy: p.rawProxy ? String(p.rawProxy) : undefined,
    note: p.note ? String(p.note) : undefined,
    createdAt: p.createdAt ? String(p.createdAt) : undefined,
    updatedAt: p.updatedAt ? String(p.updatedAt) : undefined,
    storagePath: p.storagePath ? String(p.storagePath) : undefined,
    browserName: p.browserName ? String(p.browserName) : undefined,
    browserVersion: p.browserVersion ? String(p.browserVersion) : undefined,
    os: p.os ? String(p.os) : undefined,
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : undefined,
  }));
}

async function gpmProfilePost<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 120000
): Promise<T> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `GPM Login thất bại (${res.status})`);
  }
  return json as T;
}

export async function startGpmLoginProfileAction(input: {
  profileId: string;
  remoteDebuggingPort?: number;
}): Promise<{ profileId: string; port: number; debugAddr: string; endpoint: string }> {
  const json = await gpmProfilePost<any>("/gpmlogin-profiles/start", {
    profileId: input.profileId,
    remoteDebuggingPort: input.remoteDebuggingPort,
  });
  return {
    profileId: String(json.profileId || input.profileId),
    port: Number(json.port) || 0,
    debugAddr: String(json.debugAddr || ""),
    endpoint: String(json.endpoint || ""),
  };
}

export async function stopGpmLoginProfileAction(profileId: string): Promise<void> {
  await gpmProfilePost("/gpmlogin-profiles/stop", { profileId }, 30000);
}

export async function probeGpmLoginRunningAction(
  items: Array<{ profileId: string; port?: number }>
): Promise<Array<{ profileId: string; running: boolean; port?: number }>> {
  if (!items.length) return [];
  const json = await gpmProfilePost<any>(
    "/gpmlogin-profiles/probe-running",
    { items },
    20000
  );
  const list = Array.isArray(json.statuses) ? json.statuses : [];
  return list.map((s: any) => ({
    profileId: String(s.profileId || ""),
    running: Boolean(s.running),
    port: typeof s.port === "number" && s.port > 0 ? s.port : undefined,
  }));
}

export async function updateGpmLoginProfileAction(input: {
  profileId: string;
  name?: string;
  groupId?: string;
  rawProxy?: string;
  note?: string;
}): Promise<GpmLoginProfileOption> {
  const json = await gpmProfilePost<any>("/gpmlogin-profiles/update", input);
  const p = json.profile || {};
  return {
    id: String(p.id || input.profileId),
    name: String(p.name || ""),
    groupId: p.groupId ? String(p.groupId) : undefined,
    rawProxy: p.rawProxy ? String(p.rawProxy) : undefined,
    note: p.note ? String(p.note) : undefined,
    createdAt: p.createdAt ? String(p.createdAt) : undefined,
    updatedAt: p.updatedAt ? String(p.updatedAt) : undefined,
    storagePath: p.storagePath ? String(p.storagePath) : undefined,
    browserName: p.browserName ? String(p.browserName) : undefined,
    browserVersion: p.browserVersion ? String(p.browserVersion) : undefined,
    os: p.os ? String(p.os) : undefined,
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : undefined,
  };
}

export async function deleteGpmLoginProfileAction(
  profileId: string,
  mode: "soft" | "hard" = "soft"
): Promise<void> {
  await gpmProfilePost("/gpmlogin-profiles/delete", { profileId, mode });
}

export async function duplicateGpmLoginProfileAction(input: {
  profileId: string;
  name?: string;
}): Promise<GpmLoginProfileOption> {
  const json = await gpmProfilePost<any>("/gpmlogin-profiles/duplicate", input);
  const p = json.profile || {};
  return {
    id: String(p.id || ""),
    name: String(p.name || ""),
    groupId: p.groupId ? String(p.groupId) : undefined,
    rawProxy: p.rawProxy ? String(p.rawProxy) : undefined,
    note: p.note ? String(p.note) : undefined,
    createdAt: p.createdAt ? String(p.createdAt) : undefined,
    updatedAt: p.updatedAt ? String(p.updatedAt) : undefined,
    storagePath: p.storagePath ? String(p.storagePath) : undefined,
    browserName: p.browserName ? String(p.browserName) : undefined,
    browserVersion: p.browserVersion ? String(p.browserVersion) : undefined,
    os: p.os ? String(p.os) : undefined,
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : undefined,
  };
}

export async function openGpmLoginProfileFolderAction(profileId: string): Promise<string> {
  const json = await gpmProfilePost<any>("/gpmlogin-profiles/open-folder", { profileId }, 30000);
  return String(json.folder || "");
}

export async function fetchGpmLoginGroups(): Promise<GpmLoginGroupOption[]> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/gpmlogin-groups", { method: "GET", timeoutMs: 15000 });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không lấy được nhóm GPM Login (${res.status})`);
  }
  const list = Array.isArray(json.groups) ? json.groups : [];
  return list.map((g: any) => ({
    id: String(g.id),
    name: String(g.name || g.id),
    sortOrder: typeof g.sortOrder === "number" ? g.sortOrder : undefined,
  }));
}

export async function createGpmLoginGroupAction(input: {
  name: string;
  sortOrder?: number;
}): Promise<GpmLoginGroupOption> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/gpmlogin-groups/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 30000,
  });
  if (!res.ok || !json?.ok || !json.group) {
    throw new Error(json?.message || `Không tạo được nhóm GPM Login (${res.status})`);
  }
  const g = json.group;
  return {
    id: String(g.id),
    name: String(g.name || input.name),
    sortOrder: typeof g.sortOrder === "number" ? g.sortOrder : undefined,
  };
}

export async function openShopeeAffiliateBrowser(input?: {
  marketHost?: string;
  gpmloginProfileId?: string;
  allowChromeFallback?: boolean;
}): Promise<{
  marketHost: string;
  offerUrl: string;
  cdpEndpoint?: string;
  source?: string;
  gpmloginProfileId?: string;
  debugAddr?: string;
  cookieCount?: number;
  profileStopped?: boolean;
}> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/open-browser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
    timeoutMs: 360000,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không mở được trình duyệt (${res.status})`);
  }
  return {
    marketHost: String(json.marketHost || input?.marketHost || ""),
    offerUrl: String(json.offerUrl || ""),
    cdpEndpoint: json.cdpEndpoint ? String(json.cdpEndpoint) : undefined,
    source: json.source ? String(json.source) : undefined,
    gpmloginProfileId: json.gpmloginProfileId ? String(json.gpmloginProfileId) : undefined,
    debugAddr: json.debugAddr ? String(json.debugAddr) : undefined,
    cookieCount: typeof json.cookieCount === "number" ? json.cookieCount : undefined,
    profileStopped: Boolean(json.profileStopped),
  };
}

/** Tạo profile GPM Login từ tài khoản (cookie + SPC_F → mở Shopee theo domain). */
export async function createGpmProfileFromUser(input: {
  profileName: string;
  domain?: string;
  cookie?: string;
  spcF?: string;
  username?: string;
  password?: string;
  proxy?: string;
  note?: string;
  groupId?: string;
  /** false = đóng browser sau khi gắn cookie (batch). Mặc định true = giữ mở. */
  keepOpen?: boolean;
}): Promise<{
  profileId: string;
  profileName: string;
  shopeeHost: string;
  homeUrl: string;
  loginUrl?: string;
  cookieCount: number;
  loggedIn?: boolean;
  loginAttempted?: boolean;
  loginSkipped?: boolean;
  savedSession?: {
    username?: string;
    password?: string;
    cookie?: string;
    spcF?: string;
    proxy?: string;
    cookieFetchedAt: string;
    cookieRemainingMs: number;
  };
  debugAddr?: string;
  cdpPort?: number;
  profileStopped?: boolean;
}> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/create-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 600000,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không tạo được profile GPM Login (${res.status})`);
  }
  return {
    profileId: String(json.profileId || ""),
    profileName: String(json.profileName || input.profileName || ""),
    shopeeHost: String(json.shopeeHost || ""),
    homeUrl: String(json.homeUrl || ""),
    loginUrl: json.loginUrl ? String(json.loginUrl) : undefined,
    cookieCount: typeof json.cookieCount === "number" ? json.cookieCount : 0,
    loggedIn: json.loggedIn === true,
    loginAttempted: json.loginAttempted === true,
    loginSkipped: json.loginSkipped === true,
    savedSession:
      json.savedSession && typeof json.savedSession === "object"
        ? {
            username: json.savedSession.username
              ? String(json.savedSession.username)
              : undefined,
            password: json.savedSession.password
              ? String(json.savedSession.password)
              : undefined,
            cookie: json.savedSession.cookie ? String(json.savedSession.cookie) : undefined,
            spcF: json.savedSession.spcF ? String(json.savedSession.spcF) : undefined,
            proxy: json.savedSession.proxy ? String(json.savedSession.proxy) : undefined,
            cookieFetchedAt: String(json.savedSession.cookieFetchedAt || ""),
            cookieRemainingMs:
              typeof json.savedSession.cookieRemainingMs === "number"
                ? json.savedSession.cookieRemainingMs
                : 0,
          }
        : undefined,
    debugAddr: json.debugAddr ? String(json.debugAddr) : undefined,
    cdpPort: typeof json.cdpPort === "number" && json.cdpPort > 0 ? json.cdpPort : undefined,
    profileStopped: Boolean(json.profileStopped),
  };
}

/** Cập nhật cookie cho profile GPM đã có (mở CDP → login nếu cần → harvest → đóng). */
export async function refreshGpmProfileCookies(input: {
  profileId: string;
  domain?: string;
  username?: string;
  password?: string;
  cookie?: string;
  spcF?: string;
  proxy?: string;
}): Promise<{
  profileId: string;
  shopeeHost: string;
  skipped: boolean;
  skipReason?: "still_logged_in" | "no_credentials";
  loggedIn: boolean;
  loginAttempted: boolean;
  cookieUpdated: boolean;
  captchaEncountered?: boolean;
  savedSession?: {
    username?: string;
    password?: string;
    cookie?: string;
    spcF?: string;
    proxy?: string;
    cookieFetchedAt: string;
    cookieRemainingMs: number;
  };
  profileStopped?: boolean;
  message?: string;
}> {
  await ensureAgentOnline();
  const { res, json } = await agentFetch("/refresh-profile-cookies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 600000,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không cập nhật được cookie profile (${res.status})`);
  }
  return {
    profileId: String(json.profileId || input.profileId),
    shopeeHost: String(json.shopeeHost || ""),
    skipped: Boolean(json.skipped),
    skipReason:
      json.skipReason === "still_logged_in" || json.skipReason === "no_credentials"
        ? json.skipReason
        : undefined,
    loggedIn: json.loggedIn === true,
    loginAttempted: json.loginAttempted === true,
    cookieUpdated: json.cookieUpdated === true,
    captchaEncountered: json.captchaEncountered === true,
    savedSession:
      json.savedSession && typeof json.savedSession === "object"
        ? {
            username: json.savedSession.username
              ? String(json.savedSession.username)
              : undefined,
            password: json.savedSession.password
              ? String(json.savedSession.password)
              : undefined,
            cookie: json.savedSession.cookie ? String(json.savedSession.cookie) : undefined,
            spcF: json.savedSession.spcF ? String(json.savedSession.spcF) : undefined,
            proxy: json.savedSession.proxy ? String(json.savedSession.proxy) : undefined,
            cookieFetchedAt: String(json.savedSession.cookieFetchedAt || ""),
            cookieRemainingMs:
              typeof json.savedSession.cookieRemainingMs === "number"
                ? json.savedSession.cookieRemainingMs
                : 0,
          }
        : undefined,
    profileStopped: Boolean(json.profileStopped),
    message: json.message ? String(json.message) : undefined,
  };
}

/** long_link → short link qua Local Agent (GraphQL batchCustomLink). */
export async function shortenAffiliateLinks(
  links: string[],
  delayMs = 800
): Promise<string[]> {
  await ensureAgentOnline();
  const clean = links.map((l) => String(l || "").trim());
  if (!clean.some(Boolean)) return clean.map(() => "");
  const timeoutMs = Math.min(600000, Math.max(90000, clean.filter(Boolean).length * 1200));
  const { res, json } = await agentFetch("/short-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ links: clean, delayMs }),
    timeoutMs,
  });
  if (!res.ok || !json?.ok) {
    throw new Error(
      json?.message ||
        "Không tạo được short link. Bấm «Mở Trình duyệt» rồi thử lại."
    );
  }
  const shorts = Array.isArray(json.shortLinks) ? json.shortLinks : [];
  return clean.map((_, i) => String(shorts[i] || ""));
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
