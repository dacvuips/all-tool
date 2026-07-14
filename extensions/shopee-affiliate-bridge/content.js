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

    return false;
  });
})();
