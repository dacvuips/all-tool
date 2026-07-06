import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  DEFAULT_SETTINGS,
  LOGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEY,
  USERS_STORAGE_KEY,
  createEmptyItem,
} from "./types";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function migrateItem(raw: Record<string, unknown>): AffiliatePlusItem {
  const videoUrls = Array.isArray(raw.videoUrls)
    ? (raw.videoUrls as string[])
    : raw.videoUrl
    ? String(raw.videoUrl).split("|").filter(Boolean)
    : [];

  const total = videoUrls.length || 1;

  return createEmptyItem({
    id: String(raw.id || crypto.randomUUID()),
    shopName: String(raw.shopName || ""),
    shopId: String(raw.shopId || ""),
    commission: String(raw.commission || ""),
    imageUrl: String(raw.imageUrl || ""),
    videoUrls,
    hostPort: String(raw.hostPort || ""),
    country: String(raw.country || "VN"),
    cookie: String(raw.cookie || ""),
    uploaded: Number(raw.uploaded) || 0,
    pending: Number(raw.pending) || Math.max(total - (Number(raw.uploaded) || 0), 0),
    delayMin: Number(raw.delayMin) || 180,
    delayMax: Number(raw.delayMax) || 245,
    error: String(raw.error || ""),
    status: (raw.status as AffiliatePlusItem["status"]) || "waiting",
    selected: Boolean(raw.selected),
    countdown: Number(raw.countdown) || 0,
  });
}

export function loadItems(): AffiliatePlusItem[] {
  const raw = readJSON<Record<string, unknown>[]>(STORAGE_KEY, []);
  return raw.map(migrateItem);
}

export function saveItems(items: AffiliatePlusItem[]) {
  writeJSON(STORAGE_KEY, items);
}

export function loadUsers(): AffiliatePlusUser[] {
  return readJSON<AffiliatePlusUser[]>(USERS_STORAGE_KEY, []);
}

export function saveUsers(users: AffiliatePlusUser[]) {
  writeJSON(USERS_STORAGE_KEY, users);
}

export function loadLogs(): AffiliatePlusLog[] {
  return readJSON<AffiliatePlusLog[]>(LOGS_STORAGE_KEY, []);
}

export function saveLogs(logs: AffiliatePlusLog[]) {
  writeJSON(LOGS_STORAGE_KEY, logs.slice(0, 500));
}

export function loadSettings(): AffiliatePlusSettings {
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<AffiliatePlusSettings>>(SETTINGS_STORAGE_KEY, {}) };
}

export function saveSettings(settings: AffiliatePlusSettings) {
  writeJSON(SETTINGS_STORAGE_KEY, settings);
}

export function appendLog(
  logs: AffiliatePlusLog[],
  message: string,
  level: AffiliatePlusLog["level"] = "info",
  threadId?: string
): AffiliatePlusLog[] {
  const entry: AffiliatePlusLog = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    level,
    message,
    threadId,
  };
  return [entry, ...logs].slice(0, 500);
}
