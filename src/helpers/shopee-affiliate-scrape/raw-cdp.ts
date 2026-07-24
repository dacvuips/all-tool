/**
 * CDP thuần qua WebSocket (không Playwright) — lấy cookie / navigate.
 * Quan trọng: phải gắn PAGE target (không dùng browser-level WS cho Page.navigate).
 */

import http from "http";

type WsInstance = {
  readyState: number;
  on(event: string, cb: (...args: any[]) => void): void;
  send(data: string): void;
  close(): void;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket = require("ws") as {
  new (url: string): WsInstance;
  OPEN: number;
};

export type CdpCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

function httpGetJson(url: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        text += c;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(text || "{}"));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`CDP HTTP timeout: ${url}`));
    });
  });
}

async function listCdpTargets(port: number): Promise<any[]> {
  try {
    const tabs = await httpGetJson(`http://127.0.0.1:${port}/json/list`);
    return Array.isArray(tabs) ? tabs : [];
  } catch {
    try {
      const tabs = await httpGetJson(`http://127.0.0.1:${port}/json`);
      return Array.isArray(tabs) ? tabs : [];
    } catch {
      return [];
    }
  }
}

function pickPageWs(list: any[], preferredHost?: string): string | null {
  const pages = list.filter((t) => t?.type === "page" && t?.webSocketDebuggerUrl);
  const host = String(preferredHost || "").toLowerCase();

  if (host) {
    const matchHost = pages.find((t) => {
      try {
        return new URL(String(t.url || "")).hostname.toLowerCase() === host;
      } catch {
        return false;
      }
    });
    if (matchHost?.webSocketDebuggerUrl) return String(matchHost.webSocketDebuggerUrl);
  }

  const shopee =
    pages.find((t) => /affiliate\.shopee\./i.test(String(t.url || ""))) ||
    pages.find((t) => /shopee\./i.test(String(t.url || "")));
  if (shopee?.webSocketDebuggerUrl) return String(shopee.webSocketDebuggerUrl);

  const httpPage = pages.find((t) => /^https?:/i.test(String(t.url || ""))) || pages[0];
  return httpPage?.webSocketDebuggerUrl ? String(httpPage.webSocketDebuggerUrl) : null;
}

/** Ưu tiên page WS; fallback browser WS (sẽ attach target sau). */
export async function resolveCdpEndpoints(
  port: number,
  preferredHost?: string
): Promise<{
  pageWsUrl: string | null;
  browserWsUrl: string | null;
}> {
  const list = await listCdpTargets(port);
  const pageWsUrl = pickPageWs(list, preferredHost);
  let browserWsUrl: string | null = null;
  try {
    const version = await httpGetJson(`http://127.0.0.1:${port}/json/version`);
    browserWsUrl = String(version?.webSocketDebuggerUrl || "").trim() || null;
  } catch {
    // ignore
  }
  return { pageWsUrl, browserWsUrl };
}

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
};

export class RawCdpClient {
  private ws: WsInstance | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  /** sessionId khi attach flatten từ browser target */
  private sessionId: string | null = null;

  static async connect(port: number, startUrl?: string, preferredHost?: string): Promise<RawCdpClient> {
    const deadline = Date.now() + 20000;
    let lastErr: Error | null = null;
    let host = preferredHost || "";
    if (!host && startUrl) {
      try {
        host = new URL(startUrl).hostname;
      } catch {
        // ignore
      }
    }

    while (Date.now() < deadline) {
      try {
        const { pageWsUrl, browserWsUrl } = await resolveCdpEndpoints(port, host);

        // 1) Có page WS → dùng trực tiếp (Page.navigate hoạt động)
        if (pageWsUrl) {
          const client = new RawCdpClient();
          await client.open(pageWsUrl);
          return client;
        }

        // 2) Chỉ có browser WS → create/attach page target
        if (browserWsUrl) {
          const client = new RawCdpClient();
          await client.open(browserWsUrl);
          await client.attachOrCreatePage(startUrl || "about:blank");
          return client;
        }

        lastErr = new Error(`Chưa có CDP target trên port ${port}`);
      } catch (err: any) {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
      await new Promise<void>((r) => setTimeout(r, 500));
    }

    throw lastErr || new Error(`Không kết nối CDP port ${port}`);
  }

  /** Mở WebSocket CDP (page hoặc browser). */
  open(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      const timer = setTimeout(() => {
        reject(new Error("CDP WebSocket connect timeout"));
        try {
          ws.close();
        } catch {
          // ignore
        }
      }, 15000);

      ws.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
      ws.on("message", (data) => {
        let msg: any;
        try {
          msg = JSON.parse(String(data));
        } catch {
          return;
        }
        if (msg.id == null) return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          p.resolve(msg.result);
        }
      });
      ws.on("close", () => {
        this.pending.forEach((p) => {
          p.reject(new Error("CDP WebSocket closed"));
        });
        this.pending.clear();
        this.ws = null;
      });
    });
  }

  /**
   * Trên browser-level WS: tạo/gắn page target với flatten session
   * để gọi được Page.* / Runtime.*
   */
  private async attachOrCreatePage(url: string): Promise<void> {
    await this.sendRaw("Target.setDiscoverTargets", { discover: true }).catch((): undefined => undefined);

    let targetId = "";
    try {
      const { targetInfos } = await this.sendRaw("Target.getTargets");
      const pages = Array.isArray(targetInfos)
        ? targetInfos.filter((t: any) => t?.type === "page")
        : [];
      const preferred =
        pages.find((t: any) => /^https?:/i.test(String(t.url || ""))) || pages[0];
      if (preferred?.targetId) targetId = String(preferred.targetId);
    } catch {
      // ignore
    }

    if (!targetId) {
      const created = await this.sendRaw("Target.createTarget", { url: url || "about:blank" });
      targetId = String(created?.targetId || "");
    }
    if (!targetId) {
      throw new Error("Không tạo/gắn được page target CDP");
    }

    const attached = await this.sendRaw("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    this.sessionId = String(attached?.sessionId || "") || null;
    if (!this.sessionId) {
      throw new Error("attachToTarget không trả sessionId");
    }
  }

  /** Gửi không kèm sessionId (Target.* trên browser). */
  private sendRaw(method: string, params?: Record<string, unknown>): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP chưa kết nối"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  send(method: string, params?: Record<string, unknown>): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP chưa kết nối"));
    }
    const id = this.nextId++;
    const payload: Record<string, unknown> = {
      id,
      method,
      params: params || {},
    };
    if (this.sessionId) payload.sessionId = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(payload));
    });
  }

  async navigate(url: string, waitMs = 2000): Promise<void> {
    await this.send("Page.enable").catch((): undefined => undefined);
    await this.send("Page.navigate", { url });
    await new Promise<void>((r) => setTimeout(r, waitMs));
  }

  /** Trạng thái trang hiện tại — dùng để bắt login / sai origin. */
  async getPageAuthState(expectedHost: string): Promise<{
    href: string;
    host: string;
    readyState: string;
    cookieNames: string[];
    hasSpcEc: boolean;
    looksLikeLogin: boolean;
    onExpectedHost: boolean;
  }> {
    const hostJson = JSON.stringify(expectedHost);
    return this.evaluateJson(`(() => {
      const expectedHost = ${hostJson};
      const href = String(location.href || "");
      const host = String(location.hostname || "").toLowerCase();
      const cookie = String(document.cookie || "");
      const names = cookie.split(";").map(s => s.trim().split("=")[0]).filter(Boolean);
      const path = String(location.pathname || "").toLowerCase();
      const looksLikeLogin =
        /login|signin|authenticate|buyer\\/login|seller\\/login/i.test(href + path) ||
        !!document.querySelector('input[type="password"]');
      return {
        href,
        host,
        readyState: String(document.readyState || ""),
        cookieNames: names,
        hasSpcEc: names.some(n => n === "SPC_EC" || n === "SPC_ST" || n === "SPC_F"),
        looksLikeLogin,
        onExpectedHost: host === expectedHost,
      };
    })()`);
  }

  /** Đảm bảo đang ở đúng host Affiliate và (cố gắng) đã login. */
  async ensureAffiliateReady(offerUrl: string, waitMs = 8000): Promise<void> {
    let expectedHost = "affiliate.shopee.vn";
    try {
      expectedHost = new URL(offerUrl).hostname.toLowerCase();
    } catch {
      // ignore
    }

    const state0 = await this.getPageAuthState(expectedHost).catch((): null => null);
    if (!state0?.onExpectedHost) {
      await this.navigate(offerUrl, 4000);
    }

    const deadline = Date.now() + waitMs;
    let last: Awaited<ReturnType<RawCdpClient["getPageAuthState"]>> | null = null;
    while (Date.now() < deadline) {
      last = await this.getPageAuthState(expectedHost);
      if (last.onExpectedHost && !last.looksLikeLogin && last.readyState !== "loading") {
        // Cho antibot/SDK thêm chút thời gian
        await new Promise<void>((r) => setTimeout(r, 1500));
        return;
      }
      await new Promise<void>((r) => setTimeout(r, 700));
    }

    last = last || (await this.getPageAuthState(expectedHost));
    if (last.looksLikeLogin || !last.hasSpcEc) {
      throw new Error(
        `Chưa login Affiliate trên GemLogin (url=${last.href}, cookies=${last.cookieNames.slice(0, 12).join(",") || "none"}). Đăng nhập trên cửa sổ GemLogin, F5 product_offer, rồi bấm Mở Trình duyệt lại.`
      );
    }
  }

  async getAllCookies(): Promise<CdpCookie[]> {
    // Network.getAllCookies hoạt động cả browser/page; thử page session trước
    try {
      await this.send("Network.enable").catch((): undefined => undefined);
      const result = await this.send("Network.getAllCookies");
      if (Array.isArray(result?.cookies)) return result.cookies;
    } catch {
      // fallback browser-level không session
    }
    try {
      const result = await this.sendRaw("Network.getAllCookies");
      return Array.isArray(result?.cookies) ? result.cookies : [];
    } catch {
      return [];
    }
  }

  async getUserAgent(): Promise<string> {
    try {
      const r = await this.send("Runtime.evaluate", {
        expression: "navigator.userAgent",
        returnByValue: true,
      });
      return String(r?.result?.value || "");
    } catch {
      return "";
    }
  }

  async getLocalStorage(): Promise<Record<string, string>> {
    try {
      const r = await this.send("Runtime.evaluate", {
        expression: `(() => {
          const out = {};
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k != null) out[k] = String(localStorage.getItem(k) || "");
            }
          } catch (e) {}
          return out;
        })()`,
        returnByValue: true,
      });
      const val = r?.result?.value;
      return val && typeof val === "object" ? (val as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /**
   * Chạy async JS trong page (awaitPromise) — dùng fetch credentials:include
   * để request đi trong browser GemLogin (tránh 403 axios từ Node).
   */
  async evaluateJson<T = any>(expression: string, timeoutMs = 60000): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: timeoutMs,
    });
    if (result?.exceptionDetails) {
      const msg =
        result.exceptionDetails?.exception?.description ||
        result.exceptionDetails?.text ||
        "Runtime.evaluate lỗi";
      throw new Error(String(msg));
    }
    return result?.result?.value as T;
  }

  /**
   * Đặt kích thước/vị trí cửa sổ Chrome qua Browser domain.
   * Cần kết nối browser-level WS (không phải page WS).
   */
  async setWindowBounds(bounds: {
    width: number;
    height: number;
    left?: number;
    top?: number;
  }): Promise<void> {
    const width = Math.max(100, Math.floor(bounds.width));
    const height = Math.max(100, Math.floor(bounds.height));
    const left = Math.floor(bounds.left ?? 0);
    const top = Math.floor(bounds.top ?? 0);

    const win = await this.sendRaw("Browser.getWindowForTarget", {});
    const windowId = win?.windowId;
    if (windowId == null) {
      throw new Error("Browser.getWindowForTarget không trả windowId");
    }
    await this.sendRaw("Browser.setWindowBounds", {
      windowId,
      bounds: {
        left,
        top,
        width,
        height,
        windowState: "normal",
      },
    });
  }

  close(): void {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
    this.sessionId = null;
  }
}

/** Kích thước cửa sổ GemLogin mặc định khi mở CDP. */
export const CDP_WINDOW_SIZE = { width: 400, height: 400, left: 0, top: 0 } as const;

/**
 * Ép resize cửa sổ Chrome qua CDP browser WS.
 * Dùng khi GemLogin `win_size` bị bỏ qua (profile đã mở sẵn).
 */
export async function setCdpWindowBounds(
  port: number,
  bounds: {
    width: number;
    height: number;
    left?: number;
    top?: number;
  } = CDP_WINDOW_SIZE
): Promise<boolean> {
  let browserWsUrl = "";
  try {
    const version = await httpGetJson(`http://127.0.0.1:${port}/json/version`);
    browserWsUrl = String(version?.webSocketDebuggerUrl || "").trim();
  } catch {
    return false;
  }
  if (!browserWsUrl) return false;

  const client = new RawCdpClient();
  try {
    await client.open(browserWsUrl);
    await client.setWindowBounds(bounds);
    return true;
  } catch {
    return false;
  } finally {
    client.close();
  }
}

/** Lọc cookie liên quan Shopee / Affiliate. */
export function filterShopeeCookies(cookies: CdpCookie[], marketHost: string): CdpCookie[] {
  const host = marketHost.toLowerCase();
  const mall = host.replace(/^affiliate\./, "");
  return cookies.filter((c) => {
    const d = String(c.domain || "")
      .replace(/^\./, "")
      .toLowerCase();
    if (!d) return false;
    return (
      d === host ||
      d.endsWith(host) ||
      d === mall ||
      d.endsWith(mall) ||
      d.includes("shopee") ||
      d.includes("susercontent")
    );
  });
}

export function cookiesToHeader(cookies: CdpCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
