/**
 * Extension: Số SP / Delay + Gửi CSV — domain bắt từ tab Affiliate.
 */

importScripts("domains.js");

const DEFAULT_API = "http://127.0.0.1:3000";
let exporting = false;
let lastAffiliateHost = "affiliate.shopee.vn";

chrome.storage.local.get(["lastAffiliateHost"]).then((data) => {
  if (data.lastAffiliateHost) lastAffiliateHost = String(data.lastAffiliateHost);
});

async function getApiBase() {
  const data = await chrome.storage.local.get("apiBase");
  const stored = String(data.apiBase || "").replace(/\/$/, "");
  return stored || DEFAULT_API;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json;
}

function rememberHost(host) {
  if (!host || !isAffiliateHost(host)) return;
  if (lastAffiliateHost === host) return;
  lastAffiliateHost = host;
  chrome.storage.local.set({ lastAffiliateHost: host }).catch(() => {});
}

function marketFromTab(tab) {
  try {
    return getMarketByHost(new URL(tab.url).hostname);
  } catch {
    return null;
  }
}

async function findAffiliateTab(preferredHost) {
  const wantHost = String(preferredHost || "").toLowerCase();
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = activeTabs[0];
  if (active?.url && isAffiliateProductOfferUrl(active.url)) {
    if (!wantHost) return active;
    try {
      if (new URL(active.url).hostname.toLowerCase() === wantHost) return active;
    } catch {
      // fall through
    }
  }

  const tabs = await chrome.tabs.query({});
  const affiliateTabs = tabs.filter((t) => t.url && isAffiliateProductOfferUrl(t.url));
  if (!affiliateTabs.length) return null;

  if (wantHost) {
    const match = affiliateTabs.find((t) => {
      try {
        return new URL(t.url).hostname.toLowerCase() === wantHost;
      } catch {
        return false;
      }
    });
    if (match) return match;
  }

  if (lastAffiliateHost) {
    const preferred = affiliateTabs.find((t) => {
      try {
        return new URL(t.url).hostname === lastAffiliateHost;
      } catch {
        return false;
      }
    });
    if (preferred) return preferred;
  }

  return affiliateTabs[0] || null;
}

async function queryHasListUrl(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "HAS_LIST_URL" });
    return Boolean(response?.hasListUrl);
  } catch {
    return false;
  }
}

async function runExportOnTab(tabId, options) {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "START_EXPORT",
    maxProducts: options.maxProducts,
    delayMs: options.delayMs,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Content script không trả kết quả");
  }
  return response.result;
}

async function pushToWeb(result, durationMs, tab) {
  const base = await getApiBase();
  const fromResult = result.domain || hostFromUrl(result.templateUrl);
  const fromTab = marketFromTab(tab)?.host || hostFromUrl(tab?.url);
  const marketHost = fromResult || fromTab || lastAffiliateHost;
  const market = getMarketByHost(marketHost);
  rememberHost(marketHost);

  return fetchJson(`${base}/api/app/scrape-shopee-affiliate/extension-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: result.products || [],
      keyword: result.keyword || "",
      marketHost,
      marketCode: result.marketCode || market?.code || "",
      durationMs,
    }),
  });
}

async function notifyAppTabs(payload) {
  const type = payload?.type || "COOKIE_FETCH_RESULT";
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const url = String(tab.url || "");
    if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) continue;
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { ...payload, type });
    } catch {
      // tab chưa có content script
    }
  }
}

async function postCookieResult(jobId, body) {
  const base = await getApiBase();
  try {
    await fetchJson(`${base}/api/app/shopee-cookie-fetch/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, ...body }),
    });
  } catch {
    // ignore — vẫn notify web qua message
  }
}

function cookieDomainFromLoginUrl(loginUrl) {
  try {
    const host = new URL(loginUrl).hostname; // shopee.vn
    return host.replace(/^www\./, "");
  } catch {
    return "shopee.vn";
  }
}

function cookieBelongsToShopeeDomain(cookieDomain, baseDomain) {
  const d = String(cookieDomain || "")
    .replace(/^\./, "")
    .toLowerCase();
  const base = String(baseDomain || "").toLowerCase();
  if (!d || !base) return false;
  return d === base || d.endsWith(`.${base}`);
}

function cookieMapKey(c) {
  return `${c.name}|${c.domain || ""}|${c.path || "/"}|${c.storeId || ""}|${
    c.partitionKey?.topLevelSite || ""
  }`;
}

/** Lấy toàn bộ cookie thuộc host Shopee (kể cả subdomain + partitioned). */
async function listShopeeCookies(loginUrl) {
  const domain = cookieDomainFromLoginUrl(loginUrl);
  const url = `https://${domain}/`;
  const topLevelSite = `https://${domain}`;
  const queries = [
    chrome.cookies.getAll({ url }),
    chrome.cookies.getAll({ domain }),
    chrome.cookies.getAll({ domain: `.${domain}` }),
    chrome.cookies.getAll({}),
  ];
  // Partitioned cookies (CHIPS) — Chrome có thể bỏ sót nếu không truyền partitionKey
  try {
    queries.push(
      chrome.cookies.getAll({
        domain: `.${domain}`,
        partitionKey: { topLevelSite },
      })
    );
    queries.push(
      chrome.cookies.getAll({
        url,
        partitionKey: { topLevelSite },
      })
    );
  } catch {
    // API partitionKey không hỗ trợ trên bản Chrome cũ
  }

  const batches = await Promise.all(
    queries.map((p) => p.catch(() => []))
  );
  const map = new Map();
  for (const batch of batches) {
    for (const c of batch) {
      if (!c?.name) continue;
      if (!cookieBelongsToShopeeDomain(c.domain, domain)) continue;
      map.set(cookieMapKey(c), c);
    }
  }
  return { domain, url, cookies: Array.from(map.values()) };
}

/** Xóa sạch cookie của domain trước khi login / gắn cookie mới. */
async function clearShopeeCookiesForDomain(loginUrl) {
  const { domain, url, cookies } = await listShopeeCookies(loginUrl);
  let removed = 0;
  for (const c of cookies) {
    const host = String(c.domain || domain).replace(/^\./, "");
    const path = c.path || "/";
    const candidates = [
      `https://${host}${path}`,
      `http://${host}${path}`,
      url,
    ];
    let ok = false;
    for (const removeUrl of candidates) {
      try {
        const details = { url: removeUrl, name: c.name };
        if (c.storeId) details.storeId = c.storeId;
        const result = await chrome.cookies.remove(details);
        if (result) {
          ok = true;
          break;
        }
      } catch {
        // thử url khác
      }
    }
    if (ok) removed += 1;
  }
  return { removed, domain };
}

/**
 * Chỉ lấy các field cookie session Shopee cần dùng (theo mẫu Cookies App).
 * `_ga_*` = mọi cookie bắt đầu bằng `_ga_` (ID GA động).
 */
const SHOPEE_COOKIE_ALLOWLIST = new Set([
  "_sapid",
  "_gcl_au",
  "csrftoken",
  "ssr-tz",
  "_QPWSDCXHZQA",
  "REC7iLP4Q",
  "_ga",
  "SPC_CDS_CHAT",
  "SPC_CLIENTID",
  "SPC_F",
  "REC_T_ID",
  "SPC_SI",
  "SPC_SEC_SI",
  "SPC_ST",
  "SPC_U",
  "SPC_R_T_IV",
  "SPC_T_ID",
  "SPC_T_IV",
  "SPC_R_T_ID",
  "AC_CERT_D",
  "sense_sa_r",
  "shopee_webUnique_ccd",
  "ds",
]);

/**
 * Thứ tự đúng theo mẫu session.
 * Marker `_ga_*` = chèn mọi cookie bắt đầu `_ga_` tại vị trí này.
 */
const SHOPEE_COOKIE_ORDER = [
  "_sapid",
  "_gcl_au",
  "csrftoken",
  "ssr-tz",
  "_QPWSDCXHZQA",
  "REC7iLP4Q",
  "_ga",
  "SPC_CDS_CHAT",
  "SPC_CLIENTID",
  "SPC_F",
  "REC_T_ID",
  "SPC_SI",
  "SPC_SEC_SI",
  "SPC_ST",
  "SPC_U",
  "SPC_R_T_IV",
  "SPC_T_ID",
  "SPC_T_IV",
  "SPC_R_T_ID",
  "AC_CERT_D",
  "sense_sa_r",
  "_ga_*",
  "shopee_webUnique_ccd",
  "ds",
];

function isAllowedShopeeCookieName(name) {
  const n = String(name || "");
  if (!n) return false;
  if (SHOPEE_COOKIE_ALLOWLIST.has(n)) return true;
  // GA property id động: _ga_4RBJJMVE2C, _ga_4GPP1ZXG63, ...
  if (n.startsWith("_ga_")) return true;
  return false;
}

function orderShopeeCookieMap(map) {
  const ordered = [];
  const used = new Set();
  for (const name of SHOPEE_COOKIE_ORDER) {
    if (name === "_ga_*") {
      const gaDyn = [...map.keys()]
        .filter((n) => n.startsWith("_ga_") && !used.has(n))
        .sort();
      for (const n of gaDyn) {
        ordered.push(`${n}=${map.get(n)}`);
        used.add(n);
      }
      continue;
    }
    if (!map.has(name)) continue;
    ordered.push(`${name}=${map.get(name)}`);
    used.add(name);
  }
  for (const [name, value] of map.entries()) {
    if (used.has(name)) continue;
    ordered.push(`${name}=${value}`);
  }
  return ordered.join("; ");
}

function mergeCookieStringIntoMap(map, cookieStr, { preferExisting = true } = {}) {
  for (const part of String(cookieStr || "").split(/[;\n]+/)) {
    const p = part.trim();
    if (!p.includes("=")) continue;
    const eq = p.indexOf("=");
    const name = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (!name || !isAllowedShopeeCookieName(name)) continue;
    if (preferExisting && map.has(name)) continue;
    map.set(name, value);
  }
}

async function readPageDocumentCookies(tabId) {
  if (!tabId) return "";
  try {
    const res = await chrome.tabs.sendMessage(tabId, {
      type: "GET_DOCUMENT_COOKIES",
    });
    return String(res?.cookie || "");
  } catch {
    return "";
  }
}

async function collectShopeeCookies(loginUrl, tabId) {
  const { cookies } = await listShopeeCookies(loginUrl);
  const map = new Map();
  for (const c of cookies) {
    if (!c?.name || !isAllowedShopeeCookieName(c.name)) continue;
    // Trùng tên: giữ bản mới hơn / ghi đè
    map.set(c.name, c.value);
  }

  // Bổ sung cookie JS-only từ document.cookie (nếu jar chưa có)
  const docCookie = await readPageDocumentCookies(tabId);
  mergeCookieStringIntoMap(map, docCookie, { preferExisting: true });

  const cookie = orderShopeeCookieMap(map);
  const spcF = map.get("SPC_F") || map.get("spc_f") || "";
  return { cookie, spcF, map };
}

/** Session bắt buộc phải có sau login. */
const CRITICAL_COOKIE_NAMES = ["SPC_ST", "SPC_U", "SPC_F", "SPC_SI"];
/** Field thường chỉ xuất hiện sau khi vào trang chủ. */
const SOFT_COOKIE_NAMES = [
  "SPC_SEC_SI",
  "SPC_CLIENTID",
  "csrftoken",
  "AC_CERT_D",
  "_sapid",
  "shopee_webUnique_ccd",
  "ds",
  "REC_T_ID",
  "SPC_T_ID",
  "SPC_T_IV",
];

function scoreCookieMap(map) {
  let score = map.size;
  for (const name of CRITICAL_COOKIE_NAMES) {
    if (map.has(name)) score += 50;
  }
  for (const name of SOFT_COOKIE_NAMES) {
    if (map.has(name)) score += 5;
  }
  for (const name of map.keys()) {
    if (name.startsWith("_ga_")) score += 3;
  }
  return score;
}

function hasCriticalCookies(map) {
  return CRITICAL_COOKIE_NAMES.every((n) => map.has(n));
}

/**
 * Sau login: về trang chủ, chờ JS set cookie, poll đến khi đủ field (hoặc timeout).
 */
async function waitAndCollectCookies(loginUrl, tabId, assertTabAlive) {
  const domain = cookieDomainFromLoginUrl(loginUrl);
  const home = `https://${domain}/`;

  // Luôn về trang chủ — nhiều field (_sapid, _ga, ds, shopee_webUnique_ccd…)
  // chỉ được JS set sau khi load home, không có ngay trên /buyer/login.
  try {
    await chrome.tabs.update(tabId, { url: home, active: true });
    await waitTabComplete(tabId, 30000);
  } catch (err) {
    if (assertTabAlive) await assertTabAlive();
    throw err;
  }

  if (assertTabAlive) await assertTabAlive();
  await new Promise((r) => setTimeout(r, 2500));

  let best = { cookie: "", spcF: "", map: new Map(), score: -1 };
  const deadline = Date.now() + 22000;

  while (Date.now() < deadline) {
    if (assertTabAlive) await assertTabAlive();
    const result = await collectShopeeCookies(loginUrl, tabId);
    const score = scoreCookieMap(result.map);
    if (score > best.score) {
      best = { ...result, score };
    }
    const softOk =
      SOFT_COOKIE_NAMES.filter((n) => best.map.has(n)).length >= 5;
    if (hasCriticalCookies(best.map) && softOk) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!best.cookie) {
    throw new Error("Không lấy được cookie sau login");
  }
  if (!hasCriticalCookies(best.map)) {
    const missing = CRITICAL_COOKIE_NAMES.filter((n) => !best.map.has(n));
    throw new Error(
      `Cookie thiếu session: ${missing.join(", ")} — thử login lại`
    );
  }

  return { cookie: best.cookie, spcF: best.spcF };
}

/** Gắn chỉ SPC_F (sau khi đã clear) — dùng trước khi login. */
async function setSpcFOnly(spcFValue, loginUrl) {
  const value = String(spcFValue || "").trim();
  if (!value) return { ok: false, skipped: true };

  // Cho phép truyền cả "SPC_F=xxx" hoặc chỉ value
  let name = "SPC_F";
  let finalValue = value;
  const eq = value.indexOf("=");
  if (eq > 0) {
    const maybeName = value.slice(0, eq).trim();
    if (/^SPC_F$/i.test(maybeName)) {
      name = "SPC_F";
      finalValue = value.slice(eq + 1).trim();
    }
  }
  if (!finalValue) return { ok: false, skipped: true };

  const domain = cookieDomainFromLoginUrl(loginUrl);
  const url = `https://${domain}/`;
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  try {
    await chrome.cookies.set({
      url,
      name,
      value: finalValue,
      path: "/",
      domain: `.${domain}`,
      secure: true,
      expirationDate: expire,
    });
    return { ok: true, name, domain };
  } catch {
    await chrome.cookies.set({
      url,
      name,
      value: finalValue,
      path: "/",
      secure: true,
      expirationDate: expire,
    });
    return { ok: true, name, domain };
  }
}

/** Gắn chuỗi cookie của tài khoản vào Chrome theo domain, rồi mở trang Shopee để thấy hiệu quả. */
async function applyCookiesToLocal(cookieStr, loginUrl) {
  const domain = cookieDomainFromLoginUrl(loginUrl);
  const url = `https://${domain}/`;
  const raw = String(cookieStr || "").trim();
  if (!raw) throw new Error("Cookie trống");

  // Clear cookie domain cũ trước khi gắn mới
  await clearShopeeCookiesForDomain(loginUrl);

  let pairs = [];
  if (raw.includes("=")) {
    // Hỗ trợ "a=1; b=2" hoặc mỗi dòng một cookie
    pairs = raw
      .split(/[;\n]+/)
      .map((p) => p.trim())
      .filter((p) => p.includes("="));
  } else {
    throw new Error("Cookie không đúng định dạng name=value");
  }

  let applied = 0;
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 ngày
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    try {
      await chrome.cookies.set({
        url,
        name,
        value,
        path: "/",
        domain: `.${domain}`,
        secure: true,
        expirationDate: expire,
      });
      applied += 1;
    } catch {
      try {
        await chrome.cookies.set({
          url,
          name,
          value,
          path: "/",
          secure: true,
          expirationDate: expire,
        });
        applied += 1;
      } catch {
        // bỏ cookie không set được
      }
    }
  }

  // spc_f đơn lẻ
  if (applied === 0 && !raw.includes("=") && raw.length > 8) {
    await chrome.cookies.set({
      url,
      name: "spc_f",
      value: raw,
      path: "/",
      domain: `.${domain}`,
      secure: true,
      expirationDate: expire,
    });
    applied = 1;
  }

  if (!applied) throw new Error("Không gắn được cookie vào Chrome");

  // Mở / reload trang chủ Shopee đúng domain để thấy đã login
  const homeUrl = `https://${domain}/`;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => {
    try {
      return new URL(t.url || "").hostname.replace(/^www\./, "") === domain;
    } catch {
      return false;
    }
  });
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: homeUrl });
  } else {
    await chrome.tabs.create({ url: homeUrl, active: true });
  }

  return { applied, domain, homeUrl };
}

function waitTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") {
          clearInterval(timer);
          resolve(true);
          return;
        }
      } catch {
        clearInterval(timer);
        resolve(false);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 400);
  });
}

async function findOrOpenLoginTab(loginUrl) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => {
    const u = String(t.url || "");
    return u.startsWith(loginUrl) || /shopee\.[^/]+\/buyer\/(login|signin)/i.test(u);
  });
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: loginUrl });
    return existing.id;
  }
  const tab = await chrome.tabs.create({ url: loginUrl, active: true });
  return tab.id;
}

/**
 * Chờ kết quả login từ content script (SHOPEE_LOGIN_RESULT),
 * tab redirect khỏi login, hoặc user đóng tab → hủy job ngay.
 * Captcha: chỉ chờ (SHOPEE_LOGIN_CAPTCHA_WAIT), không kết thúc job.
 */
function waitForShopeeLoginResult(tabId, timeoutMs = 300000) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const clearAll = () => {
      if (timer) clearTimeout(timer);
      try {
        chrome.runtime.onMessage.removeListener(onMessage);
      } catch {
        // ignore
      }
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch {
        // ignore
      }
      try {
        chrome.tabs.onRemoved.removeListener(onRemoved);
      } catch {
        // ignore
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearAll();
      resolve(result);
    };

    const armTimeout = (ms, error) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        finish({ ok: false, error: error || "Timeout chờ login" });
      }, ms);
    };

    // Mặc định 5 phút — đủ để giải captcha ảnh
    armTimeout(timeoutMs, "Timeout chờ login / captcha");

    function onMessage(message, sender) {
      if (sender?.tab?.id !== tabId) return;

      // Đang chờ user giải captcha — kéo dài timeout, báo UI
      if (message?.type === "SHOPEE_LOGIN_CAPTCHA_WAIT") {
        armTimeout(300000, "Hết thời gian chờ giải captcha");
        const job = activeCookieJob;
        if (job) {
          notifyAppTabs({
            jobId: job.jobId,
            userId: job.userId,
            status: "captcha_wait",
            error:
              message.reason ||
              "Gặp captcha — hãy giải trên tab Shopee, đang chờ…",
          }).catch(() => {});
        }
        return;
      }

      if (message?.type !== "SHOPEE_LOGIN_RESULT") return;

      // Captcha timeout mới coi là fail; còn lại captcha=true cũng fail
      finish({
        ok: Boolean(message.ok),
        captcha: Boolean(message.captcha),
        clicked: Boolean(message.clicked),
        error: message.error || "",
      });
    }

    function onUpdated(updatedTabId, info, tab) {
      if (updatedTabId !== tabId) return;
      const url = String(tab?.url || "");
      if (!url || url.startsWith("chrome://")) return;
      // Redirect khỏi /buyer/login|signin → coi như login OK
      if (
        info.status === "complete" &&
        /shopee\./i.test(url) &&
        !/\/buyer\/(login|signin)/i.test(url)
      ) {
        finish({ ok: true, navigated: true });
      }
    }

    function onRemoved(removedTabId) {
      if (removedTabId !== tabId) return;
      finish({
        ok: false,
        cancelled: true,
        error: "Đã đóng tab Shopee — dừng job",
      });
    }

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

let cookieJobRunning = false;
const claimedJobIds = new Set();

/** Job cookie đang chạy — đóng tab Shopee sẽ hủy. */
let activeCookieJob = null; // { jobId, userId, tabId, closingByUs }

async function runCookieFetchJob(job) {
  const jobId = job.jobId;
  const userId = job.userId;
  const loginUrl = job.loginUrl || "https://shopee.vn/buyer/login";
  let tabId = null;

  if (cookieJobRunning) {
    return { ok: false, error: "Đang chạy job cookie khác" };
  }
  cookieJobRunning = true;
  activeCookieJob = { jobId, userId, tabId: null, closingByUs: false };

  const assertTabAlive = async () => {
    if (!tabId) return;
    if (activeCookieJob?.closingByUs) return;
    try {
      await chrome.tabs.get(tabId);
    } catch {
      throw new Error("Đã đóng tab Shopee — dừng job");
    }
  };

  try {
    const base = await getApiBase();
    try {
      await fetchJson(`${base}/api/app/shopee-cookie-fetch/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId }),
      });
    } catch {
      // job có thể đã running
    }

    // 1) Xóa hết cookie Shopee
    // 2) Gắn SPC_F của tài khoản
    // 3) Mới mở tab login
    await clearShopeeCookiesForDomain(loginUrl);
    const seedSpcF = String(job.spcF || "").trim();
    if (seedSpcF) {
      try {
        await setSpcFOnly(seedSpcF, loginUrl);
      } catch {
        // vẫn thử login nếu gắn SPC_F lỗi
      }
    }
    tabId = await findOrOpenLoginTab(loginUrl);
    if (activeCookieJob) activeCookieJob.tabId = tabId;
    await waitTabComplete(tabId, 25000);
    await assertTabAlive();
    await new Promise((r) => setTimeout(r, 1000));
    await assertTabAlive();

    // Reload 1 lần để trang login nhận SPC_F vừa gắn
    if (seedSpcF) {
      try {
        await chrome.tabs.reload(tabId);
        await waitTabComplete(tabId, 25000);
        await assertTabAlive();
        await new Promise((r) => setTimeout(r, 800));
      } catch {
        // ignore
      }
    }

    const loginWait = waitForShopeeLoginResult(tabId, 300000);
    try {
      const ack = await chrome.tabs.sendMessage(tabId, {
        type: "RUN_SHOPEE_LOGIN",
        username: job.username,
        password: job.password,
      });
      if (!ack?.accepted && ack?.ok === false) {
        throw new Error(ack?.error || "Không bắt đầu được login");
      }
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (/Đã đóng tab Shopee/i.test(msg)) throw err;
      if (/message channel closed|asynchronous response|Receiving end does not exist/i.test(msg)) {
        // Thử chờ redirect / result; nếu không có sẽ timeout
      } else {
        throw new Error(
          msg ||
            "Không nói chuyện được với trang login — reload extension (1.5.9+) và thử lại"
        );
      }
    }

    const loginRes = await loginWait;

    if (loginRes?.cancelled || /Đã đóng tab Shopee/i.test(String(loginRes?.error || ""))) {
      const payload = {
        jobId,
        userId,
        status: "cancelled",
        error: loginRes.error || "Đã đóng tab Shopee — dừng job",
      };
      await postCookieResult(jobId, payload);
      await notifyAppTabs(payload);
      return { ok: false, cancelled: true, error: payload.error };
    }

    if (loginRes?.captcha) {
      const payload = {
        jobId,
        userId,
        status: "captcha",
        error: loginRes.error || "Hết thời gian chờ giải captcha",
      };
      await postCookieResult(jobId, payload);
      await notifyAppTabs(payload);
      return { ok: false, captcha: true, error: payload.error };
    }

    if (!loginRes?.ok) {
      throw new Error(loginRes?.error || "Login thất bại");
    }

    await assertTabAlive();
    // Về trang chủ + poll đến khi đủ field như mẫu (SPC_ST/U/F + soft cookies)
    const { cookie, spcF } = await waitAndCollectCookies(
      loginUrl,
      tabId,
      assertTabAlive
    );

    const payload = {
      jobId,
      userId,
      status: "success",
      cookie,
      spcF,
    };
    await postCookieResult(jobId, payload);
    await notifyAppTabs(payload);

    if (tabId) {
      try {
        if (activeCookieJob) activeCookieJob.closingByUs = true;
        await chrome.tabs.remove(tabId);
      } catch {
        // ignore
      }
    }
    return { ok: true, cookie, spcF };
  } catch (err) {
    const msg = err?.message || String(err);
    const cancelled = /Đã đóng tab Shopee/i.test(msg);
    const payload = {
      jobId,
      userId,
      status: cancelled ? "cancelled" : "error",
      error: msg,
    };
    await postCookieResult(jobId, payload);
    await notifyAppTabs(payload);
    return { ok: false, cancelled, error: payload.error };
  } finally {
    cookieJobRunning = false;
    activeCookieJob = null;
  }
}

/** User đóng tab Shopee của job đang chạy → kết thúc job ngay (kể cả ngoài lúc chờ login). */
chrome.tabs.onRemoved.addListener((removedTabId) => {
  const active = activeCookieJob;
  if (!active || active.tabId !== removedTabId || active.closingByUs) return;
  // waitForShopeeLoginResult cũng bắt onRemoved; flag này để các bước sau assertTabAlive fail nhanh
  active.tabId = removedTabId;
});

/** Cookie-fetch qua extension đã bỏ — dùng GemLogin/CDP + cookie thủ công. */
// (đã xóa poll setInterval → /api/app/shopee-cookie-fetch/pending)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PAGE_PROGRESS") {
    return false;
  }

  if (message?.type === "LIST_URL_CAPTURED") {
    const host =
      message.domain ||
      hostFromUrl(message.listRequestUrl) ||
      "";
    rememberHost(host);
    return false;
  }

  if (message?.type === "GET_STATUS") {
    (async () => {
      try {
        const apiBase = await getApiBase();
        const data = await chrome.storage.local.get(["maxProducts", "delayMs"]);
        const tab = await findAffiliateTab();
        const market = tab ? marketFromTab(tab) : getMarketByHost(lastAffiliateHost);
        if (market?.host) rememberHost(market.host);
        let hasListUrl = false;
        if (tab?.id) hasListUrl = await queryHasListUrl(tab.id);
        sendResponse({
          ok: true,
          apiBase,
          maxProducts: data.maxProducts != null ? Number(data.maxProducts) : 500,
          delayMs: data.delayMs != null ? Number(data.delayMs) : 400,
          hasAffiliateTab: Boolean(tab),
          hasListUrl,
          exporting,
          domain: market?.host || null,
          marketCode: market?.code || null,
        });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "SEND_CSV") {
    (async () => {
      const started = Date.now();
      try {
        if (exporting) throw new Error("Đang gửi, vui lòng đợi");
        const maxProducts = Number(message.maxProducts);
        const delayMs = Number(message.delayMs);
        await chrome.storage.local.set({
          maxProducts: Number.isFinite(maxProducts) ? maxProducts : 500,
          delayMs: Number.isFinite(delayMs) ? delayMs : 400,
        });

        const tab = await findAffiliateTab();
        if (!tab?.id) throw new Error("Mở trang Affiliate product_offer trước");

        const ready = await queryHasListUrl(tab.id);
        if (!ready) {
          throw new Error("Chưa bắt list API — hãy tìm kiếm hoặc lật trang trên Affiliate trước");
        }

        exporting = true;
        const result = await runExportOnTab(tab.id, {
          maxProducts: Number.isFinite(maxProducts) ? maxProducts : 500,
          delayMs: Number.isFinite(delayMs) ? delayMs : 400,
        });
        const durationMs = Date.now() - started;
        const pushed = await pushToWeb(result, durationMs, tab);
        sendResponse({
          ok: true,
          count: result.products?.length || 0,
          sessionId: pushed.session?.id,
          durationMs,
          domain: pushed.session?.marketHost || "",
          marketCode: pushed.session?.marketCode || "",
        });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      } finally {
        exporting = false;
      }
    })();
    return true;
  }

  if (message?.type === "START_PRODUCT_PAGE_FETCH") {
    const requestId = message.requestId || "";
    // Trả lời ngay — kết quả về qua notifyAppTabs / PRODUCT_PAGE_RESULT
    // (tránh MV3 "message channel closed" khi await fetch lâu).
    sendResponse({ ok: true, started: true });
    (async () => {
      const reply = async (payload) => {
        await notifyAppTabs({
          type: "PRODUCT_PAGE_RESULT",
          requestId,
          ...payload,
        });
      };
      try {
        const marketHost = String(message.marketHost || "").trim();
        let tab = await findAffiliateTab(marketHost);
        if (!tab?.id && marketHost) {
          const offerUrl = `https://${marketHost}/offer/product_offer`;
          tab = await chrome.tabs.create({ url: offerUrl, active: true });
          // Đợi content/inject sẵn sàng
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
              const ping = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
              if (ping?.ok) break;
            } catch {
              // chưa inject
            }
          }
        }
        if (!tab?.id) {
          await reply({
            ok: false,
            error: "Mở trang Affiliate product_offer (đúng quốc gia) trước khi cào",
          });
          return;
        }
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "FETCH_PRODUCT_PAGE",
          keyword: message.keyword || "",
          sortType: message.sortType,
          pageOffset: message.pageOffset,
          pageLimit: message.pageLimit,
          listType: message.listType,
        });
        if (!response?.ok) {
          await reply({ ok: false, error: response?.error || "Content script lỗi" });
          return;
        }
        await reply({
          ok: true,
          products: response.products || [],
          hasMore: Boolean(response.hasMore),
          totalCount: response.totalCount ?? null,
          keyword: response.keyword || message.keyword || "",
          marketHost: response.marketHost || marketHost || "",
        });
      } catch (err) {
        await reply({ ok: false, error: err?.message || String(err) });
      }
    })();
    return false;
  }

  if (message?.type === "START_COOKIE_FETCH") {
    sendResponse({
      ok: false,
      error: "Đã bỏ lấy cookie qua extension — dùng GemLogin/CDP hoặc dán cookie thủ công",
    });
    return false;
  }

  if (message?.type === "APPLY_COOKIES_LOCAL") {
    sendResponse({
      ok: false,
      error: "Đã bỏ gắn cookie qua extension — dùng GemLogin profile đã login",
    });
    return false;
  }

  return false;
});