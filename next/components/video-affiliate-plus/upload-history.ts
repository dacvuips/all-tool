/**
 * Lịch sử phiên Đăng video Shope — IndexedDB (`upload-history`).
 */
import {
  idbClearUploadHistory,
  idbGetSelectedUploadHistoryId,
  idbGetUploadHistoryList,
  idbSetSelectedUploadHistoryId,
  idbSetUploadHistoryList,
} from "./idb";
import { toPersistedMergedVideoUrl } from "./merged-video";

export const MAX_UPLOAD_HISTORY = 30;

export type PersistedUploadThread = {
  id: string;
  selected: boolean;
  username: string;
  cookie: string;
  country: string;
  caption: string;
  productLink: string;
  productId: string;
  generateItemId: string;
  videoFile: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  proxy: string;
  error: string;
  status: "stopped" | "running" | "success" | "error";
};

export type UploadSessionData = {
  fileName: string;
  itemCount: number;
  /** Id phiên Generate Video nguồn (nếu có) */
  generateSessionId?: string;
  threads: PersistedUploadThread[];
};

export type UploadHistoryItem = {
  id: string;
  createdAt: number;
  label: string;
  data: UploadSessionData;
};

function isEphemeralMediaUrl(url: string): boolean {
  const u = String(url || "").trim();
  return u.startsWith("blob:") || u.startsWith("data:");
}

function buildLabel(fileName: string, createdAt: number): string {
  const now = new Date(createdAt);
  const date = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const name = String(fileName || "").trim() || "Upload";
  return `${name} – ${date} ${time}`;
}

export function sanitizeUploadThreadForPersist(t: PersistedUploadThread): PersistedUploadThread {
  const videoFile = String(t.videoFile || "").trim();
  const cleaned = isEphemeralMediaUrl(videoFile)
    ? toPersistedMergedVideoUrl(videoFile)
    : videoFile;
  return {
    ...t,
    videoFile: cleaned,
    status: t.status === "running" ? "stopped" : t.status,
    error: t.error || "-",
  };
}

function normalizeEntry(raw: UploadHistoryItem): UploadHistoryItem {
  const fileName = String(raw.data?.fileName || "").trim() || "Upload";
  const threads = Array.isArray(raw.data?.threads)
    ? raw.data.threads.map((t) => sanitizeUploadThreadForPersist(t as PersistedUploadThread))
    : [];
  const itemCount =
    typeof raw.data?.itemCount === "number" ? raw.data.itemCount : threads.length;
  return {
    id: String(raw.id || crypto.randomUUID()),
    createdAt: Number(raw.createdAt) || Date.now(),
    label: String(raw.label || "").trim() || buildLabel(fileName, Number(raw.createdAt) || Date.now()),
    data: {
      fileName,
      itemCount,
      generateSessionId: raw.data?.generateSessionId,
      threads,
    },
  };
}

export async function getUploadHistory(): Promise<UploadHistoryItem[]> {
  const list = await idbGetUploadHistoryList<UploadHistoryItem>();
  return list.map(normalizeEntry);
}

export async function getSelectedUploadHistoryId(): Promise<string | null> {
  return idbGetSelectedUploadHistoryId();
}

export async function setSelectedUploadHistoryId(id: string | null): Promise<void> {
  await idbSetSelectedUploadHistoryId(id);
}

export async function pushUploadHistory(params: {
  fileName: string;
  threads: PersistedUploadThread[];
  generateSessionId?: string;
}): Promise<UploadHistoryItem> {
  const existing = await getUploadHistory();
  const createdAt = Date.now();
  const threads = params.threads.map(sanitizeUploadThreadForPersist);
  const newItem: UploadHistoryItem = {
    id: crypto.randomUUID(),
    createdAt,
    label: buildLabel(params.fileName, createdAt),
    data: {
      fileName: String(params.fileName || "").trim() || "Upload",
      itemCount: threads.length,
      generateSessionId: params.generateSessionId,
      threads,
    },
  };
  const updated = [newItem, ...existing].slice(0, MAX_UPLOAD_HISTORY);
  await idbSetUploadHistoryList(updated);
  await idbSetSelectedUploadHistoryId(newItem.id);
  return newItem;
}

export async function updateUploadHistorySession(
  id: string,
  threads: PersistedUploadThread[]
): Promise<void> {
  if (!id) return;
  const existing = await idbGetUploadHistoryList<UploadHistoryItem>();
  const idx = existing.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const next = [...existing];
  const entry = normalizeEntry(next[idx]);
  const sanitized = threads.map(sanitizeUploadThreadForPersist);
  next[idx] = {
    ...entry,
    data: {
      ...entry.data,
      itemCount: sanitized.length,
      threads: sanitized,
    },
  };
  await idbSetUploadHistoryList(next);
}

export async function clearUploadHistory(): Promise<void> {
  await idbClearUploadHistory();
}

export function formatUploadHistoryOption(item: UploadHistoryItem): string {
  const count = item.data?.itemCount ?? item.data?.threads?.length ?? 0;
  return `${item.label} (${count} video)`;
}
