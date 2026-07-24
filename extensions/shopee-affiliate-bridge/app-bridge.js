/**
 * Chạy trên trang Viet-Theo-Bridge (localhost) —
 * nhận domain API + lệnh lấy cookie từ web.
 */
(function () {
  const SOURCE = "viet-theo-bridge-app";
  const EXT_SOURCE = "viet-theo-bridge-extension";

  function saveApiBase(apiBase) {
    try {
      const base = String(apiBase || "").replace(/\/$/, "");
      const u = new URL(base);
      if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return;
      chrome.storage.local.set({ apiBase: u.origin }, () => {
        chrome.runtime.sendMessage({ type: "API_BASE_UPDATED", apiBase: u.origin }).catch(() => {});
      });
    } catch {
      // ignore
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    if (data.type === "SET_API_BASE" && data.apiBase) {
      saveApiBase(data.apiBase);
      return;
    }

    if (data.type === "EXTENSION_PING") {
      if (data.apiBase) saveApiBase(data.apiBase);
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "EXTENSION_PING_RESULT",
          requestId: data.requestId,
          ok: true,
        },
        "*"
      );
      return;
    }

    if (data.type === "START_COOKIE_FETCH") {
      if (data.apiBase) saveApiBase(data.apiBase);
      chrome.runtime.sendMessage(
        {
          type: "START_COOKIE_FETCH",
          jobId: data.jobId,
          userId: data.userId,
          username: data.username,
          password: data.password,
          loginUrl: data.loginUrl || "https://shopee.vn/buyer/login",
          spcF: data.spcF || "",
        },
        (res) => {
          const errMsg = chrome.runtime.lastError?.message || "";
          // Job chạy nền lâu — Chrome có thể báo channel closed; bỏ qua, chờ COOKIE_FETCH_RESULT
          if (/message channel closed|asynchronous response/i.test(errMsg)) {
            return;
          }
          if (errMsg) {
            window.postMessage(
              {
                source: EXT_SOURCE,
                type: "COOKIE_FETCH_RESULT",
                jobId: data.jobId,
                userId: data.userId,
                status: "error",
                error: errMsg,
              },
              "*"
            );
            return;
          }
          // started: true → chờ kết quả thật qua COOKIE_FETCH_RESULT
          if (res && res.ok === false) {
            window.postMessage(
              {
                source: EXT_SOURCE,
                type: "COOKIE_FETCH_RESULT",
                jobId: data.jobId,
                userId: data.userId,
                status: res.captcha ? "captcha" : "error",
                error: res.error || "Extension lỗi",
              },
              "*"
            );
          }
        }
      );
      return;
    }

    if (data.type === "APPLY_COOKIES_LOCAL") {
      if (data.apiBase) saveApiBase(data.apiBase);
      chrome.runtime.sendMessage(
        {
          type: "APPLY_COOKIES_LOCAL",
          cookie: data.cookie,
          loginUrl: data.loginUrl || "https://shopee.vn/buyer/login",
        },
        (res) => {
          const errMsg = chrome.runtime.lastError?.message || "";
          if (/message channel closed|asynchronous response/i.test(errMsg)) {
            return;
          }
          window.postMessage(
            {
              source: EXT_SOURCE,
              type: "APPLY_COOKIES_LOCAL_RESULT",
              userId: data.userId,
              ok: Boolean(res?.ok),
              applied: res?.applied || 0,
              domain: res?.domain || "",
              homeUrl: res?.homeUrl || "",
              error: res?.error || errMsg || "",
            },
            "*"
          );
        }
      );
      return;
    }

    if (data.type === "START_PRODUCT_PAGE_FETCH") {
      if (data.apiBase) saveApiBase(data.apiBase);
      chrome.runtime.sendMessage(
        {
          type: "START_PRODUCT_PAGE_FETCH",
          requestId: data.requestId,
          marketHost: data.marketHost || "",
          keyword: data.keyword || "",
          sortType: data.sortType,
          pageOffset: data.pageOffset,
          pageLimit: data.pageLimit,
          listType: data.listType,
        },
        (res) => {
          const errMsg = chrome.runtime.lastError?.message || "";
          // started:true → chờ PRODUCT_PAGE_RESULT qua onMessage
          if (/message channel closed|asynchronous response/i.test(errMsg)) {
            return;
          }
          if (errMsg) {
            window.postMessage(
              {
                source: EXT_SOURCE,
                type: "PRODUCT_PAGE_RESULT",
                requestId: data.requestId,
                ok: false,
                products: [],
                hasMore: false,
                totalCount: null,
                keyword: data.keyword || "",
                marketHost: data.marketHost || "",
                error: errMsg,
              },
              "*"
            );
            return;
          }
          // res.started === true là bình thường — không post kết quả ở đây
          if (res && res.ok === false && !res.started) {
            window.postMessage(
              {
                source: EXT_SOURCE,
                type: "PRODUCT_PAGE_RESULT",
                requestId: data.requestId,
                ok: false,
                products: [],
                hasMore: false,
                totalCount: null,
                keyword: data.keyword || "",
                marketHost: data.marketHost || "",
                error: res.error || "Extension lỗi",
              },
              "*"
            );
          }
        }
      );
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "COOKIE_FETCH_RESULT") {
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "COOKIE_FETCH_RESULT",
          jobId: message.jobId,
          userId: message.userId,
          status: message.status,
          cookie: message.cookie || "",
          spcF: message.spcF || "",
          error: message.error || "",
        },
        "*"
      );
      return;
    }
    if (message?.type === "PRODUCT_PAGE_RESULT") {
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: "PRODUCT_PAGE_RESULT",
          requestId: message.requestId,
          ok: Boolean(message.ok),
          products: message.products || [],
          hasMore: Boolean(message.hasMore),
          totalCount: message.totalCount ?? null,
          keyword: message.keyword || "",
          marketHost: message.marketHost || "",
          error: message.error || "",
        },
        "*"
      );
    }
  });
})();
