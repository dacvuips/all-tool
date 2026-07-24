/**
 * Proxy helper — dùng axios proxy config (không phụ thuộc https-proxy-agent).
 */
export type ProxyParts = {
  host: string;
  port: number;
  username?: string;
  password?: string;
};

export function parseProxyString(raw?: string): ProxyParts | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length < 2) return null;
  const host = parts[0];
  const port = Number(parts[1]);
  if (!host || !Number.isFinite(port)) return null;
  return {
    host,
    port,
    username: parts[2] || undefined,
    password: parts.slice(3).join(":") || undefined,
  };
}

/** Axios 0.21 proxy option */
export function toAxiosProxy(raw?: string):
  | false
  | {
      host: string;
      port: number;
      auth?: { username: string; password: string };
    } {
  const p = parseProxyString(raw);
  if (!p) return false;
  if (p.username || p.password) {
    return {
      host: p.host,
      port: p.port,
      auth: {
        username: p.username || "",
        password: p.password || "",
      },
    };
  }
  return { host: p.host, port: p.port };
}
