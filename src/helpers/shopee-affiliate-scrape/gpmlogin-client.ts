/**
 * Client gọi GPM Login Global local API.
 * Docs: https://api-docs.gpmloginapp.com/
 * Mặc định http://127.0.0.1:9495 — nếu port bận, app chọn 8000–10000 và ghi file http.port.
 */

import fs from "fs";
import http from "http";
import https from "https";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { URL } from "url";

const DEFAULT_PORT = 9495;

function readHttpPortFile(): number | null {
  const home = os.homedir();
  const candidates = [
    path.join(home, "AppData", "Local", "GPMLoginGlobal", "http.port"),
    path.join(home, "AppData", "Roaming", "GPMLoginGlobal", "http.port"),
    path.join(home, "AppData", "Local", "GPMLogin", "http.port"),
    path.join(home, "AppData", "Roaming", "GPMLogin", "http.port"),
    path.join("D:", "PhanMem", "tool", "GPMLoginGlobal", "http.port"),
    path.join("D:", "PhanMem", "tool", "GPMLoginGlobal", "Logs", "http.port"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const n = Number(String(fs.readFileSync(file, "utf8")).trim());
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      // ignore
    }
  }
  return null;
}

function resolveDefaultApiBase(): string {
  const fromEnv = (process.env.GPMLOGIN_API_URL || process.env.GPMLOGIN_API || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = readHttpPortFile() || DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
}

export const DEFAULT_GPMLOGIN_API = resolveDefaultApiBase();

export type GpmLoginProfile = {
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
  raw?: Record<string, unknown>;
};

export type UpdateGpmLoginProfileInput = {
  name?: string;
  groupId?: string;
  rawProxy?: string;
  note?: string;
  startupUrls?: string;
  taskBarTitle?: string;
};

export type GpmLoginGroup = {
  id: string;
  name: string;
  sortOrder?: number;
  raw?: Record<string, unknown>;
};

export type GpmLoginStartResult = {
  profileId: string;
  debugAddr: string;
  port: number;
  endpoint: string;
  browserLocation?: string;
  driverPath?: string;
  websocketUrl?: string;
};

function httpJson<T = any>(
  urlStr: string,
  options: { method?: string; timeoutMs?: number; body?: unknown } = {}
): Promise<{ status: number; json: T | null; text: string }> {
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs ?? 30000;
  const url = new URL(urlStr);
  const lib = url.protocol === "https:" ? https : http;
  const bodyText =
    options.body === undefined || options.body === null
      ? ""
      : typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (bodyText) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(bodyText));
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          text += String(c);
        });
        res.on("end", () => {
          let json: T | null = null;
          try {
            json = text ? (JSON.parse(text) as T) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`GPM Login API timeout (${timeoutMs}ms): ${urlStr}`));
    });
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

/**
 * Chuẩn hoá proxy app (host:port:user:pass) → raw_proxy GPM Login.
 * Giữ nguyên nếu đã có scheme (http://, socks5://, …).
 */
export function toGpmLoginRawProxy(raw?: string | null): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;

  const parts = s.split(":");
  if (parts.length >= 4) {
    const host = parts[0];
    const port = parts[1];
    const user = encodeURIComponent(parts[2] || "");
    const pass = encodeURIComponent(parts.slice(3).join(":"));
    return `http://${user}:${pass}@${host}:${port}`;
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `http://${parts[0]}:${parts[1]}`;
  }
  return s;
}

export type CreateGpmLoginProfileInput = {
  name: string;
  rawProxy?: string;
  startupUrls?: string;
  note?: string;
  groupId?: string;
  taskBarTitle?: string;
};

/** Tạo profile mới — POST /api/v1/profiles/create */
export async function createGpmLoginProfile(
  input: CreateGpmLoginProfileInput
): Promise<GpmLoginProfile> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Thiếu tên profile GPM Login");

  const body: Record<string, unknown> = {
    name,
    browser_type: 1,
    os_type: 1,
  };
  const rawProxy = toGpmLoginRawProxy(input.rawProxy);
  if (rawProxy) body.raw_proxy = rawProxy;
  if (input.startupUrls) body.startup_urls = String(input.startupUrls).trim();
  if (input.note) body.note = String(input.note).trim();
  if (input.groupId) body.group_id = String(input.groupId).trim();
  const taskBarTitle = String(input.taskBarTitle || name).trim();
  if (taskBarTitle) body.task_bar_title = taskBarTitle;

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/profiles/create`;
    let res;
    try {
      res = await httpJson(url, { method: "POST", body, timeoutMs: 60000 });
    } catch (err: any) {
      throw new Error(
        `Không tạo được profile GPM Login (${base}). App đang chạy? ${err?.message || ""}`.trim()
      );
    }

    const json: any = res.json;
    const ok = res.status < 400 && json?.success !== false;
    const data = json?.data && typeof json.data === "object" ? json.data : json;
    if (!ok) {
      throw new Error(
        `GPM Login tạo profile thất bại: ${
          json?.message || json?.error || data?.message || res.text || `HTTP ${res.status}`
        }`
      );
    }

    const id = String(data?.id ?? data?.profile_id ?? data?.profileId ?? "").trim();
    if (!id) {
      throw new Error("GPM Login tạo profile OK nhưng thiếu id");
    }
    return {
      id,
      name: String(data?.name || name).trim() || name,
      raw: data && typeof data === "object" ? data : undefined,
    };
  });
}

/** Parse "127.0.0.1:56170" | port | ws URL → { host, port, endpoint } */
export function parseDebugAddr(debugAddr: string): {
  host: string;
  port: number;
  endpoint: string;
} {
  const raw = String(debugAddr || "").trim();
  if (!raw) throw new Error("GPM Login không trả remote debugging address/port");

  let hostPort = raw;
  try {
    if (/^wss?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      hostPort = `${u.hostname}:${u.port}`;
    }
  } catch {
    // keep raw
  }

  const m = hostPort.match(/^([^:]+):(\d+)\s*$/);
  if (!m) {
    const portOnly = Number(hostPort);
    if (Number.isFinite(portOnly) && portOnly > 0) {
      return {
        host: "127.0.0.1",
        port: portOnly,
        endpoint: `http://127.0.0.1:${portOnly}`,
      };
    }
    throw new Error(`debug_addr không hợp lệ: ${raw}`);
  }

  const host = m[1] === "localhost" ? "127.0.0.1" : m[1];
  const port = Number(m[2]);
  return { host, port, endpoint: `http://${host}:${port}` };
}

function apiBasesToTry(): string[] {
  const bases = [DEFAULT_GPMLOGIN_API, `http://127.0.0.1:${DEFAULT_PORT}`];
  const uniq: string[] = [];
  for (const b of bases) {
    const n = b.replace(/\/$/, "");
    if (n && !uniq.includes(n)) uniq.push(n);
  }
  return uniq;
}

export async function probeGpmLoginApi(timeoutMs = 2000): Promise<boolean> {
  for (const base of apiBasesToTry()) {
    try {
      const { status, json } = await httpJson(`${base}/api/v1/profiles?page=1&page_size=1`, {
        timeoutMs,
      });
      if (status > 0 && status < 500 && (json as any)?.success !== false) return true;
    } catch {
      // try next
    }
  }
  return false;
}

function normalizeProfileList(json: any): GpmLoginProfile[] {
  // Global: { data: { data: [...] } } ; legacy flat arrays vẫn hỗ trợ
  const items: any[] = Array.isArray(json?.data?.data)
    ? json.data.data
    : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
    ? json
    : Array.isArray(json?.data?.items)
    ? json.data.items
    : Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.profiles)
    ? json.profiles
    : [];

  return items
    .map((p) => {
      const id = String(p?.id ?? p?.profile_id ?? p?.profileId ?? "").trim();
      const name = String(p?.name ?? p?.profile_name ?? p?.title ?? (id || "No Name")).trim();
      if (!id) return null;
      const groupId = String(p?.group_id ?? p?.groupId ?? "").trim() || undefined;
      const rawProxy = String(p?.raw_proxy ?? p?.rawProxy ?? p?.proxy ?? "").trim() || undefined;
      const note = String(p?.note ?? "").trim() || undefined;
      const createdAt = String(p?.created_at ?? p?.createdAt ?? "").trim() || undefined;
      const updatedAt = String(p?.updated_at ?? p?.updatedAt ?? "").trim() || undefined;
      const storagePath =
        String(p?.storage_path ?? p?.storagePath ?? p?.profile_path ?? "").trim() || undefined;
      const browser =
        p?.browser && typeof p.browser === "object" ? (p.browser as Record<string, unknown>) : null;
      const browserName = String(
        browser?.name ?? p?.browser_type ?? p?.browserType ?? ""
      ).trim();
      const browserVersion = String(
        browser?.version ?? p?.browser_version ?? p?.browserVersion ?? ""
      ).trim();
      const os = String(p?.os ?? p?.os_type ?? "").trim() || undefined;
      const tags = Array.isArray(p?.tags)
        ? p.tags.map((t: unknown) => String(t || "").trim()).filter(Boolean)
        : undefined;
      return {
        id,
        name: name || id,
        groupId,
        rawProxy,
        note,
        createdAt,
        updatedAt,
        storagePath,
        browserName: browserName || undefined,
        browserVersion: browserVersion || undefined,
        os,
        tags,
        raw: p,
      };
    })
    .filter(Boolean) as GpmLoginProfile[];
}

function normalizeGroupList(json: any): GpmLoginGroup[] {
  const items: any[] = Array.isArray(json?.data?.data)
    ? json.data.data
    : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
    ? json
    : Array.isArray(json?.groups)
    ? json.groups
    : [];

  return items
    .map((g) => {
      const id = String(g?.id ?? g?.group_id ?? "").trim();
      const name = String(g?.name ?? g?.group_name ?? "").trim();
      if (!id) return null;
      const sortOrder = Number(g?.sort_order ?? g?.sortOrder);
      return {
        id,
        name: name || id,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        raw: g,
      };
    })
    .filter(Boolean) as GpmLoginGroup[];
}

async function withResolvedBase<T>(
  run: (base: string) => Promise<T>
): Promise<T> {
  let lastErr: any;
  for (const base of apiBasesToTry()) {
    try {
      return await run(base);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Không kết nối được GPM Login Global API");
}

export async function listGpmLoginProfiles(options?: {
  page?: number;
  perPage?: number;
  search?: string;
  /** Lọc theo group_id (client-side sau khi lấy list). */
  groupId?: string;
}): Promise<GpmLoginProfile[]> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 500;
  const search = String(options?.search || "").trim();
  const groupId = String(options?.groupId || "").trim();

  return withResolvedBase(async (base) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(perPage));
    if (search) params.set("search", search);
    const url = `${base}/api/v1/profiles?${params.toString()}`;
    let res;
    try {
      res = await httpJson(url, { timeoutMs: 8000 });
    } catch (err: any) {
      throw new Error(
        `Không kết nối được GPM Login (${base}). Hãy mở app GPM Login Global. ${
          err?.message || ""
        }`.trim()
      );
    }

    if (res.status >= 400 || (res.json as any)?.success === false) {
      throw new Error(
        `GPM Login list profiles lỗi HTTP ${res.status}: ${
          (res.json as any)?.message || res.text
        }`
      );
    }

    let list = normalizeProfileList(res.json);
    if (groupId && groupId !== "all") {
      list = list.filter((p) => String(p.groupId || "") === groupId);
    }
    return list;
  });
}

/** Danh sách nhóm profile — GET /api/v1/groups */
export async function listGpmLoginGroups(options?: {
  page?: number;
  perPage?: number;
}): Promise<GpmLoginGroup[]> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 200;

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/groups?page=${page}&page_size=${perPage}`;
    let res;
    try {
      res = await httpJson(url, { timeoutMs: 8000 });
    } catch (err: any) {
      throw new Error(
        `Không lấy được nhóm GPM Login (${base}). ${err?.message || ""}`.trim()
      );
    }

    if (res.status >= 400 || (res.json as any)?.success === false) {
      throw new Error(
        `GPM Login list groups lỗi HTTP ${res.status}: ${
          (res.json as any)?.message || res.text
        }`
      );
    }

    const groups = normalizeGroupList(res.json);
    // Đưa "all" / mặc định lên đầu nếu có
    return groups.sort((a, b) => {
      const ao = a.sortOrder ?? 9999;
      const bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  });
}

/** Tạo nhóm profile — POST /api/v1/groups/create */
export async function createGpmLoginGroup(input: {
  name: string;
  sortOrder?: number;
}): Promise<GpmLoginGroup> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Thiếu tên nhóm GPM Login");

  const body: Record<string, unknown> = { name };
  if (typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)) {
    body.sort_order = input.sortOrder;
  }

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/groups/create`;
    let res;
    try {
      res = await httpJson(url, { method: "POST", body, timeoutMs: 30000 });
    } catch (err: any) {
      throw new Error(
        `Không tạo được nhóm GPM Login (${base}). ${err?.message || ""}`.trim()
      );
    }

    const json: any = res.json;
    const ok = res.status < 400 && json?.success !== false;
    const data = json?.data && typeof json.data === "object" ? json.data : json;
    if (!ok) {
      throw new Error(
        `GPM Login tạo nhóm thất bại: ${
          json?.message || json?.error || data?.message || res.text || `HTTP ${res.status}`
        }`
      );
    }

    const id = String(data?.id ?? data?.group_id ?? "").trim();
    if (!id) throw new Error("GPM Login tạo nhóm OK nhưng thiếu id");
    const sortOrder = Number(data?.sort_order ?? data?.sortOrder);
    return {
      id,
      name: String(data?.name || name).trim() || name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
      raw: data && typeof data === "object" ? data : undefined,
    };
  });
}

function extractStartDebug(data: any): {
  debugAddr: string;
  websocketUrl?: string;
  driverPath?: string;
  browserLocation?: string;
} {
  const port = Number(
    data?.remote_debugging_port ?? data?.remoteDebuggingPort ?? data?.port ?? 0
  );
  const ws = String(
    data?.websocket_debugging_url ?? data?.websocketDebuggingUrl ?? data?.ws ?? ""
  ).trim();
  const addr = String(
    data?.remote_debugging_address ??
      data?.remoteDebuggingAddress ??
      data?.debug_addr ??
      data?.debuggerAddress ??
      ""
  ).trim();

  if (Number.isFinite(port) && port > 0) {
    return {
      debugAddr: `127.0.0.1:${port}`,
      websocketUrl: ws || undefined,
      driverPath: data?.driver_path ? String(data.driver_path) : undefined,
      browserLocation: data?.browser_location ? String(data.browser_location) : undefined,
    };
  }
  if (ws) {
    const parsed = parseDebugAddr(ws);
    return {
      debugAddr: `${parsed.host}:${parsed.port}`,
      websocketUrl: ws,
      driverPath: data?.driver_path ? String(data.driver_path) : undefined,
      browserLocation: data?.browser_location ? String(data.browser_location) : undefined,
    };
  }
  if (addr) {
    const parsed = parseDebugAddr(addr);
    return {
      debugAddr: `${parsed.host}:${parsed.port}`,
      driverPath: data?.driver_path ? String(data.driver_path) : undefined,
      browserLocation: data?.browser_location ? String(data.browser_location) : undefined,
    };
  }
  throw new Error(
    "GPM Login start OK nhưng thiếu remote_debugging_port / websocket_debugging_url."
  );
}

/** Chi tiết 1 profile — GET /api/v1/profiles/{id} */
export async function getGpmLoginProfile(profileId: string): Promise<GpmLoginProfile> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GPM Login profileId");

  return withResolvedBase(async (base) => {
    const res = await httpJson(`${base}/api/v1/profiles/${encodeURIComponent(id)}`, {
      timeoutMs: 15000,
    });
    const json: any = res.json;
    const ok = res.status < 400 && json?.success !== false;
    const data = json?.data && typeof json.data === "object" ? json.data : json;
    if (!ok || !data) {
      throw new Error(
        `GPM Login get profile lỗi: ${json?.message || res.text || `HTTP ${res.status}`}`
      );
    }
    const list = normalizeProfileList({ data: { data: [data] } });
    const profile = list[0];
    if (!profile) throw new Error("GPM Login không trả dữ liệu profile");
    return profile;
  });
}

/** Cập nhật profile — POST /api/v1/profiles/update/{id} */
export async function updateGpmLoginProfile(
  profileId: string,
  input: UpdateGpmLoginProfileInput
): Promise<GpmLoginProfile> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GPM Login profileId");

  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = String(input.name).trim();
  if (input.groupId != null) body.group_id = String(input.groupId).trim();
  if (input.rawProxy != null) body.raw_proxy = toGpmLoginRawProxy(input.rawProxy);
  if (input.note != null) body.note = String(input.note);
  if (input.startupUrls != null) body.startup_urls = String(input.startupUrls).trim();
  if (input.taskBarTitle != null) body.task_bar_title = String(input.taskBarTitle).trim();

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/profiles/update/${encodeURIComponent(id)}`;
    const res = await httpJson(url, { method: "POST", body, timeoutMs: 60000 });
    const json: any = res.json;
    const ok = res.status < 400 && json?.success !== false;
    if (!ok) {
      throw new Error(
        `GPM Login cập nhật profile thất bại: ${
          json?.message || json?.error || res.text || `HTTP ${res.status}`
        }`
      );
    }
    return getGpmLoginProfile(id);
  });
}

/** Xóa profile — GET /api/v1/profiles/delete/{id}?mode=soft|hard
 * GPM trả message `1/1` = OK, `0/1` = thất bại (thường vì browser đang mở).
 * Luôn stop profile trước khi xóa.
 */
export async function deleteGpmLoginProfile(
  profileId: string,
  mode: "soft" | "hard" = "soft"
): Promise<void> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GPM Login profileId");

  // Profile đang mở → GPM trả success=false, message="0/1"
  try {
    await closeGpmLoginProfile(id);
  } catch {
    // ignore — có thể đã đóng
  }
  await new Promise((r) => setTimeout(r, 500));

  await withResolvedBase(async (base) => {
    const tryDelete = async (deleteMode: "soft" | "hard") => {
      const url = `${base}/api/v1/profiles/delete/${encodeURIComponent(id)}?mode=${deleteMode}`;
      const res = await httpJson(url, { timeoutMs: 30000 });
      const json: any = res.json;
      const ok = res.status < 400 && json?.success !== false;
      return { ok, json, res };
    };

    let result = await tryDelete(mode);
    if (!result.ok) {
      // Retry: stop lại rồi xóa soft
      try {
        await closeGpmLoginProfile(id);
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 800));
      result = await tryDelete(mode);
    }

    // Soft vẫn fail → thử hard (xóa hẳn)
    if (!result.ok && mode === "soft") {
      result = await tryDelete("hard");
    }

    if (!result.ok) {
      const rawMsg = String(result.json?.message || result.json?.error || result.res.text || "").trim();
      const hint =
        rawMsg === "0/1"
          ? "Không xóa được (0/1) — đóng browser profile trong GPM Login rồi thử lại"
          : rawMsg || `HTTP ${result.res.status}`;
      throw new Error(`GPM Login xóa profile thất bại: ${hint}`);
    }
  });
}

/** Nhân bản profile (lấy chi tiết → tạo mới). */
export async function duplicateGpmLoginProfile(
  profileId: string,
  newName?: string
): Promise<GpmLoginProfile> {
  const source = await getGpmLoginProfile(profileId);
  const name = String(newName || `${source.name} (copy)`).trim();
  return createGpmLoginProfile({
    name,
    groupId: source.groupId,
    rawProxy: source.rawProxy,
    note: source.note,
    taskBarTitle: name,
  });
}

export async function startGpmLoginProfile(
  profileId: string,
  options?: {
    winPos?: string;
    winSize?: string;
    additionalArgs?: string;
    remoteDebuggingPort?: number;
  }
): Promise<GpmLoginStartResult> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GPM Login profileId");

  // Global docs: window_pos / window_size / addition_args
  const params = new URLSearchParams();
  if (options?.winPos) params.set("window_pos", options.winPos);
  if (options?.winSize) params.set("window_size", options.winSize);
  if (options?.additionalArgs) params.set("addition_args", options.additionalArgs);
  if (options?.remoteDebuggingPort && options.remoteDebuggingPort > 0) {
    params.set("remote_debugging_port", String(options.remoteDebuggingPort));
  }
  params.set("skip_proxy_check", "true");

  const qs = params.toString();

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/profiles/start/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;

    let res;
    try {
      res = await httpJson(url, { timeoutMs: 60000 });
    } catch (err: any) {
      throw new Error(
        `Không start được GPM Login profile. App GPM Login đang chạy? ${err?.message || ""}`.trim()
      );
    }

    const json: any = res.json;
    const ok = res.status < 400 && json?.success !== false;
    const data = json?.data && typeof json.data === "object" ? json.data : json;

    if (!ok) {
      const msg =
        json?.message || json?.error || data?.message || res.text || `HTTP ${res.status}`;
      // Profile đang mở — Global trả cached start result
      try {
        const extracted = extractStartDebug(data || {});
        const parsed = parseDebugAddr(extracted.debugAddr);
        return {
          profileId: String(data?.profile_id ?? id),
          debugAddr: extracted.debugAddr,
          port: parsed.port,
          endpoint: parsed.endpoint,
          browserLocation: extracted.browserLocation,
          driverPath: extracted.driverPath,
          websocketUrl: extracted.websocketUrl,
        };
      } catch {
        throw new Error(`GPM Login start thất bại: ${msg}`);
      }
    }

    const extracted = extractStartDebug(data);
    const parsed = parseDebugAddr(extracted.debugAddr);
    return {
      profileId: String(data?.profile_id ?? id),
      debugAddr: extracted.debugAddr,
      port: parsed.port,
      endpoint: parsed.endpoint,
      browserLocation: extracted.browserLocation,
      driverPath: extracted.driverPath,
      websocketUrl: extracted.websocketUrl,
    };
  });
}

/** Đóng browser profile (Global: /profiles/stop/{id}). */
export async function closeGpmLoginProfile(profileId: string): Promise<void> {
  const id = String(profileId || "").trim();
  if (!id) return;
  let lastErr: any;
  for (const base of apiBasesToTry()) {
    try {
      const res = await httpJson(`${base}/api/v1/profiles/stop/${encodeURIComponent(id)}`, {
        timeoutMs: 15000,
      });
      const json: any = res.json;
      // GPM thường trả success=true kể cả khi profile đã đóng
      if (res.status < 400 && json?.success !== false) return;
      lastErr = new Error(json?.message || res.text || `HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    throw new Error(
      `Không đóng được profile GPM Login: ${lastErr?.message || lastErr}`
    );
  }
}

/** Kiểm tra CDP port còn sống (profile đang mở). */
export async function probeGpmLoginCdpPort(
  port: number,
  timeoutMs = 1200
): Promise<boolean> {
  const p = Number(port);
  if (!Number.isFinite(p) || p <= 0) return false;
  try {
    const { probeCdpEndpoint } = await import("./open-chrome");
    return await probeCdpEndpoint(p, timeoutMs);
  } catch {
    return false;
  }
}

export async function probeGpmLoginRunningStatuses(
  items: Array<{ profileId: string; port?: number }>
): Promise<Array<{ profileId: string; running: boolean; port?: number }>> {
  const out: Array<{ profileId: string; running: boolean; port?: number }> = [];
  for (const item of items) {
    const profileId = String(item.profileId || "").trim();
    if (!profileId) continue;
    const port = Number(item.port) || 0;
    if (port > 0) {
      const alive = await probeGpmLoginCdpPort(port, 1000);
      out.push({ profileId, running: alive, port: alive ? port : undefined });
    } else {
      out.push({ profileId, running: false });
    }
  }
  return out;
}

/** Lấy raw_proxy của profile. */
export async function getGpmLoginRawProxy(profileId: string): Promise<string> {
  const id = String(profileId || "").trim();
  if (!id) return "";

  for (const base of apiBasesToTry()) {
    try {
      const res = await httpJson(`${base}/api/v1/profiles/${encodeURIComponent(id)}`, {
        timeoutMs: 8000,
      });
      if (res.status >= 400) continue;
      const data: any = (res.json as any)?.data ?? res.json;
      const proxy = String(data?.raw_proxy ?? data?.rawProxy ?? data?.proxy ?? "").trim();
      if (proxy) return proxy;
    } catch {
      // try next
    }
  }

  try {
    const list = await listGpmLoginProfiles();
    const found = list.find((p) => p.id === id);
    return String(
      (found?.raw as any)?.raw_proxy ?? (found?.raw as any)?.rawProxy ?? ""
    ).trim();
  } catch {
    return "";
  }
}

export async function getGpmLoginStatus(): Promise<{
  online: boolean;
  apiBase: string;
  profileCount?: number;
}> {
  for (const base of apiBasesToTry()) {
    try {
      const { status, json } = await httpJson(`${base}/api/v1/profiles?page=1&page_size=1`, {
        timeoutMs: 2000,
      });
      if (status > 0 && status < 500 && (json as any)?.success !== false) {
        try {
          const profiles = await listGpmLoginProfiles();
          return { online: true, apiBase: base, profileCount: profiles.length };
        } catch {
          return { online: true, apiBase: base };
        }
      }
    } catch {
      // try next
    }
  }
  return { online: false, apiBase: DEFAULT_GPMLOGIN_API };
}

function resolveGpmProfileFolder(storagePath: string): string | null {
  const key = String(storagePath || "").trim();
  if (!key) return null;
  if (path.isAbsolute(key) && fs.existsSync(key)) return key;

  const home = os.homedir();
  const candidates = [
    path.join(home, "AppData", "Local", "GPMLoginGlobal", "profiles", key),
    path.join(home, "AppData", "Roaming", "GPMLoginGlobal", "profiles", key),
    path.join(home, "AppData", "Local", "GPMLogin", "profiles", key),
    path.join(home, "AppData", "Roaming", "GPMLogin", "profiles", key),
    path.join("D:", "PhanMem", "tool", "GPMLoginGlobal", "profiles", key),
  ];
  for (const folder of candidates) {
    if (fs.existsSync(folder)) return folder;
  }
  return null;
}

/** Mở thư mục dữ liệu profile trên máy local (Windows/macOS/Linux). */
export async function openGpmLoginProfileFolder(profileId: string): Promise<string> {
  const profile = await getGpmLoginProfile(profileId);
  const folder = resolveGpmProfileFolder(profile.storagePath || profile.id);
  if (!folder) {
    throw new Error(
      `Không tìm thấy thư mục profile (${profile.storagePath || profile.id}). Kiểm tra GPM Login đã cài đặt.`
    );
  }

  await new Promise<void>((resolve, reject) => {
    if (process.platform === "win32") {
      execFile("explorer.exe", [folder], (err) => (err ? reject(err) : resolve()));
      return;
    }
    if (process.platform === "darwin") {
      execFile("open", [folder], (err) => (err ? reject(err) : resolve()));
      return;
    }
    execFile("xdg-open", [folder], (err) => (err ? reject(err) : resolve()));
  });

  return folder;
}
