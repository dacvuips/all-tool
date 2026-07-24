/**
 * Lịch sử lấy / gắn cookie Shopee — IndexedDB (`cookie-fetch-history`).
 */
import {
  idbClearCookieFetchHistory,
  idbGetCookieFetchHistoryList,
  idbSetCookieFetchHistoryList,
} from "./idb";

export const MAX_COOKIE_FETCH_HISTORY = 800;

export type CookieFetchHistoryAction =
  | "fetch_start"
  | "fetch_success"
  | "fetch_captcha"
  | "fetch_error"
  | "fetch_cancelled"
  | "apply_success"
  | "apply_error"
  | "batch_start"
  | "batch_stop"
  | "batch_end";

export type CookieFetchHistoryEntry = {
  id: string;
  createdAt: number;
  userId: string;
  username: string;
  domain: string;
  action: CookieFetchHistoryAction;
  message: string;
  jobId?: string;
  cookiePreview?: string;
  spcFPreview?: string;
  appliedCount?: number;
};

function preview(value: string, max = 56): string {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.length <= max ? v : `${v.slice(0, max)}…`;
}

export async function loadCookieFetchHistory(): Promise<CookieFetchHistoryEntry[]> {
  const list = await idbGetCookieFetchHistoryList<CookieFetchHistoryEntry>();
  return list
    .filter((e) => e && e.id && e.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadCookieFetchHistoryByUser(
  userId: string
): Promise<CookieFetchHistoryEntry[]> {
  const id = String(userId || "").trim();
  if (!id) return [];
  const all = await loadCookieFetchHistory();
  return all.filter((e) => e.userId === id);
}

export async function appendCookieFetchHistory(
  input: Omit<CookieFetchHistoryEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<CookieFetchHistoryEntry> {
  const entry: CookieFetchHistoryEntry = {
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || Date.now(),
    userId: String(input.userId || "").trim(),
    username: String(input.username || "").trim(),
    domain: String(input.domain || "").trim(),
    action: input.action,
    message: String(input.message || "").trim(),
    jobId: input.jobId ? String(input.jobId) : undefined,
    cookiePreview: input.cookiePreview ? preview(input.cookiePreview) : undefined,
    spcFPreview: input.spcFPreview ? preview(input.spcFPreview, 40) : undefined,
    appliedCount: input.appliedCount,
  };

  const existing = await idbGetCookieFetchHistoryList<CookieFetchHistoryEntry>();
  const next = [entry, ...existing.filter((e) => e?.id !== entry.id)].slice(
    0,
    MAX_COOKIE_FETCH_HISTORY
  );
  await idbSetCookieFetchHistoryList(next);
  return entry;
}

export async function clearCookieFetchHistory(): Promise<void> {
  await idbClearCookieFetchHistory();
}

export function cookieFetchActionLabel(action: CookieFetchHistoryAction): string {
  switch (action) {
    case "fetch_start":
      return "Bắt đầu lấy cookie";
    case "fetch_success":
      return "Lấy cookie thành công";
    case "fetch_captcha":
      return "Gặp captcha";
    case "fetch_error":
      return "Lấy cookie lỗi";
    case "fetch_cancelled":
      return "Đã hủy (đóng tab)";
    case "apply_success":
      return "Gắn cookie vào Chrome";
    case "apply_error":
      return "Gắn cookie thất bại";
    case "batch_start":
      return "Chạy tất cả — bắt đầu";
    case "batch_stop":
      return "Chạy tất cả — dừng";
    case "batch_end":
      return "Chạy tất cả — kết thúc";
    default:
      return action;
  }
}

export function cookieFetchActionTone(
  action: CookieFetchHistoryAction
): "ok" | "warn" | "error" | "info" {
  switch (action) {
    case "fetch_success":
    case "apply_success":
    case "batch_end":
      return "ok";
    case "fetch_captcha":
    case "batch_stop":
    case "fetch_cancelled":
      return "warn";
    case "fetch_error":
    case "apply_error":
      return "error";
    default:
      return "info";
  }
}
