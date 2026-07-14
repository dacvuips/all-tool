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

async function findAffiliateTab() {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = activeTabs[0];
  if (active?.url && isAffiliateProductOfferUrl(active.url)) {
    return active;
  }

  const tabs = await chrome.tabs.query({});
  const affiliateTabs = tabs.filter((t) => t.url && isAffiliateProductOfferUrl(t.url));
  if (!affiliateTabs.length) return null;

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

  return false;
});
