/**
 * Lịch sử import / phiên làm việc — metadata trong IndexedDB.
 * Items thực tế nằm ở store `threads` (keyed by sessionId = history id).
 */
import {
  idbClearImportHistory,
  idbGetImportHistoryList,
  idbGetSelectedImportHistoryId,
  idbSetImportHistoryList,
  idbSetSelectedImportHistoryId,
} from "./idb";
import { replaceSessionThreads } from "./thread-store";
import { AffiliatePlusItem } from "./types";
import { toPersistedMergedVideoUrl } from "./merged-video";

function isEphemeralMediaUrl(url: string): boolean {
  const u = String(url || "").trim();
  return u.startsWith("blob:") || u.startsWith("data:");
}

/** Chuẩn hóa items trước khi ghi threads (không lưu blob/data/prompt; giữ index slot). */
function sanitizeItemsForHistory(items: AffiliatePlusItem[]): AffiliatePlusItem[] {
  return items.map((i) => {
    const videoUrls = (i.videoUrls || []).map((u) =>
      isEphemeralMediaUrl(u) ? "" : String(u || "").trim()
    );
    return {
      ...i,
      prompt: "",
      videoUrls,
      videoDisabled: videoUrls.map((_, idx) => Boolean(i.videoDisabled?.[idx])),
      mergedVideoUrl: toPersistedMergedVideoUrl(i.mergedVideoUrl),
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

export const MAX_IMPORT_HISTORY = 30;

export type ImportSessionData = {
  fileName: string;
  itemCount: number;
  /** @deprecated Chỉ còn trên bản ghi cũ — đã migrate sang threads store */
  items?: AffiliatePlusItem[];
};

export type ImportHistoryItem = {
  id: string;
  createdAt: number;
  label: string;
  data: ImportSessionData;
};

function buildLabel(fileName: string, createdAt: number): string {
  const now = new Date(createdAt);
  const date = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const name = String(fileName || "").trim() || "Import";
  return `${name} – ${date} ${time}`;
}

function normalizeHistoryEntry(raw: ImportHistoryItem): ImportHistoryItem {
  const fileName = String(raw.data?.fileName || "").trim() || "Import";
  const legacyItems = Array.isArray(raw.data?.items) ? raw.data.items : undefined;
  const itemCount =
    typeof raw.data?.itemCount === "number"
      ? raw.data.itemCount
      : legacyItems?.length ?? 0;
  return {
    ...raw,
    data: {
      fileName,
      itemCount,
      ...(legacyItems?.length ? { items: legacyItems } : {}),
    },
  };
}

function stripLegacyItems(entry: ImportHistoryItem): ImportHistoryItem {
  const { items: _legacy, ...restData } = entry.data;
  return {
    ...entry,
    data: {
      fileName: restData.fileName,
      itemCount: restData.itemCount,
    },
  };
}

/** Migrate bản ghi cũ (có data.items) → threads store; history chỉ giữ metadata. */
export async function migrateLegacyImportHistory(): Promise<ImportHistoryItem[]> {
  const raw = await idbGetImportHistoryList<ImportHistoryItem>();
  if (!raw.length) return [];

  let changed = false;
  const next: ImportHistoryItem[] = [];

  for (const entry of raw.map(normalizeHistoryEntry)) {
    const legacyItems = entry.data.items;
    if (legacyItems?.length) {
      const sanitized = sanitizeItemsForHistory(legacyItems);
      await replaceSessionThreads(entry.id, sanitized);
      next.push(stripLegacyItems({ ...entry, data: { ...entry.data, itemCount: sanitized.length } }));
      changed = true;
    } else {
      next.push(stripLegacyItems(entry));
      if (entry.data.items) changed = true;
    }
  }

  if (changed) await idbSetImportHistoryList(next);
  return next;
}

export async function getImportHistory(): Promise<ImportHistoryItem[]> {
  const list = await idbGetImportHistoryList<ImportHistoryItem>();
  return list.map(normalizeHistoryEntry).map(stripLegacyItems);
}

export async function getSelectedImportHistoryId(): Promise<string | null> {
  return idbGetSelectedImportHistoryId();
}

export async function setSelectedImportHistoryId(id: string | null): Promise<void> {
  await idbSetSelectedImportHistoryId(id);
}

export async function pushImportHistory(params: {
  fileName: string;
  itemCount: number;
}): Promise<ImportHistoryItem> {
  const existing = await getImportHistory();
  const createdAt = Date.now();
  const newItem: ImportHistoryItem = {
    id: crypto.randomUUID(),
    createdAt,
    label: buildLabel(params.fileName, createdAt),
    data: {
      fileName: String(params.fileName || "").trim() || "Import",
      itemCount: Math.max(0, params.itemCount),
    },
  };
  const updated = [newItem, ...existing].slice(0, MAX_IMPORT_HISTORY);
  await idbSetImportHistoryList(updated);
  await idbSetSelectedImportHistoryId(newItem.id);
  return newItem;
}

/** Cập nhật số luồng của phiên (đồng bộ sau import/xóa). */
export async function updateImportHistoryCount(id: string, itemCount: number): Promise<void> {
  if (!id) return;
  const existing = await idbGetImportHistoryList<ImportHistoryItem>();
  const idx = existing.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const next = [...existing];
  const entry = normalizeHistoryEntry(next[idx]);
  next[idx] = stripLegacyItems({
    ...entry,
    data: {
      fileName: entry.data.fileName,
      itemCount: Math.max(0, itemCount),
    },
  });
  await idbSetImportHistoryList(next);
}

export async function clearImportHistory(): Promise<void> {
  await idbClearImportHistory();
}

/**
 * Nếu chưa có history nhưng localStorage đã có items → tạo 1 phiên "Phiên hiện tại".
 * Caller phải ghi items vào threads store (replaceSessionThreads).
 */
export async function ensureImportHistoryFromItems(
  items: AffiliatePlusItem[]
): Promise<ImportHistoryItem[]> {
  const existing = await getImportHistory();
  if (existing.length || !items.length) return existing;
  await pushImportHistory({ fileName: "Phiên hiện tại", itemCount: items.length });
  return getImportHistory();
}

export function formatImportHistoryOption(item: ImportHistoryItem): string {
  const count = item.data?.itemCount ?? item.data?.items?.length ?? 0;
  return `${item.label} (${count} luồng)`;
}
