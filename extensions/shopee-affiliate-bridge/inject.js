/**
 * MAIN world — hook fetch/XHR list API + fetch phân trang (port aShopee, rút gọn).
 */
(function () {
  if (window.__allToolShopeeBridge) return;
  window.__allToolShopeeBridge = true;

  const DEFAULT_PAGE_LIMIT = 20;
  let lastListRequestUrl = null;
  let capturePaused = false;
  let running = false;

  function getMarketConfig() {
    const host = window.location.hostname.toLowerCase();
    const m = host.match(/^affiliate\.(shopee\..+)$/i);
    if (m) {
      const mallHost = m[1].toLowerCase();
      const tld = mallHost.replace(/^shopee\./i, "");
      const parts = tld.split(".").filter(Boolean);
      const cdnRegion = parts[0] || "vn";
      return {
        host,
        mallHost,
        imageCdn: `https://down-${cdnRegion}.img.susercontent.com/file/`,
      };
    }
    return {
      host,
      mallHost: "shopee.vn",
      imageCdn: "https://down-vn.img.susercontent.com/file/",
    };
  }

  function isListApiUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return false;
    try {
      const url = new URL(rawUrl, window.location.origin);
      if (url.origin !== window.location.origin) return false;
      if (!url.pathname.includes("/api/v3/offer/product/list")) return false;
      return url.searchParams.has("list_type");
    } catch {
      return false;
    }
  }

  function rememberListUrl(rawUrl) {
    if (capturePaused) return;
    if (!isListApiUrl(rawUrl)) return;
    lastListRequestUrl = new URL(rawUrl, window.location.origin).toString();
    window.postMessage(
      {
        source: "viet-theo-bridge",
        action: "LIST_URL",
        listRequestUrl: lastListRequestUrl,
        domain: getMarketConfig().host,
        marketCode: (() => {
          const host = getMarketConfig().host;
          const m = host.match(/^affiliate\.(shopee\..+)$/i);
          if (!m) return "";
          const tld = m[1].replace(/^shopee\./i, "");
          const parts = tld.split(".").filter(Boolean);
          return (parts[parts.length - 1] || "").toUpperCase();
        })(),
      },
      "*"
    );
  }

  function installNetworkHooks() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === "function") {
      window.fetch = function (input, init) {
        const rawUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : input && input.url;
        rememberListUrl(rawUrl);
        return nativeFetch.call(this, input, init);
      };
    }

    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__atUrl = url;
      return nativeOpen.call(this, method, url, ...rest);
    };
    const nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
      rememberListUrl(this.__atUrl);
      return nativeSend.apply(this, args);
    };
  }

  installNetworkHooks();

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function formatImageUrl(imageId, market) {
    if (!imageId) return "";
    if (String(imageId).startsWith("http")) return imageId;
    return `${market.imageCdn}${imageId}`;
  }

  function extractList(payload) {
    const data = payload?.data || payload;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  }

  function extractTotal(payload) {
    const data = payload?.data || payload;
    for (const value of [data?.total_count, data?.total, data?.page_info?.total, data?.pagination?.total]) {
      if (typeof value === "number" && value >= 0) return value;
    }
    return null;
  }

  /** Gộp top-level + batch_item_for_item_card_full — giữ nguyên tên field API. */
  function flattenProduct(item, index, pageOffset, market) {
    const card =
      item?.batch_item_for_item_card_full && typeof item.batch_item_for_item_card_full === "object"
        ? item.batch_item_for_item_card_full
        : {};
    const shopId = String(card.shopid || "");
    const itemId = String(item?.item_id || card.itemid || "");
    const row = {
      stt: pageOffset + index + 1,
    };

    if (item && typeof item === "object") {
      for (const [key, value] of Object.entries(item)) {
        if (key === "batch_item_for_item_card_full") continue;
        row[key] = value ?? "";
      }
    }

    for (const [key, value] of Object.entries(card)) {
      row[key] = value ?? "";
    }

    if (!row.product_link && shopId && itemId) {
      row.product_link = `https://${market.mallHost}/product/${shopId}/${itemId}`;
    }

    row.image_url = formatImageUrl(card.image, market);
    row.affiliate_link_short = "";
    return row;
  }

  function getPageLimitFromUrl(templateUrl) {
    try {
      const limit = parseInt(new URL(templateUrl).searchParams.get("page_limit"), 10);
      if (Number.isFinite(limit) && limit > 0) return limit;
    } catch {}
    return DEFAULT_PAGE_LIMIT;
  }

  async function fetchPage(templateUrl, pageOffset) {
    const url = new URL(templateUrl);
    url.searchParams.set("page_offset", String(pageOffset));
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
        "affiliate-program-type": "1",
        referer: window.location.href,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const json = await response.json();
    if (json.code !== 0 && json.code !== undefined) {
      throw new Error(json.msg || json.message || `API error code: ${json.code}`);
    }
    return json;
  }

  function buildListUrl(options) {
    const host = window.location.hostname;
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
    return url.toString();
  }

  async function fetchOneProductPage(options) {
    const market = getMarketConfig();
    const pageOffset = Number(options.pageOffset) >= 0 ? Number(options.pageOffset) : 0;
    const pageLimit = Number(options.pageLimit) > 0 ? Number(options.pageLimit) : DEFAULT_PAGE_LIMIT;
    const templateUrl = buildListUrl({ ...options, pageOffset: 0 });
    const payload = await fetchPage(templateUrl, pageOffset);
    const list = extractList(payload);
    const totalCount = extractTotal(payload);
    const products = list.map((item, index) => flattenProduct(item, index, pageOffset, market));
    // Không tin total_count (Shopee hay cap 500) — chỉ dừng khi trang không đầy.
    const hasMore = list.length >= pageLimit;
    let keyword = "";
    try {
      keyword = new URL(templateUrl).searchParams.get("keyword") || "";
    } catch {}
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

  const SHORT_LINK_QUERY = `
    query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
        shortLink
        longLink
        failCode
      }
    }
  `;
  const SHORT_LINK_BATCH_SIZE = 10;

  function getShortLinkApiUrl() {
    return `${window.location.origin}/api/v3/gql?q=batchCustomLink`;
  }

  async function fetchShortLinksBatch(originalLinks) {
    const response = await fetch(getShortLinkApiUrl(), {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json;charset=UTF-8",
        "affiliate-program-type": "1",
        referer: window.location.href,
      },
      body: JSON.stringify({
        operationName: "batchGetCustomLink",
        query: SHORT_LINK_QUERY,
        variables: {
          linkParams: originalLinks.map((originalLink) => ({
            originalLink,
            advancedLinkParams: {},
          })),
          sourceCaller: "CUSTOM_LINK_CALLER",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Short link HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || "GraphQL short link error");
    }

    const results = json?.data?.batchCustomLink;
    if (!Array.isArray(results)) {
      throw new Error("Short link response invalid");
    }

    return results.map((item) => {
      if (!item || item.failCode) return "";
      return item.shortLink || "";
    });
  }

  async function enrichProductsWithShortLinks(products, delayMs) {
    const withLinks = products
      .map((p, index) => ({ index, link: p.long_link || p.affiliate_link }))
      .filter((row) => !!row.link);

    if (!withLinks.length) return products;

    for (let i = 0; i < withLinks.length; i += SHORT_LINK_BATCH_SIZE) {
      const chunk = withLinks.slice(i, i + SHORT_LINK_BATCH_SIZE);
      const done = Math.min(i + chunk.length, withLinks.length);

      window.postMessage(
        {
          source: "viet-theo-bridge",
          action: "PROGRESS",
          progress: {
            phase: "short_links",
            message: `Đang lấy link short ${done}/${withLinks.length}...`,
            fetched: done,
            total: withLinks.length,
            page: Math.floor(i / SHORT_LINK_BATCH_SIZE) + 1,
          },
        },
        "*"
      );

      try {
        const shortLinks = await fetchShortLinksBatch(chunk.map((c) => c.link));
        chunk.forEach((row, idx) => {
          products[row.index].affiliate_link_short = shortLinks[idx] || "";
        });
      } catch (error) {
        console.warn("[Viet-Theo-Bridge] short link batch failed:", error?.message || error);
      }

      if (i + SHORT_LINK_BATCH_SIZE < withLinks.length) {
        await sleep(Math.max(200, delayMs || 400));
      }
    }

    return products;
  }

  async function fetchAllProducts(options) {
    if (!lastListRequestUrl) {
      throw new Error("Chưa bắt được list API. Hãy tìm kiếm / lọc / lật trang trước.");
    }
    const market = getMarketConfig();
    const templateUrl = lastListRequestUrl;
    const pageLimit = getPageLimitFromUrl(templateUrl);
    const maxProducts = Number(options.maxProducts) || 0;
    const delayMs = Math.max(0, Number(options.delayMs) || 400);
    let keyword = "";
    try {
      keyword = new URL(templateUrl).searchParams.get("keyword") || "";
    } catch {}

    const allProducts = [];
    let pageOffset = 0;
    let totalCount = null;
    let pageNumber = 0;

    capturePaused = true;
    try {
      while (true) {
        if (maxProducts > 0 && allProducts.length >= maxProducts) break;
        pageNumber += 1;
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "PROGRESS",
            progress: {
              phase: "fetching",
              message: `Đang tải trang ${pageNumber}...`,
              fetched: allProducts.length,
              total: maxProducts > 0 ? maxProducts : totalCount,
              page: pageNumber,
            },
          },
          "*"
        );

        const payload = await fetchPage(templateUrl, pageOffset);
        const list = extractList(payload);
        if (totalCount === null) totalCount = extractTotal(payload);
        if (!list.length) break;

        list.forEach((item, index) => {
          if (maxProducts > 0 && allProducts.length >= maxProducts) return;
          allProducts.push(flattenProduct(item, index, pageOffset, market));
        });

        if (maxProducts > 0 && allProducts.length >= maxProducts) break;
        if (list.length < pageLimit) break;
        if (totalCount !== null && allProducts.length >= totalCount) break;
        pageOffset += pageLimit;
        await sleep(delayMs);
      }

      await enrichProductsWithShortLinks(allProducts, delayMs);

      return {
        products: allProducts,
        keyword,
        templateUrl,
        domain: market.host,
        marketCode: (() => {
          const m = market.host.match(/^affiliate\.(shopee\..+)$/i);
          if (!m) return "";
          const tld = m[1].replace(/^shopee\./i, "");
          const parts = tld.split(".").filter(Boolean);
          return (parts[parts.length - 1] || "").toUpperCase();
        })(),
      };
    } finally {
      capturePaused = false;
    }
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "viet-theo-bridge") return;

    if (data.action === "HAS_LIST_URL") {
      window.postMessage(
        {
          source: "viet-theo-bridge",
          action: "HAS_LIST_URL_RESULT",
          requestId: data.requestId,
          hasListUrl: !!lastListRequestUrl,
          listRequestUrl: lastListRequestUrl,
        },
        "*"
      );
      return;
    }

    if (data.action === "FETCH_ALL") {
      if (running) return;
      running = true;
      try {
        const result = await fetchAllProducts(data.options || {});
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "FETCH_DONE",
            requestId: data.requestId,
            result,
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "FETCH_ERROR",
            requestId: data.requestId,
            error: err?.message || String(err),
          },
          "*"
        );
      } finally {
        running = false;
      }
      return;
    }

    if (data.action === "FETCH_PAGE") {
      if (running) {
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "FETCH_PAGE_ERROR",
            requestId: data.requestId,
            error: "Đang chạy",
          },
          "*"
        );
        return;
      }
      running = true;
      try {
        const result = await fetchOneProductPage(data.options || {});
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "FETCH_PAGE_DONE",
            requestId: data.requestId,
            result,
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            source: "viet-theo-bridge",
            action: "FETCH_PAGE_ERROR",
            requestId: data.requestId,
            error: err?.message || String(err),
          },
          "*"
        );
      } finally {
        running = false;
      }
    }
  });
})();
