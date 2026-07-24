/**
 * GemLogin hybrid kiểu PeeCrawl:
 * start profile → CDP capture session → ghi disk → đóng GemLogin → scrape HTTP bằng session.
 * Không Playwright / không CloakSigner (PeeCrawl Cloak là .pyd riêng).
 */

import axios, { AxiosRequestConfig } from "axios";
import { probeCdpEndpoint } from "./open-chrome";
import { defaultOfferUrl, getMarketByHost, isAffiliateHost } from "./domains";
import {
  extractList,
  extractTotal,
  flattenProduct,
  ScrapedAffiliateProduct,
} from "./product-mapper";
import { setLastMarketHost } from "./extension-push";
import {
  closeGemLoginProfile,
  getGemLoginRawProxy,
  startGemLoginProfile,
} from "./gemlogin-client";
import {
  CDP_WINDOW_SIZE,
  cookiesToHeader,
  filterShopeeCookies,
  RawCdpClient,
  setCdpWindowBounds,
} from "./raw-cdp";
import {
  getAffiliateHttpSession,
  loadAffiliateHttpSession,
  requireAffiliateHttpSession,
  setAffiliateHttpSession,
} from "./session-store";
import logger from "../logger";

export type CdpProductPageInput = {
  marketHost: string;
  keyword?: string;
  sortType?: number;
  pageOffset?: number;
  pageLimit?: number;
  listType?: number;
  filterShopTypes?: number[];
};

export type CdpProductPageResult = {
  products: ScrapedAffiliateProduct[];
  hasMore: boolean;
  totalCount: number | null;
  keyword: string;
  marketHost: string;
  pageOffset: number;
  pageLimit: number;
};

export type CdpExportInput = {
  marketHost: string;
  keyword?: string;
  sortType?: number;
  listType?: number;
  filterShopTypes?: number[];
  maxProducts?: number;
  delayMs?: number;
  pageLimit?: number;
  withShortLinks?: boolean;
};

const DEFAULT_PAGE_LIMIT = 20;

const SHORT_LINK_QUERY = `
    query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
        shortLink
        longLink
        failCode
      }
    }
  `;

/** Tracking sub_id1 gắn vào short link (utm_content). */
const SHORT_LINK_SUB_ID1 = (
  process.env.SHOPEE_AFFILIATE_SUB_ID1 ||
  process.env.AFFILIATE_SUB_ID1 ||
  "ViettheoVideoAffiliate"
).trim();

const SHORT_LINK_BATCH = 10;

function buildShortLinkParams(
  originalLinks: string[],
  withSubId: boolean
): Array<{ originalLink: string; advancedLinkParams: Record<string, string> }> {
  return originalLinks.map((originalLink) => ({
    originalLink,
    advancedLinkParams:
      withSubId && SHORT_LINK_SUB_ID1
        ? { subId1: SHORT_LINK_SUB_ID1 }
        : {},
  }));
}

/** failCode: 0 = OK. Chấp nhận number hoặc string "0" (tránh truthy "0" làm bỏ shortLink). */
function isShortLinkFail(item: any): boolean {
  if (!item) return true;
  const code = Number(item.failCode ?? 0);
  return Number.isFinite(code) ? code !== 0 : Boolean(item.failCode);
}

function applyShortLinkBatch(
  out: string[],
  startIndex: number,
  results: any[] | undefined
): { applied: number; failCodes: number[] } {
  const failCodes: number[] = [];
  let applied = 0;
  if (!Array.isArray(results)) return { applied, failCodes };
  results.forEach((item: any, idx: number) => {
    if (isShortLinkFail(item)) {
      failCodes.push(Number(item?.failCode ?? -1));
      return;
    }
    const short = String(item.shortLink || "").trim();
    if (!short) {
      failCodes.push(Number(item?.failCode ?? -2));
      return;
    }
    out[startIndex + idx] = short;
    applied += 1;
  });
  return { applied, failCodes };
}

function buildListUrl(options: {
  marketHost: string;
  keyword?: string;
  sortType?: number;
  pageOffset?: number;
  pageLimit?: number;
  listType?: number;
  /** Shopee filter_shop_types: 1=Mall, 4=Yêu thích+, 2=Yêu thích */
  filterShopTypes?: number[];
}): string {
  const host = options.marketHost;
  const keyword = String(options.keyword || "").trim();
  const sortType = Number(options.sortType);
  const pageLimit = Number(options.pageLimit) > 0 ? Number(options.pageLimit) : DEFAULT_PAGE_LIMIT;
  const listType = Number.isFinite(Number(options.listType)) ? Number(options.listType) : 0;
  const pageOffset = Number(options.pageOffset) >= 0 ? Number(options.pageOffset) : 0;
  const url = new URL(`https://${host}/api/v3/offer/product/list`);
  url.searchParams.set("list_type", String(listType));
  if (keyword) url.searchParams.set("keyword", keyword);
  url.searchParams.set("sort_type", String(Number.isFinite(sortType) ? sortType : 1));
  url.searchParams.set("page_offset", String(pageOffset));
  url.searchParams.set("page_limit", String(pageLimit));
  url.searchParams.set("client_type", "1");
  const shopTypes = Array.isArray(options.filterShopTypes)
    ? options.filterShopTypes
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  // Giữ dấu phẩy thô như URL Affiliate (1,4,2) — không encode thành %2C
  if (shopTypes.length) {
    const base = url.toString();
    return `${base}&filter_shop_types=${shopTypes.join(",")}`;
  }
  return url.toString();
}

async function affiliateGetJson(url: string, referer: string): Promise<any> {
  const session = requireAffiliateHttpSession();
  const config: AxiosRequestConfig = {
    timeout: 60000,
    headers: {
      accept: "application/json, text/plain, */*",
      "affiliate-program-type": "1",
      cookie: session.cookieHeader,
      referer,
      origin: `https://${session.marketHost}`,
      "user-agent":
        session.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    validateStatus: () => true,
  };
  // Proxy từ GemLogin profile (nếu có) — giống PeeCrawl truyền raw_proxy
  if (session.rawProxy) {
    try {
      const proxyUrl = session.rawProxy.includes("://")
        ? session.rawProxy
        : `http://${session.rawProxy}`;
      const u = new URL(proxyUrl);
      config.proxy = {
        host: u.hostname,
        port: Number(u.port) || 80,
        protocol: u.protocol.replace(":", "") || "http",
        auth:
          u.username || u.password
            ? { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }
            : undefined,
      };
    } catch {
      // ignore bad proxy string
    }
  }

  const res = await axios.get(url, config);
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `HTTP ${res.status} — session hết hạn. Bấm «Mở Trình duyệt» để capture lại từ GemLogin.`
    );
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${typeof res.data === "string" ? res.data.slice(0, 200) : res.statusText}`);
  }
  const json = res.data;
  if (json?.code !== 0 && json?.code !== undefined) {
    throw new Error(json.msg || json.message || `API error code: ${json.code}`);
  }
  return json;
}

async function fetchShortLinksHttp(
  originalLinks: string[],
  delayMs: number,
  withSubId: boolean
): Promise<{ shorts: string[]; detail: string }> {
  if (!originalLinks.length) return { shorts: [], detail: "empty" };
  const session = requireAffiliateHttpSession();
  const origin = `https://${session.marketHost}`;
  const out: string[] = new Array(originalLinks.length).fill("");
  const failCodes: number[] = [];
  let lastSnippet = "";

  for (let i = 0; i < originalLinks.length; i += SHORT_LINK_BATCH) {
    const chunk = originalLinks.slice(i, i + SHORT_LINK_BATCH);
    try {
      const res = await axios.post(
        `${origin}/api/v3/gql?q=batchCustomLink`,
        {
          operationName: "batchGetCustomLink",
          query: SHORT_LINK_QUERY,
          variables: {
            linkParams: buildShortLinkParams(chunk, withSubId),
            sourceCaller: "CUSTOM_LINK_CALLER",
          },
        },
        {
          timeout: 60000,
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            "affiliate-program-type": "1",
            cookie: session.cookieHeader,
            referer: `${origin}/offer/product_offer`,
            origin,
            "user-agent":
              session.userAgent ||
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          validateStatus: () => true,
        }
      );
      lastSnippet = JSON.stringify(res.data || {}).slice(0, 280);
      if (res.status >= 400) {
        logger.warn(`[scrape-http] short-link HTTP ${res.status}: ${lastSnippet}`);
      } else if (res.data?.errors?.length) {
        logger.warn(
          `[scrape-http] short-link GraphQL: ${res.data.errors[0]?.message || lastSnippet}`
        );
      } else {
        const applied = applyShortLinkBatch(out, i, res.data?.data?.batchCustomLink);
        failCodes.push(...applied.failCodes);
      }
    } catch (err: any) {
      logger.warn(`[scrape-http] short-link batch failed: ${err?.message || err}`);
      lastSnippet = String(err?.message || err);
    }
    if (i + SHORT_LINK_BATCH < originalLinks.length) {
      await new Promise((r) => setTimeout(r, Math.max(200, delayMs || 400)));
    }
  }

  const ok = out.filter(Boolean).length;
  const detail = `HTTP ok=${ok}/${originalLinks.length} subId=${withSubId} failCodes=[${failCodes
    .slice(0, 8)
    .join(",")}] snip=${lastSnippet}`;
  return { shorts: out, detail };
}

/**
 * Tạo short link trong tab GemLogin (fetch credentials:include) — tránh 403 axios Node.
 * Payload giống UI Affiliate / extension inject.js.
 */
async function fetchShortLinksViaCdp(
  originalLinks: string[],
  delayMs: number,
  withSubId: boolean
): Promise<{ shorts: string[]; detail: string }> {
  if (!originalLinks.length) return { shorts: [], detail: "empty" };
  const session = getAffiliateHttpSession() || loadAffiliateHttpSession();
  const marketHost = String(session?.marketHost || "affiliate.shopee.vn").trim();
  const client = await ensureLiveCdpClient(marketHost);
  const out: string[] = new Array(originalLinks.length).fill("");
  const failCodes: number[] = [];
  let lastSnippet = "";
  let lastPage = "";

  try {
    const auth = await client.getPageAuthState(marketHost);
    lastPage = String(auth.href || "");
    if (!auth.onExpectedHost) {
      throw new Error(
        `Tab GemLogin không ở ${marketHost} (đang: ${auth.href}). Mở product_offer rồi thử lại.`
      );
    }
    if (auth.looksLikeLogin) {
      throw new Error(
        `GemLogin đang ở trang login. Đăng nhập Affiliate rồi bấm Mở Trình duyệt lại.`
      );
    }

    for (let i = 0; i < originalLinks.length; i += SHORT_LINK_BATCH) {
      const chunk = originalLinks.slice(i, i + SHORT_LINK_BATCH);
      const linkParams = buildShortLinkParams(chunk, withSubId);
      // Chạy trong page: URL relative theo location.origin (giống extension)
      const expression = `(() => {
        const linkParams = ${JSON.stringify(linkParams)};
        const query = ${JSON.stringify(SHORT_LINK_QUERY)};
        const url = new URL("/api/v3/gql?q=batchCustomLink", location.origin).href;
        const body = {
          operationName: "batchGetCustomLink",
          query,
          variables: {
            linkParams,
            sourceCaller: "CUSTOM_LINK_CALLER",
          },
        };
        return fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            "affiliate-program-type": "1",
            referer: String(location.href || ""),
          },
          body: JSON.stringify(body),
        }).then(async (res) => {
          const text = await res.text();
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) {}
          return {
            status: res.status,
            ok: res.ok,
            json,
            text: text.slice(0, 600),
            pageHref: String(location.href || ""),
            origin: String(location.origin || ""),
          };
        });
      })()`;

      const result = await client.evaluateJson<{
        status: number;
        ok: boolean;
        json: any;
        text: string;
        pageHref: string;
        origin: string;
      }>(expression, 90000);

      if (!result) throw new Error("CDP short-link không trả kết quả");
      lastPage = result.pageHref || lastPage;
      lastSnippet = result.text || JSON.stringify(result.json || {}).slice(0, 280);

      if (result.status === 401 || result.status === 403) {
        throw new Error(
          `Short link HTTP ${result.status} từ GemLogin (page=${result.pageHref}). ` +
            `Login Affiliate → /offer/product_offer → F5 → Mở Trình duyệt lại.`
        );
      }
      if (!result.ok) {
        throw new Error(`Short link HTTP ${result.status}: ${result.text || ""}`);
      }
      if (result.json?.errors?.length) {
        throw new Error(
          result.json.errors[0]?.message || "GraphQL batchCustomLink lỗi"
        );
      }
      const batch = result.json?.data?.batchCustomLink;
      if (!Array.isArray(batch)) {
        throw new Error(
          `Short link response invalid (không có batchCustomLink). snip=${lastSnippet}`
        );
      }
      const applied = applyShortLinkBatch(out, i, batch);
      failCodes.push(...applied.failCodes);

      if (i + SHORT_LINK_BATCH < originalLinks.length) {
        await new Promise((r) => setTimeout(r, Math.max(200, delayMs || 400)));
      }
    }
  } finally {
    client.close();
  }

  const ok = out.filter(Boolean).length;
  const detail = `CDP ok=${ok}/${originalLinks.length} subId=${withSubId} page=${lastPage} failCodes=[${failCodes
    .slice(0, 8)
    .join(",")}] snip=${lastSnippet}`;
  return { shorts: out, detail };
}

/** Public: long affiliate links → short links (ưu tiên CDP trong GemLogin). */
export async function fetchAffiliateShortLinks(
  originalLinks: string[],
  delayMs = 400
): Promise<string[]> {
  const links = originalLinks.map((l) => String(l || "").trim());
  if (!links.some(Boolean)) return links.map(() => "");

  const attempts: Array<{ withSubId: boolean; via: "cdp" | "http" }> = [
    { withSubId: true, via: "cdp" },
    { withSubId: false, via: "cdp" },
    { withSubId: true, via: "http" },
    { withSubId: false, via: "http" },
  ];

  const details: string[] = [];
  let best: string[] | null = null;
  let bestOk = 0;

  for (const attempt of attempts) {
    try {
      const result =
        attempt.via === "cdp"
          ? await fetchShortLinksViaCdp(links, delayMs, attempt.withSubId)
          : await fetchShortLinksHttp(links, delayMs, attempt.withSubId);
      details.push(result.detail);
      const ok = result.shorts.filter(Boolean).length;
      logger.info(`[scrape] short-links ${result.detail}`);
      if (ok > bestOk) {
        bestOk = ok;
        best = result.shorts;
      }
      if (ok === links.filter(Boolean).length) {
        return result.shorts;
      }
      // Đủ phần lớn → dùng luôn, không thử tiếp
      if (ok > 0 && ok >= Math.ceil(links.filter(Boolean).length * 0.5)) {
        return result.shorts;
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      details.push(`${attempt.via}/subId=${attempt.withSubId}: ${msg}`);
      logger.warn(`[scrape] short-links ${attempt.via} failed: ${msg}`);
    }
  }

  if (best && bestOk > 0) return best;

  throw new Error(
    `Không tạo được short link (${links.filter(Boolean).length} link). ` +
      `Giữ GemLogin mở + login Affiliate. Chi tiết: ${details.slice(-2).join(" | ")}`
  );
}

/**
 * PeeCrawl-inspired:
 * - Mở: GemLogin start → navigate → capture session (cookie/UA/LS) → GIỮ profile mở
 * - Cào: fetch trong page GemLogin qua CDP (credentials:include) — tránh 403 axios Node
 * HTTP axios chỉ còn fallback / short-link khi CDP không dùng được.
 */
export async function openAffiliateBrowserCdp(options?: {
  marketHost?: string;
  gemloginProfileId?: string;
  allowChromeFallback?: boolean;
  /** true = tắt GemLogin sau capture (dễ 403 khi cào HTTP). Mặc định false = giữ mở để cào CDP. */
  stopProfileAfterCapture?: boolean;
}): Promise<{
  marketHost: string;
  offerUrl: string;
  cdpEndpoint: string;
  launched: boolean;
  source: "gemlogin" | "chrome";
  gemloginProfileId?: string;
  debugAddr?: string;
  cookieCount?: number;
  localStorageKeys?: number;
  profileStopped?: boolean;
}> {
  const opts = options || {};
  const host = String(opts.marketHost || "affiliate.shopee.vn").trim();
  const offerUrl = defaultOfferUrl(host);
  const profileId = String(opts.gemloginProfileId || "").trim();
  // Mặc định GIỮ profile — axios HTTP không đủ chống bot Shopee (403)
  const stopAfter = opts.stopProfileAfterCapture === true;

  if (!profileId) {
    throw new Error(
      "Chọn profile GemLogin trước khi Mở Trình duyệt. (GemLogin Desktop phải đang chạy tại localhost:1010)"
    );
  }

  logger.info(`[scrape-hybrid] GemLogin start profileId=${profileId}`);
  const rawProxy = await getGemLoginRawProxy(profileId);
  // Đóng trước để win_size được áp dụng (GemLogin bỏ qua size nếu profile đang mở)
  try {
    await closeGemLoginProfile(profileId);
    await new Promise((r) => setTimeout(r, 600));
  } catch {
    // ignore
  }
  const winW = CDP_WINDOW_SIZE.width;
  const winH = CDP_WINDOW_SIZE.height;
  const started = await startGemLoginProfile(profileId, {
    winPos: `${CDP_WINDOW_SIZE.left},${CDP_WINDOW_SIZE.top}`,
    winSize: `${winW},${winH}`,
    additionalArgs: `--window-size=${winW},${winH}`,
  });
  const port = started.port;
  const endpoint = started.endpoint;
  const debugAddr = started.debugAddr;

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (await probeCdpEndpoint(port, 800)) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!(await probeCdpEndpoint(port, 800))) {
    throw new Error(
      `GemLogin đã start nhưng CDP ${debugAddr} chưa sẵn sàng. Đóng profile trong GemLogin rồi mở lại.`
    );
  }

  // Ép resize qua CDP — chắc chắn kể cả khi win_size bị GemLogin bỏ qua
  const resized = await setCdpWindowBounds(port, CDP_WINDOW_SIZE);
  logger.info(`[scrape-hybrid] window ${winW}x${winH} cdpResize=${resized}`);

  let client: RawCdpClient | null = null;
  try {
    client = await RawCdpClient.connect(port, offerUrl, host);
    await client.ensureAffiliateReady(offerUrl, 12000);

    const allCookies = await client.getAllCookies();
    const filtered = filterShopeeCookies(allCookies, host);
    const cookieHeader = cookiesToHeader(filtered.length ? filtered : allCookies);
    if (!cookieHeader) {
      throw new Error(
        "Không lấy được cookie từ GemLogin. Đăng nhập Shopee Affiliate trên cửa sổ profile rồi bấm Mở lại."
      );
    }
    const userAgent = await client.getUserAgent();
    const localStorage = await client.getLocalStorage();

    setAffiliateHttpSession({
      marketHost: isAffiliateHost(host) ? host.toLowerCase() : "affiliate.shopee.vn",
      gemloginProfileId: profileId,
      cookieHeader,
      cookies: filtered.length ? filtered : allCookies,
      userAgent,
      localStorage,
      rawProxy: rawProxy || undefined,
      debugAddr,
      cdpPort: port,
      capturedAt: Date.now(),
    });
    setLastMarketHost(host);
    logger.info(
      `[scrape-hybrid] captured cookies=${filtered.length || allCookies.length} lsKeys=${Object.keys(localStorage).length} keepOpen=${!stopAfter}`
    );
  } finally {
    client?.close();
  }

  let profileStopped = false;
  if (stopAfter) {
    try {
      await closeGemLoginProfile(profileId);
      profileStopped = true;
    } catch (err: any) {
      logger.warn(`[scrape-hybrid] Không tắt được profile: ${err?.message || err}`);
    }
  }

  const sess = getAffiliateHttpSession();
  return {
    marketHost: host,
    offerUrl,
    cdpEndpoint: endpoint,
    launched: true,
    source: "gemlogin",
    gemloginProfileId: profileId,
    debugAddr,
    cookieCount: sess?.cookies.length || 0,
    localStorageKeys: sess?.localStorage ? Object.keys(sess.localStorage).length : 0,
    profileStopped,
  };
}

/** Đảm bảo GemLogin CDP sống — start lại profile nếu cần. */
async function ensureLiveCdpClient(marketHost: string): Promise<RawCdpClient> {
  let session = getAffiliateHttpSession() || loadAffiliateHttpSession();
  if (!session?.gemloginProfileId && !session?.cdpPort && !session?.debugAddr) {
    throw new Error(
      "Chưa có session. Bấm «Mở Trình duyệt» (GemLogin) trước khi cào."
    );
  }

  const offerUrl = defaultOfferUrl(marketHost || session.marketHost);
  let port = session.cdpPort || 0;
  if (!port && session.debugAddr) {
    const m = String(session.debugAddr).match(/:(\d+)\s*$/);
    port = m ? Number(m[1]) : 0;
  }

  if (!port || !(await probeCdpEndpoint(port, 800))) {
    const profileId = String(session.gemloginProfileId || "").trim();
    if (!profileId) {
      throw new Error(
        "GemLogin CDP đã tắt và thiếu profileId. Bấm «Mở Trình duyệt» lại."
      );
    }
    logger.info(`[scrape-cdp] CDP down → restart GemLogin profile ${profileId}`);
    try {
      await closeGemLoginProfile(profileId);
      await new Promise((r) => setTimeout(r, 600));
    } catch {
      // ignore
    }
    const winW = CDP_WINDOW_SIZE.width;
    const winH = CDP_WINDOW_SIZE.height;
    const started = await startGemLoginProfile(profileId, {
      winPos: `${CDP_WINDOW_SIZE.left},${CDP_WINDOW_SIZE.top}`,
      winSize: `${winW},${winH}`,
      additionalArgs: `--window-size=${winW},${winH}`,
    });
    port = started.port;
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      if (await probeCdpEndpoint(port, 800)) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!(await probeCdpEndpoint(port, 800))) {
      throw new Error(`Không mở lại được CDP ${started.debugAddr}`);
    }
    await setCdpWindowBounds(port, CDP_WINDOW_SIZE);
    session = {
      ...session,
      debugAddr: started.debugAddr,
      cdpPort: port,
    };
    setAffiliateHttpSession(session);
  }

  const client = await RawCdpClient.connect(port, offerUrl, marketHost || session.marketHost);
  try {
    await client.ensureAffiliateReady(offerUrl, 10000);
  } catch (err: any) {
    logger.warn(`[scrape-cdp] ensureAffiliateReady: ${err?.message || err}`);
    throw err;
  }
  return client;
}

async function fetchJsonInBrowser(
  client: RawCdpClient,
  url: string,
  referer: string,
  expectedHost: string
): Promise<any> {
  const auth = await client.getPageAuthState(expectedHost);
  if (!auth.onExpectedHost) {
    throw new Error(
      `Tab GemLogin không ở ${expectedHost} (đang: ${auth.href}). Mở product_offer trên đúng market rồi thử lại.`
    );
  }
  if (auth.looksLikeLogin) {
    throw new Error(
      `GemLogin đang ở trang login (${auth.href}). Đăng nhập Affiliate trên cửa sổ đó, rồi bấm Mở Trình duyệt lại.`
    );
  }

  const expression = `(() => {
    const url = ${JSON.stringify(url)};
    const referer = ${JSON.stringify(referer)};
    return fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
        "affiliate-program-type": "1",
        referer: referer,
      },
    }).then(async (res) => {
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) {}
      return {
        status: res.status,
        ok: res.ok,
        json,
        text: text.slice(0, 400),
        pageHref: String(location.href || ""),
        cookieLen: String(document.cookie || "").length,
      };
    });
  })()`;

  const result = await client.evaluateJson<{
    status: number;
    ok: boolean;
    json: any;
    text: string;
    pageHref: string;
    cookieLen: number;
  }>(expression);

  if (!result) throw new Error("CDP fetch không trả kết quả");
  if (result.status === 401 || result.status === 403) {
    throw new Error(
      `HTTP ${result.status} từ tab GemLogin (page=${result.pageHref}, cookieLen=${result.cookieLen}). ` +
        `Chưa login Affiliate hoặc antibot chặn. Trên cửa sổ GemLogin: login → vào /offer/product_offer → F5 → Mở Trình duyệt lại rồi cào.`
    );
  }
  if (!result.ok) {
    throw new Error(`HTTP ${result.status}: ${result.text || ""}`);
  }
  const json = result.json;
  if (json?.code !== 0 && json?.code !== undefined) {
    throw new Error(json.msg || json.message || `API error code: ${json.code}`);
  }
  return json;
}

export async function getCdpStatus(): Promise<{
  connected: boolean;
  port: number;
  endpoint: string;
  pageUrl?: string;
  source?: "gemlogin" | "chrome" | null;
  gemloginProfileId?: string | null;
  hasCookies?: boolean;
  cookieCount?: number;
  capturedAt?: number;
  localStorageKeys?: number;
  hasProxy?: boolean;
  cdpAlive?: boolean;
}> {
  let session = getAffiliateHttpSession();
  if (!session?.cookieHeader) {
    session = loadAffiliateHttpSession();
  }
  let port = session?.cdpPort || 0;
  if (!port && session?.debugAddr) {
    const m = String(session.debugAddr).match(/:(\d+)\s*$/);
    port = m ? Number(m[1]) : 0;
  }
  const cdpAlive = port > 0 ? await probeCdpEndpoint(port, 800) : false;
  return {
    connected: Boolean(session?.cookieHeader || cdpAlive),
    port,
    endpoint: session?.debugAddr ? `http://${session.debugAddr}` : port ? `http://127.0.0.1:${port}` : "",
    pageUrl: session ? defaultOfferUrl(session.marketHost) : undefined,
    source: session?.gemloginProfileId ? "gemlogin" : null,
    gemloginProfileId: session?.gemloginProfileId || null,
    hasCookies: Boolean(session?.cookieHeader),
    cookieCount: session?.cookies.length || 0,
    capturedAt: session?.capturedAt,
    localStorageKeys: session?.localStorage ? Object.keys(session.localStorage).length : 0,
    hasProxy: Boolean(session?.rawProxy),
    cdpAlive,
  };
}

export async function fetchProductPageViaCdp(
  input: CdpProductPageInput
): Promise<CdpProductPageResult> {
  const session = getAffiliateHttpSession() || loadAffiliateHttpSession();
  const marketHost = String(
    input.marketHost || session?.marketHost || "affiliate.shopee.vn"
  ).trim();
  const pageOffset = Number(input.pageOffset) >= 0 ? Number(input.pageOffset) : 0;
  const pageLimit = Number(input.pageLimit) > 0 ? Number(input.pageLimit) : DEFAULT_PAGE_LIMIT;
  const keyword = String(input.keyword || "").trim();
  const listUrl = buildListUrl({
    marketHost,
    keyword,
    sortType: input.sortType,
    pageOffset,
    pageLimit,
    listType: input.listType,
    filterShopTypes: input.filterShopTypes,
  });
  const referer = defaultOfferUrl(marketHost);

  let payload: any;
  let client: RawCdpClient | null = null;
  try {
    client = await ensureLiveCdpClient(marketHost);
    payload = await fetchJsonInBrowser(client, listUrl, referer, marketHost);
  } catch (cdpErr: any) {
    logger.warn(`[scrape-cdp] in-browser fetch failed: ${cdpErr?.message || cdpErr} → thử HTTP`);
    try {
      payload = await affiliateGetJson(listUrl, referer);
    } catch (httpErr: any) {
      throw new Error(
        cdpErr?.message ||
          httpErr?.message ||
          "Cào thất bại. Giữ cửa sổ GemLogin mở (đã login Affiliate) rồi thử lại."
      );
    }
  } finally {
    client?.close();
  }

  const market = getMarketByHost(marketHost);
  if (!market) {
    throw new Error(`Market không hợp lệ: ${marketHost}`);
  }

  const list = extractList(payload);
  const totalCount = extractTotal(payload);
  const products = list.map((item, index) => flattenProduct(item, index, pageOffset, market));
  const hasMore =
    list.length >= pageLimit && (totalCount == null || pageOffset + list.length < totalCount);

  return {
    products,
    hasMore,
    totalCount,
    keyword,
    marketHost: market.host,
    pageOffset,
    pageLimit,
  };
}

export async function exportCsvViaCdp(input: CdpExportInput): Promise<{
  products: ScrapedAffiliateProduct[];
  keyword: string;
  marketHost: string;
  marketCode: string;
  durationMs: number;
}> {
  const started = Date.now();
  const marketHost = String(input.marketHost || requireAffiliateHttpSession().marketHost || "affiliate.shopee.vn").trim();
  const maxProducts = Math.max(1, Number(input.maxProducts) || 500);
  const delayMs = Math.max(0, Number(input.delayMs) || 400);
  const pageLimit = Number(input.pageLimit) > 0 ? Number(input.pageLimit) : 20;
  const withShortLinks = input.withShortLinks !== false;

  const all: ScrapedAffiliateProduct[] = [];
  let pageOffset = 0;
  let keyword = String(input.keyword || "").trim();
  let hostOut = marketHost;

  while (all.length < maxProducts) {
    const page = await fetchProductPageViaCdp({
      marketHost,
      keyword,
      sortType: input.sortType,
      pageOffset,
      pageLimit,
      listType: input.listType,
      filterShopTypes: input.filterShopTypes,
    });
    hostOut = page.marketHost || hostOut;
    if (page.keyword) keyword = page.keyword;
    if (!page.products.length) break;

    for (const p of page.products) {
      if (all.length >= maxProducts) break;
      all.push(p);
    }

    if (!page.hasMore) break;
    pageOffset += pageLimit;
    if (all.length < maxProducts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (withShortLinks && all.length) {
    const linkRows = all
      .map((p, index) => ({
        index,
        link: String(p.long_link || p.affiliate_link || ""),
      }))
      .filter((r) => !!r.link);
    if (linkRows.length) {
      const shorts = await fetchAffiliateShortLinks(
        linkRows.map((r) => r.link),
        delayMs
      );
      linkRows.forEach((row, i) => {
        all[row.index].affiliate_link_short = shorts[i] || "";
      });
    }
  }

  if (!all.length) {
    throw new Error("Không có sản phẩm — kiểm tra cookie / đăng nhập Affiliate trên GemLogin");
  }

  const market = getMarketByHost(hostOut);
  return {
    products: all,
    keyword,
    marketHost: hostOut,
    marketCode: market?.code || "",
    durationMs: Date.now() - started,
  };
}
