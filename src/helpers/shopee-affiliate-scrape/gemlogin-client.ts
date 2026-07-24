/**
 * Client gọi GemLogin Desktop local API (mặc định http://localhost:1010).
 * Giống PeeCrawl: list / start / close profile → lấy remote_debugging_address.
 */

import http from "http";
import https from "https";
import { URL } from "url";

export const DEFAULT_GEMLOGIN_API = (
  process.env.GEMLOGIN_API_URL ||
  process.env.GEMLOGIN_API ||
  "http://127.0.0.1:1010"
).replace(/\/$/, "");

export type GemLoginProfile = {
  id: string;
  name: string;
  raw?: Record<string, unknown>;
};

export type GemLoginStartResult = {
  profileId: string;
  debugAddr: string;
  port: number;
  endpoint: string;
  browserLocation?: string;
  driverPath?: string;
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
      reject(new Error(`GemLogin API timeout (${timeoutMs}ms): ${urlStr}`));
    });
    req.end();
  });
}

/** Parse "127.0.0.1:56170" → { host, port, endpoint } */
export function parseDebugAddr(debugAddr: string): {
  host: string;
  port: number;
  endpoint: string;
} {
  const raw = String(debugAddr || "").trim();
  if (!raw) throw new Error("GemLogin không trả remote_debugging_address");

  // ws://127.0.0.1:56170/devtools/... → lấy host:port
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
    // chỉ port?
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

export async function probeGemLoginApi(timeoutMs = 2000): Promise<boolean> {
  try {
    const { status } = await httpJson(`${DEFAULT_GEMLOGIN_API}/api/profiles`, {
      timeoutMs,
    });
    // 200 hoặc 401/403 vẫn nghĩa là API sống
    return status > 0 && status < 500;
  } catch {
    return false;
  }
}

function normalizeProfileList(json: any): GemLoginProfile[] {
  const items: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.items)
    ? json.data.items
    : Array.isArray(json?.data?.data)
    ? json.data.data
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
    .filter(Boolean) as GemLoginProfile[];
}

export async function listGemLoginProfiles(options?: {
  page?: number;
  perPage?: number;
}): Promise<GemLoginProfile[]> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 500;
  const url = `${DEFAULT_GEMLOGIN_API}/api/profiles?page=${page}&per_page=${perPage}`;

  let res;
  try {
    res = await httpJson(url, { timeoutMs: 8000 });
  } catch (err: any) {
    throw new Error(
      `Không kết nối được GemLogin (${DEFAULT_GEMLOGIN_API}). Hãy mở app GemLogin Desktop. ${
        err?.message || ""
      }`.trim()
    );
  }

  if (res.status >= 400) {
    throw new Error(
      `GemLogin list profiles lỗi HTTP ${res.status}: ${(res.json as any)?.message || res.text}`
    );
  }

  return normalizeProfileList(res.json);
}

export async function startGemLoginProfile(
  profileId: string,
  options?: { winPos?: string; winSize?: string; additionalArgs?: string }
): Promise<GemLoginStartResult> {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("Thiếu GemLogin profileId");

  const params = new URLSearchParams();
  if (options?.winPos) params.set("win_pos", options.winPos);
  if (options?.winSize) params.set("win_size", options.winSize);
  if (options?.additionalArgs) params.set("addination_args", options.additionalArgs);
  // Typo `addination_args` là đúng theo docs GemLogin

  const qs = params.toString();
  const url = `${DEFAULT_GEMLOGIN_API}/api/profiles/start/${encodeURIComponent(id)}${
    qs ? `?${qs}` : ""
  }`;

  let res;
  try {
    res = await httpJson(url, { timeoutMs: 60000 });
  } catch (err: any) {
    throw new Error(
      `Không start được GemLogin profile. App GemLogin đang chạy? ${err?.message || ""}`.trim()
    );
  }

  const json: any = res.json;
  const ok = res.status < 400 && (json?.success !== false);
  if (!ok) {
    const msg =
      json?.message ||
      json?.error ||
      json?.data?.message ||
      res.text ||
      `HTTP ${res.status}`;
    // Profile đang mở — thử lấy debug addr nếu có
    const maybeAddr =
      json?.data?.remote_debugging_address ||
      json?.remote_debugging_address ||
      json?.data?.debug_addr;
    if (maybeAddr) {
      const parsed = parseDebugAddr(String(maybeAddr));
      return {
        profileId: id,
        debugAddr: `${parsed.host}:${parsed.port}`,
        port: parsed.port,
        endpoint: parsed.endpoint,
        browserLocation: json?.data?.browser_location,
        driverPath: json?.data?.driver_path,
      };
    }
    throw new Error(`GemLogin start thất bại: ${msg}`);
  }

  const data = json?.data && typeof json.data === "object" ? json.data : json;
  const debugAddr = String(
    data?.remote_debugging_address ||
      data?.remoteDebuggingAddress ||
      data?.debug_addr ||
      data?.debuggerAddress ||
      ""
  ).trim();

  if (!debugAddr) {
    throw new Error(
      "GemLogin start OK nhưng thiếu remote_debugging_address. Cập nhật GemLogin / kiểm tra API."
    );
  }

  const parsed = parseDebugAddr(debugAddr);
  return {
    profileId: String(data?.profile_id ?? id),
    debugAddr: `${parsed.host}:${parsed.port}`,
    port: parsed.port,
    endpoint: parsed.endpoint,
    browserLocation: data?.browser_location ? String(data.browser_location) : undefined,
    driverPath: data?.driver_path ? String(data.driver_path) : undefined,
  };
}

export async function closeGemLoginProfile(profileId: string): Promise<void> {
  const id = String(profileId || "").trim();
  if (!id) return;
  const url = `${DEFAULT_GEMLOGIN_API}/api/profiles/close/${encodeURIComponent(id)}`;
  try {
    await httpJson(url, { timeoutMs: 15000 });
  } catch {
    // ignore
  }
}

/** Lấy raw_proxy của profile (PeeCrawl: gemlogin_get_raw_proxy). */
export async function getGemLoginRawProxy(profileId: string): Promise<string> {
  const id = String(profileId || "").trim();
  if (!id) return "";

  // 1) Chi tiết profile
  try {
    const res = await httpJson(`${DEFAULT_GEMLOGIN_API}/api/profile/${encodeURIComponent(id)}`, {
      timeoutMs: 8000,
    });
    const data: any = (res.json as any)?.data ?? res.json;
    const proxy = String(data?.raw_proxy ?? data?.rawProxy ?? data?.proxy ?? "").trim();
    if (proxy) return proxy;
  } catch {
    // ignore
  }

  // 2) Fallback từ list
  try {
    const list = await listGemLoginProfiles();
    const found = list.find((p) => p.id === id);
    const proxy = String(
      (found?.raw as any)?.raw_proxy ?? (found?.raw as any)?.rawProxy ?? ""
    ).trim();
    return proxy;
  } catch {
    return "";
  }
}

export async function getGemLoginStatus(): Promise<{
  online: boolean;
  apiBase: string;
  profileCount?: number;
}> {
  const online = await probeGemLoginApi();
  if (!online) {
    return { online: false, apiBase: DEFAULT_GEMLOGIN_API };
  }
  try {
    const profiles = await listGemLoginProfiles();
    return { online: true, apiBase: DEFAULT_GEMLOGIN_API, profileCount: profiles.length };
  } catch {
    return { online: true, apiBase: DEFAULT_GEMLOGIN_API };
  }
}
