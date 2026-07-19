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
    }
  });
})();
