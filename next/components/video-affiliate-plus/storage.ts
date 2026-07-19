import { extractShopeeProductId } from "./csv-parser";
import {
  idbGetConfig,
  idbGetProxiesList,
  idbGetUsersList,
  idbSetConfig,
  idbSetProxiesList,
  idbSetUsersList,
} from "./idb";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusProxy,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  AffiliatePlusUserGenerateLink,
  DEFAULT_GENERATE_VIDEO_CONFIG,
  DEFAULT_SETTINGS,
  GENERATE_VIDEO_CONFIG_KEY,
  GenerateVideoConfig,
  LOGS_STORAGE_KEY,
  PROXIES_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEY,
  USERS_STORAGE_KEY,
  buildProxyRaw,
  createEmptyItem,
  migrateToCharacterProfile,
  parseProxyLine,
  parseCompoundMailKpCookie,
  resolveUserCookie,
  normalizeShopeeAccountDomain,
  normalizeMailKp,
  extractSpcFFromCookie,
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
  // Giữ index slot (kể cả chuỗi rỗng) — không collapse bằng filter
  const rawUrls = Array.isArray(raw.videoUrls)
    ? (raw.videoUrls as string[])
    : raw.videoUrl
    ? String(raw.videoUrl).split("|")
    : [];
  const videoUrls = rawUrls.map((u) => {
    const s = String(u || "").trim();
    if (!s || s.startsWith("blob:") || s.startsWith("data:")) return "";
    return s;
  });

  const filled = videoUrls.filter(Boolean).length;
  const total = filled || 1;

  const rawDisabled = Array.isArray(raw.videoDisabled) ? (raw.videoDisabled as boolean[]) : [];
  const videoDisabled = videoUrls.map((_, idx) => Boolean(rawDisabled[idx]));

  const productLink = String(raw.productLink || "");
  const productId =
    String(raw.productId || "").trim() || extractShopeeProductId(productLink) || "";

  const rawMerged = String(raw.mergedVideoUrl || "");
  const mergedVideoUrl =
    rawMerged.startsWith("blob:") || rawMerged.startsWith("data:") ? "" : rawMerged;

  return createEmptyItem({
    id: String(raw.id || crypto.randomUUID()),
    shopName: String(raw.shopName || ""),
    shopId: String(raw.shopId || ""),
    productId,
    productName: String(raw.productName || ""),
    productLink,
    commission: String(raw.commission || ""),
    imageUrl: String(raw.imageUrl || ""),
    prompt: String(raw.prompt || ""),
    videoUrls,
    videoDisabled,
    mergedVideoUrl,
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

function isEphemeralMediaUrl(url: string): boolean {
  const u = String(url || "").trim();
  return u.startsWith("blob:") || u.startsWith("data:");
}

export function saveItems(items: AffiliatePlusItem[]) {
  // Không persist blob:/data: — media nằm IndexedDB (link → enrich base64)
  // Giữ index slot (chuỗi rỗng = slot lỗi), không filter collapse
  writeJSON(
    STORAGE_KEY,
    items.map((i) => {
      const videoUrls = (i.videoUrls || []).map((u) =>
        isEphemeralMediaUrl(u) ? "" : String(u || "").trim()
      );
      return {
        ...i,
        videoUrls,
        videoDisabled: videoUrls.map((_, idx) => Boolean(i.videoDisabled?.[idx])),
        mergedVideoUrl: isEphemeralMediaUrl(i.mergedVideoUrl || "") ? "" : i.mergedVideoUrl || "",
      };
    })
  );
}

function normalizeGenerateLink(
  raw: AffiliatePlusUserGenerateLink | null | undefined
): AffiliatePlusUserGenerateLink | null {
  if (!raw || typeof raw !== "object") return null;
  const mergedVideoUrl = String(raw.mergedVideoUrl || "").trim();
  const cleaned =
    mergedVideoUrl.startsWith("blob:") || mergedVideoUrl.startsWith("data:") ? "" : mergedVideoUrl;
  return {
    sessionId: String(raw.sessionId || ""),
    itemId: String(raw.itemId || ""),
    productId: String(raw.productId || ""),
    productName: String(raw.productName || ""),
    productLink: String(raw.productLink || ""),
    caption: String(raw.caption || ""),
    mergedVideoUrl: cleaned,
    assignedAt: Number(raw.assignedAt) || Date.now(),
  };
}

function normalizeGenerateItems(raw: Partial<AffiliatePlusUser>): AffiliatePlusUserGenerateLink[] {
  const fromList = Array.isArray(raw.generateItems) ? raw.generateItems : [];
  const migrated = normalizeGenerateLink(raw.generateItem);
  const merged = [...fromList, ...(migrated ? [migrated] : [])]
    .map((item) => normalizeGenerateLink(item))
    .filter((item): item is AffiliatePlusUserGenerateLink => Boolean(item));

  // Dedupe theo itemId / productId+mergedVideoUrl
  const seen = new Set<string>();
  const unique: AffiliatePlusUserGenerateLink[] = [];
  for (const item of merged) {
    const key =
      item.itemId ||
      `${item.productId}|${item.mergedVideoUrl}|${item.productLink}|${item.caption}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, 90);
}

function normalizeUser(raw: Partial<AffiliatePlusUser>): AffiliatePlusUser {
  const email = String(raw.mail || raw.email || "").trim();
  let mailKp = normalizeMailKp(
    raw.mailKp || (raw as { mail_kp?: string }).mail_kp || ""
  );
  let cookie = String(raw.cookie || "").trim();
  const legacyCompound = String((raw as { mailCookie?: string }).mailCookie || "").trim();
  if (legacyCompound) {
    const parsed = parseCompoundMailKpCookie(legacyCompound);
    if (parsed) {
      mailKp = mailKp || parsed.mailKp;
      cookie = cookie || parsed.cookie;
    } else if (!cookie) {
      cookie = legacyCompound;
    }
  }
  mailKp = normalizeMailKp(mailKp);
  const password = String((raw as AffiliatePlusUser).password || "").trim();
  const cookieApp = String(
    (raw as AffiliatePlusUser).cookieApp || (raw as any).cookie_app || ""
  ).trim();
  let spcF = String((raw as AffiliatePlusUser).spcF || (raw as any).spc_f || "").trim();
  if (!spcF && cookieApp) {
    spcF = extractSpcFFromCookie(cookieApp);
  }
  if (!spcF && cookie) {
    spcF = extractSpcFFromCookie(cookie);
  }
  const cookieFetchedAt = String(
    (raw as AffiliatePlusUser).cookieFetchedAt || (raw as any).cookie_fetched_at || ""
  ).trim();
  return {
    id: String(raw.id || crypto.randomUUID()),
    username: String(raw.username || "").trim(),
    email,
    mail: email,
    role: String(raw.role || "user"),
    mailKp,
    cookie,
    cookieApp,
    password,
    spcF,
    domain: normalizeShopeeAccountDomain((raw as AffiliatePlusUser).domain || (raw as any).country),
    cookieFetchedAt: cookieFetchedAt || undefined,
    proxy: String(raw.proxy || ""),
    error: String(raw.error || ""),
    active: raw.active !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
    generateItems: normalizeGenerateItems(raw),
    generateItem: null,
  };
}

export async function loadUsers(): Promise<AffiliatePlusUser[]> {
  const legacy = readJSON<AffiliatePlusUser[]>(USERS_STORAGE_KEY, []).map(normalizeUser);
  let fromIdb: AffiliatePlusUser[] = [];
  try {
    fromIdb = (await idbGetUsersList<AffiliatePlusUser>()).map(normalizeUser);
  } catch (err) {
    console.warn("[loadUsers] IndexedDB read failed", err);
  }

  const score = (list: AffiliatePlusUser[]) =>
    list.length * 1000 +
    list.reduce((sum, u) => sum + (u.generateItems?.length || 0), 0);

  // Ưu tiên nguồn có nhiều data hơn (tránh IDB rỗng ghi đè localStorage)
  const best = score(fromIdb) >= score(legacy) ? fromIdb : legacy;

  if (best.length) {
    try {
      await idbSetUsersList(best);
    } catch (err) {
      console.warn("[loadUsers] sync IndexedDB failed", err);
    }
    writeJSON(USERS_STORAGE_KEY, best);
  }

  return best;
}

export async function saveUsers(users: AffiliatePlusUser[]): Promise<void> {
  const normalized = users.map(normalizeUser);
  // localStorage trước (đồng bộ, không mất khi F5 nếu IDB chậm/fail)
  writeJSON(USERS_STORAGE_KEY, normalized);
  try {
    await idbSetUsersList(normalized);
  } catch (err) {
    console.warn("[saveUsers] IndexedDB failed, đã lưu localStorage", err);
  }
}

function normalizeProxy(raw: Partial<AffiliatePlusProxy> | Record<string, unknown>): AffiliatePlusProxy {
  const host = String(raw.host || "").trim();
  const port = String(raw.port || "").trim();
  const username = String(raw.username || "").trim();
  const password = String(raw.password || "").trim();
  const fromRaw = String(raw.raw || "").trim();
  const parsed = fromRaw && (!host || !port) ? parseProxyLine(fromRaw) : null;
  const nextHost = host || parsed?.host || "";
  const nextPort = port || parsed?.port || "";
  const nextUser = username || parsed?.username || "";
  const nextPass = password || parsed?.password || "";
  const built = buildProxyRaw({
    host: nextHost,
    port: nextPort,
    username: nextUser,
    password: nextPass,
  });

  return {
    id: String(raw.id || crypto.randomUUID()),
    host: nextHost,
    port: nextPort,
    username: nextUser,
    password: nextPass,
    raw: built || fromRaw,
    note: String(raw.note || ""),
    error: String(raw.error || ""),
    active: (raw as AffiliatePlusProxy).active !== false,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export async function loadProxies(): Promise<AffiliatePlusProxy[]> {
  const legacy = readJSON<AffiliatePlusProxy[]>(PROXIES_STORAGE_KEY, []).map(normalizeProxy);
  let fromIdb: AffiliatePlusProxy[] = [];
  try {
    fromIdb = (await idbGetProxiesList<AffiliatePlusProxy>()).map(normalizeProxy);
  } catch (err) {
    console.warn("[loadProxies] IndexedDB read failed", err);
  }

  const best = fromIdb.length >= legacy.length ? fromIdb : legacy;
  if (best.length) {
    try {
      await idbSetProxiesList(best);
    } catch (err) {
      console.warn("[loadProxies] sync IndexedDB failed", err);
    }
    writeJSON(PROXIES_STORAGE_KEY, best);
  }

  return best.filter((p) => p.host && p.port);
}

export async function saveProxies(proxies: AffiliatePlusProxy[]): Promise<void> {
  const normalized = proxies.map(normalizeProxy).filter((p) => p.host && p.port);
  writeJSON(PROXIES_STORAGE_KEY, normalized);
  try {
    await idbSetProxiesList(normalized);
  } catch (err) {
    console.warn("[saveProxies] IndexedDB failed, đã lưu localStorage", err);
  }
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

function clampVideosPerJob(value: unknown, fallback = 2): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(1, Math.round(n)));
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
  const videosPerJob = clampVideosPerJob(
    data.videosPerJob,
    DEFAULT_GENERATE_VIDEO_CONFIG.videosPerJob
  );
  return {
    ...DEFAULT_GENERATE_VIDEO_CONFIG,
    ...data,
    threadCount,
    videosPerJob,
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
