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

  /**
   * Gắn cookie vào browser profile qua CDP (Network.setCookie).
   * `domainHost` = shopee.vn / shopee.ph / … (không có dấu chấm đầu).
   */
  async setCookiesForHost(
    domainHost: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<number> {
    const host = String(domainHost || "")
      .trim()
      .replace(/^\.+/, "")
      .toLowerCase();
    if (!host) return 0;
    const url = `https://${host}/`;
    const cookieDomain = `.${host}`;
    const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    await this.send("Network.enable").catch((): undefined => undefined);

    let applied = 0;
    const sorted = cookies.slice().sort((a, b) => {
      const aSpc = /^SPC_F$/i.test(a.name) ? 0 : 1;
      const bSpc = /^SPC_F$/i.test(b.name) ? 0 : 1;
      return aSpc - bSpc;
    });
    for (const c of sorted) {
      const name = String(c.name || "").trim();
      const value = String(c.value ?? "");
      if (!name) continue;
      try {
        const result = await this.send("Network.setCookie", {
          url,
          name,
          value,
          domain: cookieDomain,
          path: "/",
          secure: true,
          expires,
        });
        if (result?.success !== false) applied += 1;
      } catch {
        try {
          const result = await this.send("Network.setCookie", {
            url,
            name,
            value,
            path: "/",
            secure: true,
            expires,
          });
          if (result?.success !== false) applied += 1;
        } catch {
          // bỏ cookie không set được
        }
      }
    }
    return applied;
  }

  /** Trạng thái trang hiện tại — dùng để bắt login / sai origin. */
  async getPageAuthState(expectedHost: string): Promise<{
    href: string;
    host: string;
    readyState: string;
    cookieNames: string[];
    /** document.cookie — thường thiếu SPC_EC/SPC_ST (HttpOnly). Chỉ dùng phụ. */
    hasSpcEc: boolean;
    looksLikeLogin: boolean;
    /** User đang focus / gõ form login (hoặc captcha iframe) — không được navigate cắt ngang. */
    userInteracting: boolean;
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

      const active = document.activeElement;
      const tag = String(active && active.tagName ? active.tagName : "").toLowerCase();
      const focusedOnForm =
        !!active &&
        active !== document.body &&
        active !== document.documentElement &&
        (tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          tag === "button" ||
          tag === "iframe" ||
          !!(active).isContentEditable);

      let hasTypedValue = false;
      try {
        const inputs = document.querySelectorAll(
          'input[type="password"], input[type="text"], input[type="tel"], input[type="email"], input:not([type])'
        );
        for (let i = 0; i < inputs.length; i++) {
          const el = inputs[i];
          if (String(el.value || "").trim().length > 0) {
            hasTypedValue = true;
            break;
          }
        }
      } catch (e) {}

      const userInteracting = focusedOnForm || hasTypedValue;
      return {
        href,
        host,
        readyState: String(document.readyState || ""),
        cookieNames: names,
        hasSpcEc: names.some(n => n === "SPC_EC" || n === "SPC_ST"),
        looksLikeLogin,
        userInteracting,
        onExpectedHost: host === expectedHost,
      };
    })()`);
  }

  /** SPC_EC/SPC_ST thường HttpOnly — phải đọc qua CDP Network.getAllCookies, không dùng document.cookie. */
  async hasCdpAuthCookies(): Promise<boolean> {
    try {
      const cookies = await this.getAllCookies();
      return cookieJarHasAffiliateAuth(cookies);
    } catch {
      return false;
    }
  }

  /**
   * Đảm bảo đang ở đúng host Affiliate và đã login.
   * Nếu gặp trang login: chờ user đăng nhập trên cửa sổ GPM (mặc định vài phút), không throw ngay.
   * Sau login: đợi cookie auth CDP rồi navigate 1 lần về product_offer trước khi return (để capture đủ cookie).
   */
  async ensureAffiliateReady(offerUrl: string, waitMs = 8000): Promise<void> {
    let expectedHost = "affiliate.shopee.vn";
    try {
      expectedHost = new URL(offerUrl).hostname.toLowerCase();
    } catch {
      // ignore
    }

    const state0 = await this.getPageAuthState(expectedHost).catch((): null => null);
    // Chỉ navigate lần đầu nếu sai host và user không đang tương tác login
    if (!state0?.onExpectedHost && !(state0?.looksLikeLogin && state0?.userInteracting)) {
      await this.navigate(offerUrl, 4000);
    }

    const deadline = Date.now() + waitMs;
    let last: Awaited<ReturnType<RawCdpClient["getPageAuthState"]>> | null = null;
    let lastNudgeAt = 0;
    let announcedWait = false;
    let settledAfterAuth = false;

    while (Date.now() < deadline) {
      last = await this.getPageAuthState(expectedHost);
      const hasAuth = await this.hasCdpAuthCookies();

      // Đã có cookie auth (HttpOnly) → coi như login xong dù DOM còn ô password
      if (hasAuth) {
        if (!settledAfterAuth) {
          settledAfterAuth = true;
          // eslint-disable-next-line no-console
          console.log(
            `[scrape-cdp] Phát hiện cookie auth CDP → settle về product_offer rồi capture. url=${last.href}`
          );
          await this.navigate(offerUrl, 3500).catch((): undefined => undefined);
          await new Promise<void>((r) => setTimeout(r, 1500));
          continue;
        }
        if (last.onExpectedHost && last.readyState !== "loading") {
          // Xác nhận cookie còn sau navigate
          if (await this.hasCdpAuthCookies()) return;
          settledAfterAuth = false;
        } else if (!last.userInteracting) {
          await this.navigate(offerUrl, 2500).catch((): undefined => undefined);
        }
      } else if (
        last.onExpectedHost &&
        !last.looksLikeLogin &&
        last.readyState !== "loading" &&
        !/login|signin|buyer\/login/i.test(last.href)
      ) {
        // UI đã thoát login nhưng cookie HttpOnly chưa kịp — chờ thêm, không return sớm
        if (!announcedWait) {
          announcedWait = true;
          // eslint-disable-next-line no-console
          console.log(
            `[scrape-cdp] Trang Affiliate đã mở nhưng chưa thấy SPC_EC/SPC_ST (HttpOnly) — đang chờ cookie… url=${last.href}`
          );
        }
      }

      if (!hasAuth && (last.looksLikeLogin || !last.onExpectedHost)) {
        if (!announcedWait) {
          announcedWait = true;
          // eslint-disable-next-line no-console
          console.log(
            `[scrape-cdp] Đang chờ đăng nhập Shopee Affiliate trên cửa sổ GPM (tối đa ${Math.round(
              waitMs / 1000
            )}s)… url=${last.href}`
          );
        }
        // Chỉ nudge về product_offer khi sai host — không cắt ngang login/captcha
        const now = Date.now();
        if (now - lastNudgeAt > 20000) {
          lastNudgeAt = now;
          if (!last.looksLikeLogin && !last.userInteracting) {
            await this.navigate(offerUrl, 3500).catch((): undefined => undefined);
          }
        }
      }

      await new Promise<void>((r) => setTimeout(r, 1000));
    }

    last = last || (await this.getPageAuthState(expectedHost));
    const hasAuthFinal = await this.hasCdpAuthCookies();
    if (!hasAuthFinal || !last.onExpectedHost) {
      const remainHint = Math.round(waitMs / 1000);
      throw new Error(
        `Hết thời gian chờ đăng nhập Affiliate (~${remainHint}s). url=${last.href}. ` +
          `Đăng nhập trên cửa sổ GPM Login → vào /offer/product_offer → bấm «Mở Trình duyệt» lại.`
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
   * để request đi trong browser GPM Login (tránh 403 axios từ Node).
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

  /** Captcha Shopee: «Verify to Continue», «Please slide to complete the puzzle», … */
  async hasShopeeCaptchaVisible(): Promise<boolean> {
    return this.evaluateJson(
      `(() => {
        const isVisible = (el) => {
          if (!el || !(el instanceof Element)) return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
          const rect = el.getBoundingClientRect();
          return rect.width >= 8 && rect.height >= 8;
        };
        const body = String(document.body?.innerText || "");
        if (/Verify to Continue/i.test(body) && /slide to complete the puzzle/i.test(body)) return true;
        if (/Xác minh để tiếp tục/i.test(body) && /Kéo thanh để hoàn thành/i.test(body)) return true;
        const nodes = document.querySelectorAll("div, section, aside, dialog");
        for (const el of nodes) {
          if (!isVisible(el)) continue;
          const text = String(el.innerText || "");
          if (text.length < 12 || text.length > 4000) continue;
          const hasTitle =
            /Verify to Continue/i.test(text) ||
            /Xác minh để tiếp tục/i.test(text) ||
            /Security Verification/i.test(text) ||
            /Xác minh bảo mật/i.test(text);
          const hasSlideHint =
            /Please slide to complete the puzzle/i.test(text) ||
            /slide to complete the puzzle/i.test(text) ||
            /Kéo thanh để hoàn thành/i.test(text);
          const hasImageHint =
            /select all (images|pictures)/i.test(text) ||
            /Please select/i.test(text) ||
            /Chọn tất cả/i.test(text);
          if (hasTitle && (hasSlideHint || hasImageHint)) return true;
          if (hasTitle) {
            for (const m of el.querySelectorAll("canvas, img")) {
              if (!isVisible(m)) continue;
              const r = m.getBoundingClientRect();
              if (r.width >= 80 && r.height >= 80) return true;
            }
          }
        }
        return false;
      })()`,
      8000
    );
  }

  /**
   * Dừng và chờ user giải captcha trên cửa sổ GPM.
   * Chỉ trả solved=true khi captcha biến mất.
   */
  async waitForShopeeCaptchaResolved(
    captchaWaitMs = 300000
  ): Promise<{ solved: boolean; hadCaptcha: boolean }> {
    const hadCaptcha = await this.hasShopeeCaptchaVisible().catch(() => false);
    if (!hadCaptcha) return { solved: true, hadCaptcha: false };

    const started = Date.now();
    while (Date.now() - started < captchaWaitMs) {
      const visible = await this.hasShopeeCaptchaVisible().catch(() => false);
      if (!visible) {
        await new Promise((r) => setTimeout(r, 800));
        const stillGone = !(await this.hasShopeeCaptchaVisible().catch(() => false));
        if (stillGone) return { solved: true, hadCaptcha: true };
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    const stillVisible = await this.hasShopeeCaptchaVisible().catch(() => false);
    return { solved: !stillVisible, hadCaptcha: true };
  }

  /**
   * Điền form Shopee buyer login và bấm LOG IN.
   * Gọi sau khi đã gắn SPC_F + cookies lên đúng domain.
   */
  async attemptShopeeBuyerLogin(
    username: string,
    password: string,
    options?: { formWaitMs?: number; captchaWaitMs?: number; afterClickMs?: number }
  ): Promise<{
    ok: boolean;
    error?: string;
    captcha?: boolean;
    clicked?: boolean;
    navigated?: boolean;
  }> {
    const user = String(username || "").trim();
    const pass = String(password || "");
    if (!user || !pass) {
      return { ok: false, error: "Thiếu username/password" };
    }

    const formWaitMs = options?.formWaitMs ?? 20000;
    const captchaWaitMs = options?.captchaWaitMs ?? 120000;
    const afterClickMs = options?.afterClickMs ?? 30000;
    const timeoutMs = formWaitMs + captchaWaitMs + afterClickMs + 15000;

    const userJson = JSON.stringify(user);
    const passJson = JSON.stringify(pass);

    return this.evaluateJson(
      `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const username = ${userJson};
        const password = ${passJson};
        const formWaitMs = ${formWaitMs};
        const captchaWaitMs = ${captchaWaitMs};
        const afterClickMs = ${afterClickMs};

        const isVisible = (el) => {
          if (!el || !(el instanceof Element)) return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
          const rect = el.getBoundingClientRect();
          return rect.width >= 8 && rect.height >= 8;
        };

        const hasCaptcha = () => {
          const nodes = document.querySelectorAll("div, section, aside, dialog");
          for (const el of nodes) {
            if (!isVisible(el)) continue;
            const text = String(el.innerText || "");
            if (text.length < 12 || text.length > 4000) continue;
            const hasTitle =
              /Verify to Continue/i.test(text) ||
              /Xác minh để tiếp tục/i.test(text) ||
              /Security Verification/i.test(text) ||
              /Xác minh bảo mật/i.test(text);
            const hasSlideHint =
              /Please slide to complete the puzzle/i.test(text) ||
              /slide to complete the puzzle/i.test(text) ||
              /Kéo thanh để hoàn thành/i.test(text);
            const hasImageHint =
              /select all (images|pictures)/i.test(text) ||
              /Please select/i.test(text) ||
              /Chọn tất cả/i.test(text);
            if (hasTitle && (hasSlideHint || hasImageHint)) return true;
            if (hasTitle) {
              for (const m of el.querySelectorAll("canvas, img")) {
                if (!isVisible(m)) continue;
                const r = m.getBoundingClientRect();
                if (r.width >= 80 && r.height >= 80) return true;
              }
            }
          }
          return false;
        };

        const findLoginKey = () =>
          document.querySelector('input[name="loginKey"]') ||
          document.querySelector('input[placeholder*="Phone number"]') ||
          document.querySelector('input[placeholder*="Username"]') ||
          document.querySelector('input[type="text"][autocomplete="on"]');

        const findPassword = () =>
          document.querySelector('input[name="password"]') ||
          document.querySelector('input[type="password"]');

        const findLoginButton = () => {
          const buttons = Array.from(document.querySelectorAll("button"));
          return (
            buttons.find((b) => /^(LOG IN|Log In|Đăng nhập|ĐĂNG NHẬP)$/i.test(String(b.textContent || "").trim())) ||
            buttons.find((b) => /log\\s*in|đăng\\s*nhập/i.test(String(b.textContent || ""))) ||
            null
          );
        };

        const setNativeValue = (input, value) => {
          const proto = window.HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          if (desc?.set) desc.set.call(input, value);
          else input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        };

        const waitForCaptchaSolved = async (timeoutMs) => {
          if (!hasCaptcha()) return true;
          const started = Date.now();
          while (Date.now() - started < timeoutMs) {
            if (!hasCaptcha()) {
              await sleep(800);
              if (!hasCaptcha()) return true;
            }
            await sleep(400);
          }
          return !hasCaptcha();
        };

        const waitForLoginForm = async (timeoutMs) => {
          const started = Date.now();
          while (Date.now() - started < timeoutMs) {
            if (hasCaptcha()) {
              const ok = await waitForCaptchaSolved(captchaWaitMs);
              if (!ok) return { captchaTimeout: true };
              continue;
            }
            const loginKey = findLoginKey();
            const passwordEl = findPassword();
            if (loginKey && passwordEl && isVisible(loginKey) && isVisible(passwordEl)) {
              return { loginKey, passwordEl };
            }
            await sleep(300);
          }
          return {};
        };

        const onLoginPage = () =>
          /login|signin|authenticate|buyer\\/login|seller\\/login/i.test(
            String(location.href || "") + String(location.pathname || "")
          ) || !!document.querySelector('input[type="password"]');

        const form = await waitForLoginForm(formWaitMs);
        if (form.captchaTimeout) {
          return { ok: false, captcha: true, error: "Hết thời gian chờ giải captcha" };
        }
        if (!form.loginKey || !form.passwordEl) {
          if (!onLoginPage()) return { ok: true, navigated: true };
          return { ok: false, error: "Không thấy form login" };
        }

        setNativeValue(form.loginKey, username);
        setNativeValue(form.passwordEl, password);
        await sleep(1200);

        if (hasCaptcha()) {
          const ok = await waitForCaptchaSolved(captchaWaitMs);
          if (!ok) return { ok: false, captcha: true, error: "Hết thời gian chờ giải captcha" };
        }

        const btn = findLoginButton();
        if (!btn) return { ok: false, error: "Không tìm thấy nút LOG IN" };
        btn.click();

        const watchUntil = Date.now() + afterClickMs;
        while (Date.now() < watchUntil) {
          if (hasCaptcha()) {
            const ok = await waitForCaptchaSolved(captchaWaitMs);
            if (!ok) return { ok: false, captcha: true, error: "Hết thời gian chờ giải captcha" };
            const btn2 = findLoginButton();
            if (btn2 && isVisible(btn2)) btn2.click();
            await sleep(1000);
          }
          if (!onLoginPage()) return { ok: true, navigated: true, clicked: true };
          await sleep(400);
        }

        if (!onLoginPage()) return { ok: true, navigated: true, clicked: true };
        return { ok: true, clicked: true };
      })()`,
      timeoutMs
    );
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

/** Kích thước cửa sổ GPM Login mặc định khi mở CDP. */
export const CDP_WINDOW_SIZE = { width: 400, height: 400, left: 0, top: 0 } as const;

/**
 * Ép resize cửa sổ Chrome qua CDP browser WS.
 * Dùng khi GPM Login `win_size` bị bỏ qua (profile đã mở sẵn).
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

/** Cookie auth Affiliate/Shopee — thường HttpOnly (SPC_EC / SPC_ST). */
export function cookieJarHasAffiliateAuth(cookies: CdpCookie[]): boolean {
  return cookies.some((c) => {
    const n = String(c.name || "");
    return n === "SPC_EC" || n === "SPC_ST";
  });
}

export function cookiesToHeader(cookies: CdpCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
