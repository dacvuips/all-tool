/**
 * Lịch sử import / phiên làm việc — lưu IndexedDB (giống scene history affiliate-video).
 */
import {
  idbClearImportHistory,
  idbGetImportHistoryList,
  idbGetSelectedImportHistoryId,
  idbSetImportHistoryList,
  idbSetSelectedImportHistoryId,
} from "./idb";
import { AffiliatePlusItem } from "./types";

export const MAX_IMPORT_HISTORY = 30;

export type ImportSessionData = {
  fileName: string;
  items: AffiliatePlusItem[];
};

export type ImportHistoryItem = {
  id: string;
  createdAt: number;
  label: string;
  data: ImportSessionData;
};

function isEphemeralMediaUrl(url: string): boolean {
  const u = String(url || "").trim();
  return u.startsWith("blob:") || u.startsWith("data:");
}

/** Chuẩn hóa items trước khi ghi history (không lưu blob/data; giữ index slot). */
export function sanitizeItemsForHistory(items: AffiliatePlusItem[]): AffiliatePlusItem[] {
  return items.map((i) => {
    const videoUrls = (i.videoUrls || []).map((u) =>
      isEphemeralMediaUrl(u) ? "" : String(u || "").trim()
    );
    return {
      ...i,
      videoUrls,
      videoDisabled: videoUrls.map((_, idx) => Boolean(i.videoDisabled?.[idx])),
      mergedVideoUrl: isEphemeralMediaUrl(i.mergedVideoUrl || "") ? "" : i.mergedVideoUrl || "",
      status:
        i.status === "running" || i.status === "uploading"
          ? videoUrls.some(Boolean)
            ? ("success" as const)
            : ("waiting" as const)
          : i.status,
      countdown: i.status === "running" || i.status === "uploading" ? 0 : i.countdown,
    };
  });
}

function buildLabel(fileName: string, createdAt: number): string {
  const now = new Date(createdAt);
  const date = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const name = String(fileName || "").trim() || "Import";
  return `${name} – ${date} ${time}`;
}

export async function getImportHistory(): Promise<ImportHistoryItem[]> {
  return idbGetImportHistoryList<ImportHistoryItem>();
}

export async function getSelectedImportHistoryId(): Promise<string | null> {
  return idbGetSelectedImportHistoryId();
}

export async function setSelectedImportHistoryId(id: string | null): Promise<void> {
  await idbSetSelectedImportHistoryId(id);
}

export async function pushImportHistory(params: {
  fileName: string;
  items: AffiliatePlusItem[];
}): Promise<ImportHistoryItem> {
  const existing = await getImportHistory();
  const createdAt = Date.now();
  const newItem: ImportHistoryItem = {
    id: crypto.randomUUID(),
    createdAt,
    label: buildLabel(params.fileName, createdAt),
    data: {
      fileName: String(params.fileName || "").trim() || "Import",
      items: sanitizeItemsForHistory(params.items),
    },
  };
  const updated = [newItem, ...existing].slice(0, MAX_IMPORT_HISTORY);
  await idbSetImportHistoryList(updated);
  await idbSetSelectedImportHistoryId(newItem.id);
  return newItem;
}

/** Cập nhật snapshot items của một phiên (đồng bộ tiến độ generate/merge). */
export async function updateImportHistoryItems(
  id: string,
  items: AffiliatePlusItem[]
): Promise<void> {
  if (!id) return;
  const existing = await getImportHistory();
  const idx = existing.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const next = [...existing];
  next[idx] = {
    ...next[idx],
    data: {
      ...next[idx].data,
      items: sanitizeItemsForHistory(items),
    },
  };
  await idbSetImportHistoryList(next);
}

export async function clearImportHistory(): Promise<void> {
  await idbClearImportHistory();
}

/**
 * Nếu chưa có history nhưng localStorage đã có items → tạo 1 phiên "Phiên hiện tại".
 */
export async function ensureImportHistoryFromItems(
  items: AffiliatePlusItem[]
): Promise<ImportHistoryItem[]> {
  const existing = await getImportHistory();
  if (existing.length || !items.length) return existing;
  await pushImportHistory({ fileName: "Phiên hiện tại", items });
  return getImportHistory();
}

export function formatImportHistoryOption(item: ImportHistoryItem): string {
  const count = item.data?.items?.length ?? 0;
  return `${item.label} (${count} luồng)`;
}
