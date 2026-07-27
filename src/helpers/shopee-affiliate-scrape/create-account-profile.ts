/**
 * Tạo GPM Login profile cho tài khoản Shopee:
 * create → start → gắn cookie/SPC_F qua CDP → mở trang Shopee theo domain.
 */

import logger from "../logger";
import { probeCdpEndpoint } from "./open-chrome";
import {
  closeGpmLoginProfile,
  createGpmLoginProfile,
  getGpmLoginProfile,
  startGpmLoginProfile,
  updateGpmLoginProfile,
} from "./gpmlogin-client";
import { cookiesToHeader, filterShopeeCookies, RawCdpClient } from "./raw-cdp";

const SHOPEE_HOST_BY_DOMAIN: Record<string, string> = {
  vn: "shopee.vn",
  ph: "shopee.ph",
  sg: "shopee.sg",
  th: "shopee.co.th",
  my: "shopee.com.my",
  id: "shopee.co.id",
};

export function resolveShopeeMallHost(domain?: string | null): string {
  const raw = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!raw || raw === "vn" || raw === "shopee.vn" || raw.includes(".vn")) return "shopee.vn";
  if (raw === "ph" || raw === "shopee.ph" || raw.includes(".ph")) return "shopee.ph";
  if (raw === "sg" || raw === "shopee.sg" || raw.includes(".sg")) return "shopee.sg";
  if (raw === "th" || raw === "shopee.co.th" || raw.includes(".th") || raw.includes("co.th")) {
    return "shopee.co.th";
  }
  if (raw === "my" || raw === "shopee.com.my" || raw.includes(".my") || raw.includes("com.my")) {
    return "shopee.com.my";
  }
  if (raw === "id" || raw === "shopee.co.id" || raw.includes(".id") || raw.includes("co.id")) {
    return "shopee.co.id";
  }
  return SHOPEE_HOST_BY_DOMAIN[raw] || "shopee.vn";
}

/** URL login buyer theo domain tài khoản: https://shopee.ph/buyer/login … */
export function resolveShopeeLoginUrl(domain?: string | null): string {
  return `https://${resolveShopeeMallHost(domain)}/buyer/login`;
}

/** Parse "a=1; b=2" → [{name,value}, …] */
export function parseCookieHeaderPairs(cookieStr?: string | null): Array<{ name: string; value: string }> {
  const raw = String(cookieStr || "").trim();
  if (!raw || !raw.includes("=")) return [];
  const out: Array<{ name: string; value: string }> = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[;\n]+/)) {
    const p = part.trim();
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const name = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, value });
  }
  return out;
}

function extractSpcFValue(cookieStr?: string | null, spcF?: string | null): string {
  const direct = String(spcF || "").trim();
  if (direct) {
    const eq = direct.indexOf("=");
    if (eq > 0 && /^SPC_F$/i.test(direct.slice(0, eq).trim())) {
      return direct.slice(eq + 1).trim();
    }
    return direct;
  }
  const m = String(cookieStr || "").match(/(?:^|;\s*)SPC_F=([^;]*)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].trim()).trim();
  } catch {
    return m[1].trim();
  }
}

/**
 * Đảm bảo danh sách cookie có SPC_F (ghi đè nếu đã có spc_f khác case).
 */
export function ensureSpcFInCookies(
  cookies: Array<{ name: string; value: string }>,
  spcF?: string | null,
  cookieStr?: string | null
): Array<{ name: string; value: string }> {
  const value = extractSpcFValue(cookieStr, spcF);
  const list = cookies.slice();
  const idx = list.findIndex((c) => /^SPC_F$/i.test(c.name));
  if (value) {
    if (idx >= 0) list[idx] = { name: "SPC_F", value };
    else list.push({ name: "SPC_F", value });
  } else if (idx >= 0) {
    list[idx] = { name: "SPC_F", value: list[idx].value };
  }
  return list;
}

const COOKIE_TTL_MS = 6 * 24 * 60 * 60 * 1000;
/** Chờ user giải captcha «Verify to Continue» trên cửa sổ GPM (5 phút). */
const CAPTCHA_WAIT_MS = 300000;
const LOGIN_AFTER_CAPTCHA_MS = 120000;

async function assertCaptchaCleared(
  client: RawCdpClient,
  captchaEncountered: { value: boolean }
): Promise<void> {
  const wait = await client.waitForShopeeCaptchaResolved(CAPTCHA_WAIT_MS);
  if (wait.hadCaptcha) captchaEncountered.value = true;
  if (wait.hadCaptcha) {
    logger.info("[gpm-create] Phát hiện captcha — chờ user giải trên cửa sổ GPM…");
  }
  if (wait.hadCaptcha && !wait.solved) {
    throw new Error(
      "Hết thời gian chờ giải captcha (Verify to Continue / slide puzzle). Giải captcha trên cửa sổ GPM rồi thử lại."
    );
  }
  if (wait.hadCaptcha && wait.solved) {
    logger.info("[gpm-create] Captcha đã giải xong — tiếp tục");
  }
}

async function waitUntilShopeeLoggedIn(
  client: RawCdpClient,
  shopeeHost: string,
  captchaEncountered: { value: boolean },
  timeoutMs = LOGIN_AFTER_CAPTCHA_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await assertCaptchaCleared(client, captchaEncountered);
    const state = await client.getPageAuthState(shopeeHost).catch((): null => null);
    if (isShopeeSessionLoggedIn(state)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const state = await client.getPageAuthState(shopeeHost).catch((): null => null);
  return isShopeeSessionLoggedIn(state);
}

function formatCookieTtlLabel(fetchedAtIso: string, nowMs = Date.now()): string {
  const start = new Date(fetchedAtIso).getTime();
  if (!Number.isFinite(start)) return "—";
  const remaining = Math.max(0, start + COOKIE_TTL_MS - nowMs);
  if (remaining <= 0) return "Hết hạn";
  const totalMin = Math.floor(remaining / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}n ${hours}g`;
  if (hours > 0) return `${hours}g ${mins}p`;
  return `${Math.max(1, mins)}p`;
}

/** Đã đăng nhập Shopee mall (có session cookie hoặc không còn trang login). */
function isShopeeSessionLoggedIn(
  state: {
    looksLikeLogin?: boolean;
    hasSpcEc?: boolean;
    onExpectedHost?: boolean;
    cookieNames?: string[];
  } | null
): boolean {
  if (!state?.onExpectedHost) return false;
  if (state.hasSpcEc) return true;
  if (!state.looksLikeLogin) {
    const names = state.cookieNames || [];
    if (names.some((n) => /^SPC_(EC|ST|SI|U)$/i.test(n))) return true;
  }
  return false;
}

function buildGpmProfileSessionNote(input: {
  username?: string;
  password?: string;
  spcF?: string;
  proxy?: string;
  cookieFetchedAt: string;
  cookiePreview?: string;
}): string {
  const lines = [
    `Username: ${String(input.username || "").trim() || "—"}`,
    `Mật khẩu: ${String(input.password || "").trim() || "—"}`,
    `SPC_F: ${String(input.spcF || "").trim() || "—"}`,
    `Proxy: ${String(input.proxy || "").trim() || "No Proxy"}`,
    `Cookie cập nhật: ${input.cookieFetchedAt}`,
    `Hiệu lực còn: ${formatCookieTtlLabel(input.cookieFetchedAt)} / 6 ngày`,
  ];
  const preview = String(input.cookiePreview || "").trim();
  if (preview) {
    lines.push(`Cookie: ${preview}`);
  }
  return lines.join("\n");
}

async function harvestShopeeMallCookieHeader(
  client: RawCdpClient,
  shopeeHost: string
): Promise<string> {
  const jar = filterShopeeCookies(await client.getAllCookies(), shopeeHost);
  let header = cookiesToHeader(jar).trim();
  if (!header) {
    try {
      header = String(
        await client.evaluateJson(`(() => String(document.cookie || ""))()`)
      ).trim();
    } catch {
      // ignore
    }
  }
  return header;
}

export type SavedGpmProfileSession = {
  username?: string;
  password?: string;
  cookie?: string;
  spcF?: string;
  proxy?: string;
  cookieFetchedAt: string;
  cookieRemainingMs: number;
};

export type CreateShopeeAccountGpmProfileInput = {
  /** Tên profile GPM (= username tài khoản) */
  profileName: string;
  /** Domain code hoặc host: vn | shopee.vn | … */
  domain?: string | null;
  /** Cookie full (ưu tiên cookieApp) */
  cookie?: string | null;
  /** SPC_F riêng nếu cookie chưa có */
  spcF?: string | null;
  /** Username Shopee (điền form login nếu chưa đăng nhập) */
  username?: string | null;
  /** Password Shopee */
  password?: string | null;
  /** Proxy host:port:user:pass hoặc URL */
  proxy?: string | null;
  note?: string | null;
  /** Gắn profile vào nhóm GPM Login */
  groupId?: string | null;
  /**
   * true (mặc định) = giữ browser mở sau khi gắn cookie.
   * false = đóng profile sau khi gắn (phù hợp chạy hàng loạt).
   */
  keepOpen?: boolean;
};

export type CreateShopeeAccountGpmProfileResult = {
  profileId: string;
  profileName: string;
  shopeeHost: string;
  homeUrl: string;
  loginUrl: string;
  cookieCount: number;
  loggedIn?: boolean;
  loginAttempted?: boolean;
  loginSkipped?: boolean;
  savedSession?: SavedGpmProfileSession;
  debugAddr?: string;
  cdpPort?: number;
  profileStopped?: boolean;
};

export async function createShopeeAccountGpmProfile(
  input: CreateShopeeAccountGpmProfileInput
): Promise<CreateShopeeAccountGpmProfileResult> {
  const profileName = String(input.profileName || "").trim();
  if (!profileName) throw new Error("Thiếu tên profile (username)");

  const shopeeHost = resolveShopeeMallHost(input.domain);
  const homeUrl = `https://${shopeeHost}/`;
  const loginUrl = resolveShopeeLoginUrl(input.domain);
  const cookieStr = String(input.cookie || "").trim();
  const spcF = String(input.spcF || "").trim();
  const loginUsername = String(input.username || "").trim();
  const loginPassword = String(input.password || "").trim();

  let cookies = ensureSpcFInCookies(parseCookieHeaderPairs(cookieStr), spcF, cookieStr);
  if (!cookies.length && spcF) {
    cookies = [{ name: "SPC_F", value: extractSpcFValue("", spcF) }];
  }
  if (!cookies.length) {
    throw new Error("Thiếu cookie hoặc SPC_F để gắn vào profile");
  }
  if (!cookies.some((c) => /^SPC_F$/i.test(c.name) && c.value)) {
    throw new Error("Thiếu SPC_F — bắt buộc gắn vào cookies web trước khi mở Shopee");
  }

  logger.info(
    `[gpm-create] create name=${profileName} host=${shopeeHost} login=${loginUrl} cookies=${cookies.length}`
  );

  const created = await createGpmLoginProfile({
    name: profileName,
    rawProxy: input.proxy || undefined,
    startupUrls: loginUrl,
    note: input.note || `Shopee ${shopeeHost} — ${profileName}`,
    groupId: input.groupId ? String(input.groupId).trim() : undefined,
    taskBarTitle: profileName,
  });

  const profileId = created.id;

  try {
    await closeGpmLoginProfile(profileId);
    await new Promise((r) => setTimeout(r, 400));
  } catch {
    // ignore
  }

  const started = await startGpmLoginProfile(profileId, {
    additionalArgs: "--window-size=900,700",
  });
  const port = started.port;
  const debugAddr = started.debugAddr;

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (await probeCdpEndpoint(port, 800)) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!(await probeCdpEndpoint(port, 800))) {
    throw new Error(
      `Đã tạo profile ${profileId} nhưng CDP ${debugAddr} chưa sẵn sàng. Mở lại profile trong GPM Login.`
    );
  }

  let client: RawCdpClient | null = null;
  let cookieCount = 0;
  let loggedIn = false;
  let loginAttempted = false;
  let loginSkipped = false;
  let savedSession: SavedGpmProfileSession | undefined;
  let profileStopped = false;
  const proxyStr = String(input.proxy || "").trim();
  const captchaEncountered = { value: false };
  try {
    client = await RawCdpClient.connect(port, loginUrl, shopeeHost);
    // Vào đúng origin trước khi set cookie (domain-bound)
    await client.navigate(loginUrl, 2500).catch((): undefined => undefined);
    cookieCount = await client.setCookiesForHost(shopeeHost, cookies);
    if (!cookieCount) {
      throw new Error("Không gắn được cookie vào profile GPM Login qua CDP");
    }
    // Reload login page sau khi đã gắn SPC_F + cookies
    await client.navigate(loginUrl, 3500);
    await assertCaptchaCleared(client, captchaEncountered);

    let authState = await client.getPageAuthState(shopeeHost).catch((): null => null);
    const alreadyLoggedIn = isShopeeSessionLoggedIn(authState);

    if (alreadyLoggedIn) {
      loginSkipped = true;
      loggedIn = true;
      logger.info(`[gpm-create] đã đăng nhập — bỏ qua form login host=${shopeeHost}`);
    } else if (loginUsername && loginPassword) {
      loginAttempted = true;
      await assertCaptchaCleared(client, captchaEncountered);
      const loginResult = await client.attemptShopeeBuyerLogin(loginUsername, loginPassword, {
        captchaWaitMs: CAPTCHA_WAIT_MS,
        afterClickMs: 60000,
      });
      await assertCaptchaCleared(client, captchaEncountered);

      if (loginResult.captcha && !loginResult.ok) {
        throw new Error(
          loginResult.error ||
            "Gặp captcha khi đăng nhập — hãy giải captcha trên cửa sổ GPM rồi thử lại"
        );
      }

      loggedIn = await waitUntilShopeeLoggedIn(client, shopeeHost, captchaEncountered);
      if (!loggedIn && loginResult.ok && (loginResult.navigated || loginResult.clicked)) {
        loggedIn = await waitUntilShopeeLoggedIn(client, shopeeHost, captchaEncountered, 45000);
      }
      logger.info(
        `[gpm-create] login attempted clicked=${Boolean(loginResult.clicked)} loggedIn=${loggedIn}`
      );
      if (!loggedIn && loginResult.ok === false && loginResult.error) {
        logger.warn(`[gpm-create] login failed: ${loginResult.error}`);
      }
    }

    await assertCaptchaCleared(client, captchaEncountered);

    if (!loggedIn) {
      logger.warn(
        `[gpm-create] Chưa xác nhận đăng nhập — bỏ qua cập nhật cookie/session host=${shopeeHost}`
      );
    } else {
      await client.navigate(homeUrl, 3000).catch((): undefined => undefined);
      await assertCaptchaCleared(client, captchaEncountered);

      const harvestedCookie = (await harvestShopeeMallCookieHeader(client, shopeeHost)) || cookieStr;
      const harvestedSpcF =
        extractSpcFValue(harvestedCookie, spcF) || extractSpcFValue(cookieStr, spcF);
      const cookieFetchedAt = new Date().toISOString();
      savedSession = {
        username: loginUsername || undefined,
        password: loginPassword || undefined,
        cookie: harvestedCookie || undefined,
        spcF: harvestedSpcF || undefined,
        proxy: proxyStr || undefined,
        cookieFetchedAt,
        cookieRemainingMs: COOKIE_TTL_MS,
      };

      const sessionNote = buildGpmProfileSessionNote({
        username: loginUsername,
        password: loginPassword,
        spcF: harvestedSpcF,
        proxy: proxyStr,
        cookieFetchedAt,
        cookiePreview: harvestedCookie,
      });
      try {
        await updateGpmLoginProfile(profileId, { note: sessionNote });
      } catch (err: any) {
        logger.warn(`[gpm-create] Không cập nhật note profile: ${err?.message || err}`);
      }
    }

    logger.info(
      `[gpm-create] ok profileId=${profileId} host=${shopeeHost} applied=${cookieCount} loggedIn=${loggedIn} skipped=${loginSkipped} captcha=${captchaEncountered.value}`
    );
  } finally {
    // Ngắt CDP trước — GPM stop profile ổn định hơn khi không còn kết nối CDP
    client?.close();
  }

  if (input.keepOpen === false) {
    if (savedSession) {
      try {
        await closeGpmLoginProfile(profileId);
        profileStopped = true;
        await new Promise((r) => setTimeout(r, 500));
        logger.info(`[gpm-create] đã đóng profile ${profileId} sau khi cập nhật cookie`);
      } catch (err: any) {
        logger.warn(`[gpm-create] Không đóng được profile ${profileId}: ${err?.message || err}`);
      }
    } else if (!captchaEncountered.value) {
      try {
        await closeGpmLoginProfile(profileId);
        profileStopped = true;
        await new Promise((r) => setTimeout(r, 300));
      } catch (err: any) {
        logger.warn(`[gpm-create] Không đóng được profile ${profileId}: ${err?.message || err}`);
      }
    } else {
      logger.info(
        `[gpm-create] Giữ profile ${profileId} mở — chờ giải captcha / hoàn tất đăng nhập`
      );
    }
  }

  return {
    profileId,
    profileName: created.name || profileName,
    shopeeHost,
    homeUrl,
    loginUrl,
    cookieCount,
    loggedIn,
    loginAttempted,
    loginSkipped,
    savedSession,
    debugAddr,
    cdpPort: profileStopped ? undefined : port,
    profileStopped,
  };
}

export type RefreshShopeeGpmProfileCookiesInput = {
  profileId: string;
  /** Domain code hoặc host: vn | shopee.vn | … */
  domain?: string | null;
  username?: string | null;
  password?: string | null;
  /** Cookie đã lưu (ưu tiên gắn lại SPC_F khi cần login) */
  cookie?: string | null;
  spcF?: string | null;
  proxy?: string | null;
};

export type RefreshShopeeGpmProfileCookiesResult = {
  profileId: string;
  shopeeHost: string;
  loginUrl: string;
  /** true = còn login → bỏ qua cập nhật cookie */
  skipped: boolean;
  skipReason?: "still_logged_in" | "no_credentials";
  loggedIn: boolean;
  loginAttempted: boolean;
  cookieUpdated: boolean;
  captchaEncountered?: boolean;
  savedSession?: SavedGpmProfileSession;
  profileStopped: boolean;
  message?: string;
};

/**
 * Cập nhật cookie cho profile GPM đã tồn tại:
 * start CDP → kiểm tra login → nếu chưa login thì gắn SPC_F + đăng nhập
 * (chờ captcha nếu có) → harvest cookie → cập nhật note → đóng profile.
 */
export async function refreshShopeeGpmProfileCookies(
  input: RefreshShopeeGpmProfileCookiesInput
): Promise<RefreshShopeeGpmProfileCookiesResult> {
  const profileId = String(input.profileId || "").trim();
  if (!profileId) throw new Error("Thiếu profileId GPM Login");

  const shopeeHost = resolveShopeeMallHost(input.domain);
  const homeUrl = `https://${shopeeHost}/`;
  const loginUrl = resolveShopeeLoginUrl(input.domain);
  const cookieStr = String(input.cookie || "").trim();
  const spcF = String(input.spcF || "").trim();
  const loginUsername = String(input.username || "").trim();
  const loginPassword = String(input.password || "").trim();
  const proxyStr = String(input.proxy || "").trim();

  try {
    await closeGpmLoginProfile(profileId);
    await new Promise((r) => setTimeout(r, 400));
  } catch {
    // ignore — có thể chưa mở
  }

  const started = await startGpmLoginProfile(profileId, {
    additionalArgs: "--window-size=900,700",
  });
  const port = started.port;
  const debugAddr = started.debugAddr;

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (await probeCdpEndpoint(port, 800)) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!(await probeCdpEndpoint(port, 800))) {
    throw new Error(
      `Không mở được CDP ${debugAddr || port} cho profile ${profileId}. Thử mở lại trong GPM Login.`
    );
  }

  let client: RawCdpClient | null = null;
  let loggedIn = false;
  let loginAttempted = false;
  let skipped = false;
  let skipReason: RefreshShopeeGpmProfileCookiesResult["skipReason"];
  let cookieUpdated = false;
  let savedSession: SavedGpmProfileSession | undefined;
  let profileStopped = false;
  const captchaEncountered = { value: false };

  try {
    try {
      client = await RawCdpClient.connect(port, loginUrl, shopeeHost);
      await client.navigate(loginUrl, 3500).catch((): undefined => undefined);
      await assertCaptchaCleared(client, captchaEncountered);

      let authState = await client.getPageAuthState(shopeeHost).catch((): null => null);
      loggedIn = isShopeeSessionLoggedIn(authState);

      if (loggedIn) {
        // Còn login: không re-login, nhưng vẫn harvest cookie + reset mốc 6 ngày
        // (nếu chỉ "bỏ qua" thì profile dưới 3 ngày sẽ bị mở đi mở lại mãi)
        skipped = true;
        skipReason = "still_logged_in";
        logger.info(
          `[gpm-refresh] còn login — đồng bộ cookie (không re-login) profileId=${profileId} host=${shopeeHost}`
        );
      } else {
        // Gắn lại SPC_F từ thông tin đã lưu trước khi login
        const cookies = ensureSpcFInCookies(parseCookieHeaderPairs(cookieStr), spcF, cookieStr);
        if (cookies.length) {
          await client.setCookiesForHost(shopeeHost, cookies);
          await client.navigate(loginUrl, 2500).catch((): undefined => undefined);
          await assertCaptchaCleared(client, captchaEncountered);
          authState = await client.getPageAuthState(shopeeHost).catch((): null => null);
          loggedIn = isShopeeSessionLoggedIn(authState);
        }

        if (!loggedIn) {
          if (!loginUsername || !loginPassword) {
            skipped = true;
            skipReason = "no_credentials";
            logger.warn(
              `[gpm-refresh] chưa login và thiếu username/password — profileId=${profileId}`
            );
          } else {
            loginAttempted = true;
            await assertCaptchaCleared(client, captchaEncountered);
            const loginResult = await client.attemptShopeeBuyerLogin(loginUsername, loginPassword, {
              captchaWaitMs: CAPTCHA_WAIT_MS,
              afterClickMs: 60000,
            });
            await assertCaptchaCleared(client, captchaEncountered);

            if (loginResult.captcha && !loginResult.ok) {
              throw new Error(
                loginResult.error ||
                  "Gặp captcha khi đăng nhập — hãy giải captcha trên cửa sổ GPM rồi thử lại"
              );
            }

            loggedIn = await waitUntilShopeeLoggedIn(client, shopeeHost, captchaEncountered);
            if (!loggedIn && loginResult.ok && (loginResult.navigated || loginResult.clicked)) {
              loggedIn = await waitUntilShopeeLoggedIn(
                client,
                shopeeHost,
                captchaEncountered,
                45000
              );
            }
            if (!loggedIn && loginResult.ok === false && loginResult.error) {
              logger.warn(`[gpm-refresh] login failed: ${loginResult.error}`);
            }
          }
        }
      }

      await assertCaptchaCleared(client, captchaEncountered);

      if (loggedIn && skipReason !== "no_credentials") {
        await client.navigate(homeUrl, 3000).catch((): undefined => undefined);
        await assertCaptchaCleared(client, captchaEncountered);

        const harvestedCookie =
          (await harvestShopeeMallCookieHeader(client, shopeeHost)) || cookieStr;
        const harvestedSpcF =
          extractSpcFValue(harvestedCookie, spcF) || extractSpcFValue(cookieStr, spcF);
        const cookieFetchedAt = new Date().toISOString();
        const noteUsername = loginUsername || undefined;
        const notePassword = loginPassword || undefined;
        savedSession = {
          username: noteUsername,
          password: notePassword,
          cookie: harvestedCookie || undefined,
          spcF: harvestedSpcF || undefined,
          proxy: proxyStr || undefined,
          cookieFetchedAt,
          cookieRemainingMs: COOKIE_TTL_MS,
        };
        cookieUpdated = true;

        let existingNote = "";
        try {
          const existing = await getGpmLoginProfile(profileId);
          existingNote = String(existing.note || "");
        } catch {
          // ignore
        }
        const existingParsed = (() => {
          const text = existingNote;
          const read = (label: string) => {
            const m = text.match(new RegExp(`(?:^|\\n)${label}:\\s*(.+)`, "i"));
            const v = String(m?.[1] || "").trim();
            return !v || v === "—" || v === "No Proxy" ? "" : v;
          };
          return {
            username: read("Username"),
            password: read("Mật khẩu"),
            spcF: read("SPC_F"),
            proxy: read("Proxy"),
          };
        })();

        const sessionNote = buildGpmProfileSessionNote({
          username: noteUsername || existingParsed.username,
          password: notePassword || existingParsed.password,
          spcF: harvestedSpcF || existingParsed.spcF || spcF,
          proxy: proxyStr || existingParsed.proxy,
          cookieFetchedAt,
          cookiePreview: harvestedCookie,
        });
        try {
          await updateGpmLoginProfile(profileId, { note: sessionNote });
        } catch (err: any) {
          logger.warn(`[gpm-refresh] Không cập nhật note profile: ${err?.message || err}`);
        }
        logger.info(
          `[gpm-refresh] đã cập nhật cookie profileId=${profileId} host=${shopeeHost} skippedLogin=${skipped}`
        );
      } else if (!loggedIn && !skipped) {
        logger.warn(
          `[gpm-refresh] chưa đăng nhập được — không cập nhật cookie profileId=${profileId}`
        );
      }
    } finally {
      client?.close();
    }

    // Đóng profile sau khi xử lý xong
    if (!(captchaEncountered.value && !savedSession && !skipped)) {
      try {
        await closeGpmLoginProfile(profileId);
        profileStopped = true;
        await new Promise((r) => setTimeout(r, 400));
      } catch (err: any) {
        logger.warn(`[gpm-refresh] Không đóng được profile ${profileId}: ${err?.message || err}`);
      }
    } else {
      logger.info(
        `[gpm-refresh] Giữ profile ${profileId} mở — chờ giải captcha / hoàn tất đăng nhập`
      );
    }

    let message = "";
    if (cookieUpdated && skipReason === "still_logged_in") {
      message = "Còn login — đã đồng bộ cookie và reset 6 ngày (không re-login)";
    } else if (skipped && skipReason === "no_credentials") {
      message = "Thiếu username/password để đăng nhập lại";
    } else if (cookieUpdated) {
      message = "Đã cập nhật cookie và reset 6 ngày";
    } else if (!loggedIn) {
      message = "Chưa đăng nhập được — không cập nhật cookie";
    }

    return {
      profileId,
      shopeeHost,
      loginUrl,
      skipped,
      skipReason,
      loggedIn,
      loginAttempted,
      cookieUpdated,
      captchaEncountered: captchaEncountered.value,
      savedSession,
      profileStopped,
      message,
    };
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    const keepOpenForCaptcha = /captcha/i.test(msg);
    if (!keepOpenForCaptcha) {
      try {
        await closeGpmLoginProfile(profileId);
      } catch {
        // ignore
      }
    } else {
      logger.info(
        `[gpm-refresh] Giữ profile ${profileId} mở vì lỗi captcha — giải rồi chạy lại`
      );
    }
    throw err;
  }
}
