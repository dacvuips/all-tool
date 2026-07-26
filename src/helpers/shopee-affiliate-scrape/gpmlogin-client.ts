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
  options: { method?: string; timeoutMs?: number } = {}
): Promise<{ status: number; json: T | null; text: string }> {
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs ?? 30000;
  const url = new URL(urlStr);
  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: { Accept: "application/json" },
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
    req.end();
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
      return { id, name: name || id, raw: p };
    })
    .filter(Boolean) as GpmLoginProfile[];
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
}): Promise<GpmLoginProfile[]> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 500;

  return withResolvedBase(async (base) => {
    const url = `${base}/api/v1/profiles?page=${page}&page_size=${perPage}`;
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

    return normalizeProfileList(res.json);
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

export async function startGpmLoginProfile(
  profileId: string,
  options?: { winPos?: string; winSize?: string; additionalArgs?: string }
): Promise<GpmLoginStartResult> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GPM Login profileId");

  // Global docs: window_pos / window_size / addition_args
  const params = new URLSearchParams();
  if (options?.winPos) params.set("window_pos", options.winPos);
  if (options?.winSize) params.set("window_size", options.winSize);
  if (options?.additionalArgs) params.set("addition_args", options.additionalArgs);
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
  for (const base of apiBasesToTry()) {
    try {
      await httpJson(`${base}/api/v1/profiles/stop/${encodeURIComponent(id)}`, {
        timeoutMs: 15000,
      });
      return;
    } catch {
      // try next
    }
  }
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
