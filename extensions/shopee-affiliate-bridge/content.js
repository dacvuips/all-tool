/**
 * Isolated world — cầu nối inject ↔ background, đẩy SP về Viet-Theo-Bridge.
 */
(function () {
  const SOURCE = "viet-theo-bridge";
  let busy = false;

  function postToPage(payload) {
    window.postMessage({ source: SOURCE, ...payload }, "*");
  }

  function runFetchAll(options) {
    return new Promise((resolve, reject) => {
      const requestId = `fetch-${Date.now()}`;
      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== SOURCE || data.requestId !== requestId) return;

        if (data.action === "PROGRESS") {
          chrome.runtime
            .sendMessage({ type: "PAGE_PROGRESS", progress: data.progress })
            .catch(() => {});
          return;
        }
        if (data.action === "FETCH_DONE") {
          window.removeEventListener("message", onMessage);
          resolve(data.result);
        }
        if (data.action === "FETCH_ERROR") {
          window.removeEventListener("message", onMessage);
          reject(new Error(data.error || "Fetch failed"));
        }
      };
      window.addEventListener("message", onMessage);
      postToPage({ action: "FETCH_ALL", requestId, options });
    });
  }

  function runFetchPage(options) {
    return new Promise((resolve, reject) => {
      const requestId = `page-${Date.now()}`;
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        fn(value);
      };
      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== SOURCE || data.requestId !== requestId) return;
        if (data.action === "FETCH_PAGE_DONE") {
          finish(resolve, data.result);
        }
        if (data.action === "FETCH_PAGE_ERROR") {
          finish(reject, new Error(data.error || "Fetch page failed"));
        }
      };
      const timer = window.setTimeout(() => {
        finish(reject, new Error("Hết thời gian chờ fetch page"));
      }, 45000);
      window.addEventListener("message", onMessage);
      postToPage({ action: "FETCH_PAGE", requestId, options });
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;
    if (data.action === "LIST_URL") {
      chrome.runtime
        .sendMessage({
          type: "LIST_URL_CAPTURED",
          listRequestUrl: data.listRequestUrl,
          domain: data.domain || window.location.hostname,
          marketCode: data.marketCode || "",
        })
        .catch(() => {});
    }
    if (data.action === "PROGRESS") {
      chrome.runtime
        .sendMessage({ type: "PAGE_PROGRESS", progress: data.progress })
        .catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING") {
      sendResponse({ ok: true, href: location.href });
      return false;
    }

    if (message?.type === "HAS_LIST_URL") {
      const requestId = `has-${Date.now()}`;
      let done = false;
      const finish = (payload) => {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMessage);
        sendResponse(payload);
      };
      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== SOURCE || data.requestId !== requestId) return;
        if (data.action !== "HAS_LIST_URL_RESULT") return;
        finish({
          ok: true,
          hasListUrl: Boolean(data.hasListUrl),
          listRequestUrl: data.listRequestUrl || null,
        });
      };
      window.addEventListener("message", onMessage);
      postToPage({ action: "HAS_LIST_URL", requestId });
      setTimeout(() => {
        finish({ ok: true, hasListUrl: false, listRequestUrl: null });
      }, 1500);
      return true;
    }

    if (message?.type === "START_EXPORT") {
      if (busy) {
        sendResponse({ ok: false, error: "Đang chạy" });
        return false;
      }
      busy = true;
      runFetchAll({
        maxProducts: Number.isFinite(Number(message.maxProducts))
          ? Number(message.maxProducts)
          : 500,
        delayMs: Number.isFinite(Number(message.delayMs)) ? Number(message.delayMs) : 400,
      })
        .then((result) => {
          busy = false;
          sendResponse({ ok: true, result });
        })
        .catch((err) => {
          busy = false;
          sendResponse({ ok: false, error: err?.message || String(err) });
        });
      return true;
    }

    if (message?.type === "FETCH_PRODUCT_PAGE") {
      if (busy) {
        sendResponse({ ok: false, error: "Đang chạy" });
        return false;
      }
      busy = true;
      runFetchPage({
        keyword: message.keyword || "",
        sortType: message.sortType,
        pageOffset: message.pageOffset,
        pageLimit: message.pageLimit,
        listType: message.listType,
      })
        .then((result) => {
          busy = false;
          sendResponse({
            ok: true,
            products: result?.products || [],
            hasMore: Boolean(result?.hasMore),
            totalCount: result?.totalCount ?? null,
            keyword: result?.keyword || "",
            marketHost: result?.marketHost || "",
          });
        })
        .catch((err) => {
          busy = false;
          sendResponse({ ok: false, error: err?.message || String(err) });
        });
      return true;
    }

    return false;
  });
})();
