/**
 * Chạy trên trang Viet-Theo-Bridge (localhost) — nhận domain API khi user bấm Mở Trình duyệt.
 */
(function () {
  const SOURCE = "viet-theo-bridge-app";

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
    }
  });
})();
