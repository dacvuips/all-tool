import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  DEFAULT_GENERATE_VIDEO_CONFIG,
  DEFAULT_SETTINGS,
  GENERATE_VIDEO_CONFIG_KEY,
  GenerateVideoConfig,
  LOGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEY,
  USERS_STORAGE_KEY,
  createEmptyItem,
  migrateToCharacterProfile,
} from "./types";
import { idbGetConfig, idbSetConfig } from "./idb";

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
    productName: String(raw.productName || ""),
    productLink: String(raw.productLink || ""),
    commission: String(raw.commission || ""),
    imageUrl: String(raw.imageUrl || ""),
    prompt: String(raw.prompt || ""),
    videoUrls,
    mergedVideoUrl: String(raw.mergedVideoUrl || ""),
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
  // Không persist blob: URL (chết sau reload) — blob nằm trong IndexedDB theo itemId
  writeJSON(
    STORAGE_KEY,
    items.map((i) => ({
      ...i,
      mergedVideoUrl: i.mergedVideoUrl?.startsWith("blob:") ? "" : i.mergedVideoUrl || "",
    }))
  );
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

function clampThreadCount(value: unknown, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.round(n)));
}

function mergeGenerateVideoConfig(raw?: Partial<GenerateVideoConfig> | null): GenerateVideoConfig {
  const data = raw || {};
  const characters = data.characters?.length
    ? data.characters.map((c) => migrateToCharacterProfile(c as any))
    : DEFAULT_GENERATE_VIDEO_CONFIG.characters;
  const legacyLoop = (data as { loopVideo?: number }).loopVideo;
  const threadCount = clampThreadCount(
    data.threadCount ?? legacyLoop,
    DEFAULT_GENERATE_VIDEO_CONFIG.threadCount
  );
  return {
    ...DEFAULT_GENERATE_VIDEO_CONFIG,
    ...data,
    threadCount,
    prompts: { ...DEFAULT_GENERATE_VIDEO_CONFIG.prompts, ...data.prompts },
    watermark: { ...DEFAULT_GENERATE_VIDEO_CONFIG.watermark, ...data.watermark },
    techniques: data.techniques?.length ? data.techniques : DEFAULT_GENERATE_VIDEO_CONFIG.techniques,
    characters,
    actionsV1: data.actionsV1?.length ? data.actionsV1 : DEFAULT_GENERATE_VIDEO_CONFIG.actionsV1,
    actionsV2: data.actionsV2?.length ? data.actionsV2 : DEFAULT_GENERATE_VIDEO_CONFIG.actionsV2,
  };
}

/** Load generate-video config từ IndexedDB `video-affiliate-manager`. */
export async function loadGenerateVideoConfig(): Promise<GenerateVideoConfig> {
  const fromIdb = await idbGetConfig<Partial<GenerateVideoConfig>>();
  if (fromIdb) return mergeGenerateVideoConfig(fromIdb);

  // Migrate 1 lần từ localStorage cũ (nếu còn)
  const legacy = readJSON<Partial<GenerateVideoConfig> | null>(GENERATE_VIDEO_CONFIG_KEY, null);
  if (legacy && Object.keys(legacy).length > 0) {
    const merged = mergeGenerateVideoConfig(legacy);
    try {
      await idbSetConfig(merged);
      if (typeof window !== "undefined") {
        localStorage.removeItem(GENERATE_VIDEO_CONFIG_KEY);
      }
    } catch (err) {
      console.warn("[video-affiliate-manager] migrate failed", err);
    }
    return merged;
  }

  return mergeGenerateVideoConfig();
}

/** Lưu generate-video config vào IndexedDB `video-affiliate-manager`. */
export async function saveGenerateVideoConfig(
  config: GenerateVideoConfig
): Promise<GenerateVideoConfig> {
  const next = mergeGenerateVideoConfig(config);
  await idbSetConfig(next);
  return next;
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
