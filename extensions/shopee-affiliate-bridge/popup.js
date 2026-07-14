const maxProductsEl = document.getElementById("maxProducts");
const delayMsEl = document.getElementById("delayMs");
const statusEl = document.getElementById("status");
const apiHintEl = document.getElementById("apiHint");

function setApiStatus(connected) {
  apiHintEl.classList.toggle("off", !connected);
  apiHintEl.textContent = connected
    ? "Đã kết nối API"
    : "Chưa kết nối API — bấm Mở Trình duyệt trên Viet-Theo-Bridge";
}

function syncPresetActive(groupId, value) {
  const group = document.getElementById(groupId);
  group.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", String(btn.dataset.v) === String(value));
  });
}

async function load() {
  const data = await chrome.storage.local.get(["apiBase", "maxProducts", "delayMs"]);
  maxProductsEl.value = data.maxProducts != null ? data.maxProducts : 500;
  delayMsEl.value = data.delayMs != null ? data.delayMs : 400;
  syncPresetActive("productPresets", maxProductsEl.value);
  syncPresetActive("delayPresets", delayMsEl.value);
  setApiStatus(Boolean(data.apiBase));
  await refresh();
}

async function saveConfig() {
  await chrome.storage.local.set({
    maxProducts: Number(maxProductsEl.value) || 0,
    delayMs: Number(delayMsEl.value) || 0,
  });
}

document.getElementById("productPresets").onclick = (e) => {
  const btn = e.target.closest("button[data-v]");
  if (!btn) return;
  maxProductsEl.value = btn.dataset.v;
  syncPresetActive("productPresets", btn.dataset.v);
};

document.getElementById("delayPresets").onclick = (e) => {
  const btn = e.target.closest("button[data-v]");
  if (!btn) return;
  delayMsEl.value = btn.dataset.v;
  syncPresetActive("delayPresets", btn.dataset.v);
};

maxProductsEl.oninput = () => syncPresetActive("productPresets", maxProductsEl.value);
delayMsEl.oninput = () => syncPresetActive("delayPresets", delayMsEl.value);

async function refresh() {
  statusEl.textContent = "Đang kiểm tra...";
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = chrome.runtime.lastError.message;
      return;
    }
    if (!res?.ok) {
      statusEl.textContent = res?.error || "Không lấy được trạng thái";
      return;
    }
    setApiStatus(Boolean(res.apiBase));
    statusEl.textContent = [
      `Domain: ${res.domain ? `${res.domain}${res.marketCode ? ` (${res.marketCode})` : ""}` : "—"}`,
      `Tab Affiliate: ${res.hasAffiliateTab ? "có" : "chưa"}`,
      `List API: ${res.hasListUrl ? "đã bắt" : "chưa (tìm kiếm/lật trang)"}`,
      `Đang gửi: ${res.exporting ? "có" : "không"}`,
      `Max: ${res.maxProducts} · Delay: ${res.delayMs}ms`,
    ].join("\n");
  });
}

document.getElementById("refresh").onclick = () => void refresh();

document.getElementById("send").onclick = async () => {
  await saveConfig();
  statusEl.textContent = "Đang cào + gửi CSV...";
  chrome.runtime.sendMessage(
    {
      type: "SEND_CSV",
      maxProducts: Number(maxProductsEl.value) || 0,
      delayMs: Number(delayMsEl.value) || 0,
    },
    (res) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = chrome.runtime.lastError.message;
        return;
      }
      if (!res?.ok) {
        statusEl.textContent = res?.error || "Gửi thất bại";
        return;
      }
      statusEl.textContent = `Đã gửi ${res.count} SP\nDomain: ${res.domain || "—"}${
        res.marketCode ? ` (${res.marketCode})` : ""
      }\nID: ${res.sessionId}\nThời gian: ${Math.round((res.durationMs || 0) / 1000)}s\n→ Web sẽ lưu vào IndexedDB`;
    }
  );
};

void load();
