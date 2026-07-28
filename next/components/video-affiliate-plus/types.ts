import promptTemplatesJson from "./prompt-templates.json";

export type ThreadStatus = "waiting" | "uploading" | "success" | "error" | "stopped" | "running";

export type PromptTemplateField = keyof typeof promptTemplatesJson;

/** Prompt mẫu mặc định theo tên field (từ prompt-templates.json). */
export const PROMPT_TEMPLATES: Record<PromptTemplateField, string> = {
  directives: promptTemplatesJson.directives,
  rulesNegative: promptTemplatesJson.rulesNegative,
  dialogueSystem: promptTemplatesJson.dialogueSystem,
  dialogueSection1: promptTemplatesJson.dialogueSection1,
  dialogueSectionLast: promptTemplatesJson.dialogueSectionLast,
  image: promptTemplatesJson.image,
};

export function getDefaultPrompt(field: PromptTemplateField): string {
  return PROMPT_TEMPLATES[field] ?? "";
}

export interface AffiliatePlusItem {
  id: string;
  shopName: string;
  shopId: string;
  /** Mã sản phẩm Shopee (cột "Mã sản phẩm") — key IndexedDB video nối */
  productId: string;
  productName: string;
  productLink: string;
  commission: string;
  imageUrl: string;
  /** Prompt generate video áp dụng cho luồng này */
  prompt: string;
  /**
   * Các video variant theo slot (độ dài = videosPerJob lúc generate).
   * Slot rỗng = lỗi / thiếu kết quả.
   */
  videoUrls: string[];
  /** Slot bị tắt — bỏ qua khi nối video */
  videoDisabled: boolean[];
  /** Video đã nối — UI/thread chỉ lưu tên `merged.mp4`; binary ở IndexedDB (Blob). */
  mergedVideoUrl: string;
  hostPort: string;
  country: string;
  cookie: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  error: string;
  /** Số lần auto-retry generate đã dùng trong cycle hiện tại. */
  generateRetryCount?: number;
  /** Số lần auto-retry nối video đã dùng trong cycle hiện tại. */
  mergeRetryCount?: number;
  status: ThreadStatus;
  selected: boolean;
  countdown: number;
}

export interface ManagedOption {
  id: string;
  name: string;
  content?: string;
}

export type CharacterPose = "standing" | "sitting" | "fashion";

export interface CharacterScene {
  id: string;
  name: string;
  content: string;
}

/** Profile nhân vật đầy đủ (Quản lý Nhân Vật). */
export interface CharacterProfile {
  id: string;
  /** Tên Profile (folder & file) */
  name: string;
  /** Tab Nhân Vật */
  characterName: string;
  characterSummary: string;
  appearanceDetails: string;
  audioVoice: string;
  backgroundSound: string;
  /** @deprecated dùng characterSummary — giữ để migrate */
  characterPrompt?: string;
  scenes: CharacterScene[];
  images: {
    standing: string;
    sitting: string;
    fashion: string;
  };
  previewPose: CharacterPose;
  /** Bật = gửi toàn bộ ảnh model vào generate thay vì chỉ 1 ảnh preview. */
  randomImagesEnabled?: boolean;
  /** Prompt cộng thêm vào Check Prompt Tổng khi bật random ảnh. */
  randomImagesPrompt?: string;
}

export interface GenerateVideoPromptConfig {
  /** Directives — nên làm (mỗi dòng 1 chỉ thị) */
  directives: string;
  /** Negative Prompt — không nên làm (mỗi dòng 1 chỉ thị) */
  rulesNegative: string;
  /** Prompt Tạo Thoại — System Instruction */
  dialogueSystem: string;
  /** Prompt Tạo Thoại — Thoại 1 */
  dialogueSection1: string;
  /** Prompt Tạo Thoại — Thoại Cuối */
  dialogueSectionLast: string;
  /** Prompt Tạo Thoại — bản gộp (system + các section) */
  dialogue: string;
  checkTotal: string;
  image: string;
}

export interface GenerateVideoWatermarkConfig {
  mode: "signature" | "logo";
  text: string;
  logoUrl: string;
  size: number;
  position: string;
  effect: string;
  opacity: number;
  customX: number;
  customY: number;
  stickerCount: number;
  ffmpegThreads: number;
}

export interface GenerateVideoConfig {
  prompts: GenerateVideoPromptConfig;
  /** Prompt chính gửi đi khi generate — áp dụng cho tất cả luồng khi Lưu Setting */
  activePrompt: string;
  workflow: string;
  voice: string;
  techniqueId: string;
  characterId: string;
  actionV1Id: string;
  actionV2Id: string;
  techniques: ManagedOption[];
  characters: CharacterProfile[];
  actionsV1: ManagedOption[];
  actionsV2: ManagedOption[];
  watermark: GenerateVideoWatermarkConfig;
  dialogueMode: string;
  musicName: string;
  musicUrl: string;
  imageModel: string;
  videoModel: string;
  videosPerJob: number;
  /** @deprecated Không còn dùng khi Bắt Đầu — concurrency lấy từ customer.videoStreamCount */
  threadCount: number;
  quality: string;
}

export interface AffiliatePlusUserGenerateLink {
  /** Id phiên Generate Video (import history) */
  sessionId: string;
  /** Id item trong phiên */
  itemId: string;
  productId: string;
  productName: string;
  productLink: string;
  caption: string;
  /** Tên/key video đã nối — chỉ `merged.mp4`; binary ở IndexedDB. */
  mergedVideoUrl: string;
  assignedAt: number;
}

export interface AffiliatePlusUser {
  id: string;
  username: string;
  /** Email đăng nhập / email khôi phục */
  email: string;
  /** Alias mới rõ nghĩa hơn cho email */
  mail?: string;
  role: string;
  /** Mail khôi phục (mailkp) — chỉ email, không kèm password sau | */
  mailKp?: string;
  /** Cookie import / cookie gốc từ file Excel-TXT (không ghi đè khi lấy từ extension) */
  cookie?: string;
  /**
   * Cookie lấy từ extension (Lấy cookie / Chạy tất cả).
   * Đây là cookie dùng để gắn Chrome / upload.
   */
  cookieApp?: string;
  /** Mật khẩu mail / account */
  password?: string;
  /** Cookie field riêng nếu chưa có full cookie */
  spcF?: string;
  /**
   * Domain Shopee của tài khoản: vn | ph | sg | th | my | id
   * Dùng để mở đúng link login khi lấy cookie.
   */
  domain?: string;
  /**
   * Thời điểm cookie được cập nhật gần nhất (ISO).
   * Hiệu lực đếm ngược 6 ngày kể từ mốc này.
   */
  cookieFetchedAt?: string;
  /** Id profile GPM Login đã tạo từ tài khoản này */
  gpmProfileId?: string;
  /**
   * Port CDP lần tạo/mở profile gần nhất.
   * Có giá trị (>0) = đã tạo profile GPM; chưa có = chưa tạo.
   * Dùng để batch «Tạo Profile tự động» bỏ qua tài khoản đã xử lý.
   */
  cdpPort?: number;
  proxy?: string;
  error?: string;
  active: boolean;
  createdAt: string;
  /**
   * Nhiều video + thông tin SP đã gắn từ Generate Video.
   * Persist IndexedDB (mỗi account tối đa theo cấu hình Tạo Luồng, hard-cap 90).
   */
  generateItems?: AffiliatePlusUserGenerateLink[];
  /** @deprecated migrate → generateItems */
  generateItem?: AffiliatePlusUserGenerateLink | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/;

/** TTL cookie sau khi lấy / cập nhật (6 ngày). */
export const COOKIE_TTL_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Chuẩn hoá mailkp: nếu có dấu `|` thì chỉ lấy phần trước (email), rồi trim.
 * Ví dụ: `georgezade155@hotmail.com|k0U3yg4pIeP` → `georgezade155@hotmail.com`
 */
export function normalizeMailKp(raw?: string | null): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  const idx = v.indexOf("|");
  if (idx < 0) return v;
  return v.slice(0, idx).trim();
}

/** Lấy giá trị SPC_F / spc_f từ chuỗi cookie `name=value; ...`. */
export function extractSpcFFromCookie(cookie?: string | null): string {
  const raw = String(cookie || "");
  const m = raw.match(/(?:^|;\s*)SPC_F=([^;]*)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].trim()).trim();
  } catch {
    return m[1].trim();
  }
}

/**
 * Field cookie session Shopee — đúng thứ tự mẫu.
 * Marker `_ga_*` = chèn mọi cookie bắt đầu `_ga_` tại vị trí này.
 */
export const SHOPEE_COOKIE_APP_FIELDS = [
  "_sapid",
  "_gcl_au",
  "csrftoken",
  "ssr-tz",
  "_QPWSDCXHZQA",
  "REC7iLP4Q",
  "_ga",
  "SPC_CDS_CHAT",
  "SPC_CLIENTID",
  "SPC_F",
  "REC_T_ID",
  "SPC_SI",
  "SPC_SEC_SI",
  "SPC_ST",
  "SPC_U",
  "SPC_R_T_IV",
  "SPC_T_ID",
  "SPC_T_IV",
  "SPC_R_T_ID",
  "AC_CERT_D",
  "sense_sa_r",
  "_ga_*",
  "shopee_webUnique_ccd",
  "ds",
] as const;

const SHOPEE_COOKIE_APP_FIELD_SET = new Set<string>(
  SHOPEE_COOKIE_APP_FIELDS.filter((n) => n !== "_ga_*")
);

export function isAllowedShopeeCookieAppField(name: string): boolean {
  const n = String(name || "").trim();
  if (!n) return false;
  if (SHOPEE_COOKIE_APP_FIELD_SET.has(n)) return true;
  if (n.startsWith("_ga_")) return true;
  return false;
}

/** Lọc + sắp xếp cookie đúng thứ tự mẫu (+ `_ga_*` sau sense_sa_r). */
export function filterShopeeCookieAppString(cookie?: string | null): string {
  const raw = String(cookie || "").trim();
  if (!raw) return "";
  const map = new Map<string, string>();
  for (const part of raw.split(/[;\n]+/)) {
    const p = part.trim();
    if (!p.includes("=")) continue;
    const eq = p.indexOf("=");
    const name = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (!isAllowedShopeeCookieAppField(name)) continue;
    map.set(name, value);
  }
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const name of SHOPEE_COOKIE_APP_FIELDS) {
    if (name === "_ga_*") {
      const gaDyn = Array.from(map.keys())
        .filter((n) => n.startsWith("_ga_") && !used.has(n))
        .sort();
      for (const n of gaDyn) {
        ordered.push(`${n}=${map.get(n)}`);
        used.add(n);
      }
      continue;
    }
    if (!map.has(name)) continue;
    ordered.push(`${name}=${map.get(name)}`);
    used.add(name);
  }
  for (const [name, value] of Array.from(map.entries())) {
    if (used.has(name)) continue;
    ordered.push(`${name}=${value}`);
  }
  return ordered.join("; ");
}

/** Thời gian còn lại (ms) trước khi cookie hết hạn 6 ngày. */
export function getCookieRemainingMs(
  user: Partial<AffiliatePlusUser> | null | undefined,
  nowMs = Date.now()
): number {
  const fetched = String(user?.cookieFetchedAt || "").trim();
  if (!fetched) return 0;
  const start = new Date(fetched).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, start + COOKIE_TTL_MS - nowMs);
}

/** Format còn lại: `5n 12g` / `3g 20p` / `Hết hạn`. */
export function formatCookieRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Hết hạn";
  const totalMin = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}n ${hours}g`;
  if (hours > 0) return `${hours}g ${mins}p`;
  return `${Math.max(1, mins)}p`;
}

/**
 * Màu chữ đếm ngược: xanh (mới) → đỏ (gần hết / hết hạn).
 * ratio 1 = xanh, 0 = đỏ
 */
export function getCookieLifeColor(remainingMs: number): string {
  const ratio = Math.min(1, Math.max(0, remainingMs / COOKIE_TTL_MS));
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * (1 - ratio));
  // green(21,128,61) → red(185,28,28)
  const r = lerp(21, 185);
  const g = lerp(128, 28);
  const b = lerp(61, 28);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Tách chuỗi ghép kiểu email|mailKpPass|cookie|uuid (import cũ / export lỗi nhãn). */
export function parseCompoundMailKpCookie(
  value: string
): { mailKp: string; cookie: string } | null {
  const parts = String(value || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  // mailkp chỉ lấy email (phần đầu), không ghép password
  const mailKp = normalizeMailKp(parts[0]);
  const cookie = parts.length >= 4 ? parts.slice(2).join("|") : parts[2] || "";
  if (!cookie) return null;
  return { mailKp, cookie };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Excel serial (số ngày từ 1899-12-30) → `YYYY-MM-DD HH:mm:ss`. */
export function formatExcelSerialDate(serial: number): string {
  if (!Number.isFinite(serial)) return "";
  const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
  const d = new Date(utc);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
    d.getUTCHours()
  )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function formatMaybeExcelDate(raw: unknown): string {
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())} ${pad2(
      raw.getHours()
    )}:${pad2(raw.getMinutes())}:${pad2(raw.getSeconds())}`;
  }
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const num = Number(s);
  if (Number.isFinite(num) && num > 20000 && num < 100000) {
    return formatExcelSerialDate(num);
  }
  return s;
}

function looksLikeDateCell(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  const num = Number(s);
  return Number.isFinite(num) && num > 20000 && num < 100000;
}

/**
 * Parse 1 dòng Excel kiểu "100 ac bác việt theo":
 * A Username | B mail | C mailkp|pass|cookie|uuid | D (trống) | E ngày tạo | F Mật khẩu | G Cookie spc_f | H domain (.vn/.ph/...)
 * Không có header.
 */
export function parseBacVietTheoExcelColumns(
  cols: unknown[]
): ParsedUserImportFields | null {
  const c = cols.map((x) => {
    if (x instanceof Date) return formatMaybeExcelDate(x);
    return String(x ?? "").trim();
  });
  // Giữ tối thiểu 8 cột nếu có domain ở H (không pop mất domain rỗng ở giữa)
  while (c.length > 8 && !c[c.length - 1]) c.pop();
  if (c.length < 3) return null;

  const username = c[0];
  if (!username) return null;
  if (/^(username|user|tai khoan|ten account)$/i.test(username)) return null;

  const mail = c[1] || "";
  const compound = c[2] || "";
  const parsed = compound.includes("|") ? parseCompoundMailKpCookie(compound) : null;

  let createdAt = "";
  let password = "";
  let spcF = "";
  let domain = "";

  if (c.length >= 7) {
    // Mẫu chuẩn: [3] trống, [4] ngày, [5] mk, [6] spc_f, [7] domain (cột H)
    createdAt = formatMaybeExcelDate(c[4] || "");
    password = c[5] || "";
    spcF = c[6] || "";
    domain = c[7] || "";
    if (!createdAt && looksLikeDateCell(c[3])) {
      createdAt = formatMaybeExcelDate(c[3]);
      password = c[4] || "";
      spcF = c[5] || "";
      domain = c[6] || "";
    }
  } else {
    const rest = c.slice(3).filter(Boolean);
    if (rest.length >= 4) {
      createdAt = formatMaybeExcelDate(rest[0]);
      password = rest[1] || "";
      spcF = rest[2] || "";
      domain = rest[3] || "";
    } else if (rest.length >= 3) {
      createdAt = formatMaybeExcelDate(rest[0]);
      password = rest[1] || "";
      spcF = rest[2] || "";
    } else if (rest.length === 2) {
      if (looksLikeDateCell(rest[0])) {
        createdAt = formatMaybeExcelDate(rest[0]);
        password = rest[1] || "";
      } else {
        password = rest[0] || "";
        spcF = rest[1] || "";
      }
    } else if (rest.length === 1) {
      if (looksLikeDateCell(rest[0])) createdAt = formatMaybeExcelDate(rest[0]);
      else password = rest[0] || "";
    }
  }

  return {
    username,
    mail,
    mailKp: parsed?.mailKp || normalizeMailKp(compound),
    cookie: parsed?.cookie || (!compound.includes("|") ? compound : ""),
    ...(createdAt ? { createdAt } : {}),
    ...(password ? { password } : {}),
    ...(spcF ? { spcF } : {}),
    ...(domain ? { domain } : {}),
  };
}

/**
 * Phần đuôi sau UUID cookie: `uuid . 2026-06-22 23:37:52 Minh123@ spc_f [proxy]`
 * Trả về cookieUuid + metadata.
 */
export function parseCookieTailMeta(tail: string): {
  cookieUuid: string;
  createdAt?: string;
  password?: string;
  spcF?: string;
  proxy?: string;
} | null {
  const text = String(tail || "").trim();
  if (!text) return null;

  const uuidMatch = text.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (!uuidMatch) return null;

  const cookieUuid = uuidMatch[1];
  let rest = text.slice(cookieUuid.length).trim().replace(/^\.\s*/, "").trim();
  if (!rest) return { cookieUuid };

  const dateMatch = rest.match(DATE_RE);
  let createdAt = "";
  if (dateMatch) {
    createdAt = dateMatch[0];
    rest = rest.replace(dateMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  const password = tokens[0] || "";
  const spcF = tokens[1] || "";
  const proxy = tokens.slice(2).join(" ") || "";

  return {
    cookieUuid,
    ...(createdAt ? { createdAt } : {}),
    ...(password ? { password } : {}),
    ...(spcF ? { spcF } : {}),
    ...(proxy ? { proxy } : {}),
  };
}

export type ParsedUserImportFields = {
  username: string;
  mail?: string;
  mailKp?: string;
  cookie?: string;
  createdAt?: string;
  password?: string;
  spcF?: string;
  proxy?: string;
  domain?: string;
};

/**
 * Parse 1 dòng account theo thứ tự:
 * Username | mail | mailkp | cookie | ngày tạo | Mật khẩu | Cookie spc_f | domain
 *
 * mailkp / cookie thường chứa `|` nên không được split mù.
 * mailkp: nếu là `email|pass` thì chỉ lấy email (normalizeMailKp).
 * domain: .vn / .ph / ... (cột H tương đương Excel)
 */
export function parseUserImportLine(line: string): ParsedUserImportFields | null {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  // Format chuẩn đã tách sẵn (không nhồi cookie bằng |)
  // Username|mail|mail kp|cookie|ngay tao|mat khau|spc_f|proxy — chỉ khi cookie không chứa |
  const cleanPipeParts = trimmed.includes("|")
    ? trimmed.split("|").map((p) => p.trim())
    : [];

  const looksLikeSplitMailKp =
    cleanPipeParts.length >= 5 &&
    EMAIL_RE.test(cleanPipeParts[1] || "") &&
    EMAIL_RE.test(cleanPipeParts[2] || "") &&
    !EMAIL_RE.test(cleanPipeParts[3] || "") &&
    String(cleanPipeParts[3] || "").length > 0 &&
    String(cleanPipeParts[3] || "").length < 80 &&
    (String(cleanPipeParts[4] || "").startsWith("M.") ||
      String(cleanPipeParts[4] || "").length > 40);

  if (looksLikeSplitMailKp) {
    const username = cleanPipeParts[0];
    const mail = cleanPipeParts[1];
    // mailkp = chỉ email (parts[2]), không ghép password parts[3]
    const mailKp = normalizeMailKp(cleanPipeParts[2]);
    const cookieChunks = cleanPipeParts.slice(4);
    const last = cookieChunks[cookieChunks.length - 1] || "";
    const meta = parseCookieTailMeta(last);

    let cookie = "";
    let createdAt = "";
    let password = "";
    let spcF = "";
    let proxy = "";

    if (meta) {
      cookie = [...cookieChunks.slice(0, -1), meta.cookieUuid].join("|");
      createdAt = meta.createdAt || "";
      password = meta.password || "";
      spcF = meta.spcF || "";
      proxy = meta.proxy || "";
    } else {
      cookie = cookieChunks.join("|");
    }

    return {
      username,
      mail,
      mailKp,
      cookie,
      ...(createdAt ? { createdAt } : {}),
      ...(password ? { password } : {}),
      ...(spcF ? { spcF } : {}),
      ...(proxy ? { proxy } : {}),
    };
  }

  // Username|mail|email|pass|cookie|uuid|date|password|spc_f|domain|proxy (đã tách sạch)
  if (
    cleanPipeParts.length >= 8 &&
    EMAIL_RE.test(cleanPipeParts[1] || "") &&
    EMAIL_RE.test(cleanPipeParts[2] || "") &&
    UUID_RE.test(cleanPipeParts[5] || "")
  ) {
    return {
      username: cleanPipeParts[0],
      mail: cleanPipeParts[1],
      mailKp: normalizeMailKp(cleanPipeParts[2]),
      cookie: `${cleanPipeParts[4]}|${cleanPipeParts[5]}`,
      createdAt: cleanPipeParts[6] || "",
      password: cleanPipeParts[7] || "",
      spcF: cleanPipeParts[8] || "",
      domain: cleanPipeParts[9] || "",
      proxy: cleanPipeParts[10] || "",
    };
  }

  // Username|mail|mailkp|cookie|date|password|spc_f|domain [|proxy] — cột sạch, không compound |
  if (
    cleanPipeParts.length >= 8 &&
    EMAIL_RE.test(cleanPipeParts[1] || "") &&
    !String(cleanPipeParts[3] || "").includes("@") &&
    (String(cleanPipeParts[7] || "").startsWith(".") ||
      /^(vn|ph|sg|th|my|id)$/i.test(String(cleanPipeParts[7] || "").replace(/^\./, "")))
  ) {
    return {
      username: cleanPipeParts[0],
      mail: cleanPipeParts[1],
      mailKp: normalizeMailKp(cleanPipeParts[2]),
      cookie: cleanPipeParts[3] || "",
      createdAt: cleanPipeParts[4] || "",
      password: cleanPipeParts[5] || "",
      spcF: cleanPipeParts[6] || "",
      domain: cleanPipeParts[7] || "",
      proxy: cleanPipeParts[8] || "",
    };
  }

  // Username|mail|mailKp(compound có |)|cookie|... — rare, skip

  // Format gốc space: username mail compound [.] date password spc_f
  // compound = email|pass|cookie|uuid
  const spaceParts = trimmed.split(/\s+/).filter(Boolean);
  if (spaceParts.length >= 2 && !trimmed.includes("|")) {
    return {
      username: spaceParts[0],
      cookie: spaceParts[1] || "",
      proxy: spaceParts[2] || "",
    };
  }

  if (spaceParts.length >= 4 && trimmed.includes("|")) {
    const username = spaceParts[0];
    const maybeMail = spaceParts[1];
    // Tìm đoạn compound chứa nhiều |
    const compoundIdx = spaceParts.findIndex((p, i) => i >= 1 && p.includes("|"));
    if (compoundIdx > 0) {
      const compound = spaceParts[compoundIdx];
      const parsed = parseCompoundMailKpCookie(compound);
      const after = spaceParts.slice(compoundIdx + 1);
      // after có thể: ".", "2026-06-22", "23:37:52", "Minh123@", "spc_f"
      let createdAt = "";
      let password = "";
      let spcF = "";
      let proxy = "";
      const joinedAfter = after.join(" ").replace(/^\.\s*/, "").trim();
      const dateMatch = joinedAfter.match(DATE_RE);
      let rest = joinedAfter;
      if (dateMatch) {
        createdAt = dateMatch[0];
        rest = joinedAfter.replace(dateMatch[0], " ").replace(/\s+/g, " ").trim();
      }
      const toks = rest.split(/\s+/).filter(Boolean);
      password = toks[0] || "";
      spcF = toks[1] || "";
      proxy = toks.slice(2).join(" ") || "";

      return {
        username,
        mail: EMAIL_RE.test(maybeMail) && compoundIdx > 1 ? maybeMail : "",
        mailKp: normalizeMailKp(parsed?.mailKp || ""),
        cookie: parsed?.cookie || compound,
        ...(createdAt ? { createdAt } : {}),
        ...(password ? { password } : {}),
        ...(spcF ? { spcF } : {}),
        ...(proxy ? { proxy } : {}),
      };
    }
  }

  return null;
}

export function resolveUserCookie(user: Partial<AffiliatePlusUser> | null | undefined): string {
  // Ưu tiên cookie từ extension (Cookies App)
  const cookieApp = String(user?.cookieApp || "").trim();
  if (cookieApp) return cookieApp;
  const cookie = String(user?.cookie || "").trim();
  if (cookie) return cookie;
  const spcF = String(user?.spcF || "").trim();
  if (spcF) return `spc_f=${spcF}`;
  return "";
}

/** Cookie gốc tài khoản (import Excel/TXT) — dùng khi tạo GPM profile từ tab Quản lý tài khoản. */
export function resolveAccountOriginCookie(
  user: Partial<AffiliatePlusUser> | null | undefined
): string {
  const cookie = String(user?.cookie || "").trim();
  if (cookie) return cookie;
  const cookieApp = String(user?.cookieApp || "").trim();
  if (cookieApp) return cookieApp;
  const spcF = resolveAccountSpcF(user);
  if (spcF) return `spc_f=${spcF}`;
  return "";
}

/**
 * SPC_F lưu tại tài khoản gốc (cột spcF).
 * Chỉ fallback sang cookie gốc — không lấy từ cookieApp để tránh lệch giá trị.
 */
export function resolveAccountSpcF(user: Partial<AffiliatePlusUser> | null | undefined): string {
  const direct = String(user?.spcF || "").trim();
  if (direct) {
    const eq = direct.indexOf("=");
    if (eq > 0 && /^SPC_F$/i.test(direct.slice(0, eq).trim())) {
      return direct.slice(eq + 1).trim();
    }
    return direct;
  }
  return extractSpcFFromCookie(user?.cookie);
}

export function resolveUserProxy(user: Partial<AffiliatePlusUser> | null | undefined): string {
  return String(user?.proxy || "").trim();
}

/** Các domain Shopee hỗ trợ cho tài khoản / lấy cookie */
export const SHOPEE_ACCOUNT_DOMAINS = [
  { code: "vn", host: "shopee.vn", label: ".vn — Việt Nam" },
  { code: "ph", host: "shopee.ph", label: ".ph — Philippines" },
  { code: "sg", host: "shopee.sg", label: ".sg — Singapore" },
  { code: "th", host: "shopee.co.th", label: ".th — Thái Lan" },
  { code: "my", host: "shopee.com.my", label: ".my — Malaysia" },
  { code: "id", host: "shopee.co.id", label: ".id — Indonesia" },
] as const;

export type ShopeeAccountDomainCode = (typeof SHOPEE_ACCOUNT_DOMAINS)[number]["code"];

/** Chuẩn hoá domain tài khoản → vn|ph|sg|th|my|id */
export function normalizeShopeeAccountDomain(raw?: string | null): ShopeeAccountDomainCode {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!v || v === "vn" || v === "shopee.vn" || v.includes(".vn")) return "vn";
  if (v === "ph" || v === "shopee.ph" || v.includes(".ph")) return "ph";
  if (v === "sg" || v === "shopee.sg" || v.includes(".sg")) return "sg";
  if (v === "th" || v === "shopee.co.th" || v.includes(".th") || v.includes("co.th")) return "th";
  if (v === "my" || v === "shopee.com.my" || v.includes(".my") || v.includes("com.my")) return "my";
  if (v === "id" || v === "shopee.co.id" || v.includes(".id") || v.includes("co.id")) return "id";
  return "vn";
}

export function getShopeeHostByDomain(raw?: string | null): string {
  const code = normalizeShopeeAccountDomain(raw);
  return SHOPEE_ACCOUNT_DOMAINS.find((d) => d.code === code)?.host || "shopee.vn";
}

/** Link login Shopee theo domain tài khoản */
export function getShopeeLoginUrlByDomain(raw?: string | null): string {
  return `https://${getShopeeHostByDomain(raw)}/buyer/login`;
}

/** Proxy lưu dạng host:port:user:pass */
export interface AffiliatePlusProxy {
  id: string;
  host: string;
  port: string;
  username: string;
  password: string;
  /** Chuỗi gốc để gán nhanh: host:port:user:pass */
  raw: string;
  note?: string;
  error?: string;
  active: boolean;
  createdAt: string;
}

export interface AffiliatePlusLog {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  threadId?: string;
}

export interface AffiliatePlusSettings {
  scheduleTime: string;
  defaultDelayMin: number;
  defaultDelayMax: number;
  defaultCountry: string;
  autoRetry: boolean;
}

export const STORAGE_KEY = "video-affiliate-plus-items";
export const USERS_STORAGE_KEY = "video-affiliate-plus-users";
export const PROXIES_STORAGE_KEY = "video-affiliate-plus-proxies";
export const LOGS_STORAGE_KEY = "video-affiliate-plus-logs";
export const SETTINGS_STORAGE_KEY = "video-affiliate-plus-settings";

/** Chuẩn hoá raw → host:port[:user:pass] */
export function buildProxyRaw(parts: {
  host: string;
  port: string;
  username?: string;
  password?: string;
}): string {
  const host = String(parts.host || "").trim();
  const port = String(parts.port || "").trim();
  const username = String(parts.username || "").trim();
  const password = String(parts.password || "").trim();
  if (!host || !port) return "";
  if (username || password) return `${host}:${port}:${username}:${password}`;
  return `${host}:${port}`;
}

/** Parse 1 dòng proxy: host:port:user:pass | host:port | CSV host,port,user,pass */
export function parseProxyLine(line: string): Omit<AffiliatePlusProxy, "id" | "createdAt"> | null {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  const lower = trimmed.toLowerCase().replace(/\s+/g, "");
  if (
    lower === "host:port:user:pass" ||
    lower === "host,port,user,pass" ||
    lower === "host\tport\tuser\tpass" ||
    lower === "proxy" ||
    lower === "host,port" ||
    lower.startsWith("host,port,")
  ) {
    return null;
  }

  let host = "";
  let port = "";
  let username = "";
  let password = "";

  if (trimmed.includes(",") || trimmed.includes("\t")) {
    const parts = trimmed.split(/[\t,]/).map((p) => p.trim());
    host = parts[0] || "";
    port = parts[1] || "";
    username = parts[2] || "";
    password = parts.slice(3).join(",") || "";
  } else {
    const parts = trimmed.split(":");
    if (parts.length >= 4) {
      host = parts[0] || "";
      port = parts[1] || "";
      username = parts[2] || "";
      password = parts.slice(3).join(":");
    } else if (parts.length === 2) {
      host = parts[0] || "";
      port = parts[1] || "";
    } else if (parts.length === 3) {
      host = parts[0] || "";
      port = parts[1] || "";
      username = parts[2] || "";
    } else {
      return null;
    }
  }

  host = host.trim();
  port = port.trim();
  if (!host || !port) return null;
  if (!/^\d+$/.test(port)) return null;

  const raw = buildProxyRaw({ host, port, username, password });
  return {
    host,
    port,
    username,
    password,
    raw,
    note: "",
    error: "",
    active: true,
  };
}
export const GENERATE_VIDEO_CONFIG_KEY = "video-affiliate-plus-generate-video-config"; // legacy localStorage (migrate → IndexedDB)
export const VIDEO_AFFILIATE_MANAGER_DB = "video-affiliate-manager";

export const DEFAULT_SETTINGS: AffiliatePlusSettings = {
  scheduleTime: "07:00",
  defaultDelayMin: 180,
  defaultDelayMax: 245,
  defaultCountry: "VN",
  autoRetry: true,
};

function opt(id: string, name: string, content = ""): ManagedOption {
  return { id, name, content };
}

export function createEmptyCharacterScene(index = 1): CharacterScene {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `scene-${index}`,
    name: `Bối Cảnh ${index}`,
    content: "",
  };
}

export function createEmptyCharacterProfile(
  partial?: Partial<CharacterProfile>
): CharacterProfile {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `char-${Date.now()}`,
    name: "Profile mới",
    characterName: "",
    characterSummary: "",
    appearanceDetails: "",
    audioVoice: "",
    backgroundSound: "Natural ambient sound appropriate for the scene.",
    scenes: [createEmptyCharacterScene(1)],
    images: { standing: "", sitting: "", fashion: "" },
    previewPose: "fashion",
    randomImagesEnabled: false,
    randomImagesPrompt: "",
    ...partial,
  };
}

/** Migrate ManagedOption / profile cũ → CharacterProfile. */
export function migrateToCharacterProfile(
  raw: Partial<CharacterProfile> & Partial<ManagedOption>
): CharacterProfile {
  const legacyPrompt = raw.characterPrompt || raw.content || "";
  return createEmptyCharacterProfile({
    id: raw.id,
    name: raw.name || "Profile",
    characterName: raw.characterName || "",
    characterSummary: raw.characterSummary || legacyPrompt,
    appearanceDetails: raw.appearanceDetails || "",
    audioVoice: raw.audioVoice || "",
    backgroundSound:
      raw.backgroundSound || "Natural ambient sound appropriate for the scene.",
    scenes: raw.scenes?.length > 0 ? raw.scenes : [createEmptyCharacterScene(1)],
    images: {
      standing: raw.images?.standing || "",
      sitting: raw.images?.sitting || "",
      fashion: raw.images?.fashion || "",
    },
    previewPose: raw.previewPose || "fashion",
    randomImagesEnabled: Boolean(raw.randomImagesEnabled),
    randomImagesPrompt: raw.randomImagesPrompt || "",
  });
}

const CHARACTER_POSES: CharacterPose[] = ["standing", "sitting", "fashion"];

/** Danh sách ảnh model đã có URL. */
export function listCharacterImages(
  profile: CharacterProfile
): Array<{ pose: CharacterPose; url: string }> {
  return CHARACTER_POSES.map((pose) => ({
    pose,
    url: String(profile.images?.[pose] || "").trim(),
  })).filter((x) => Boolean(x.url));
}

/** Chọn ảnh nhân vật để generate — ưu tiên previewPose, rồi ảnh còn lại. */
export function pickCharacterImage(
  profile: CharacterProfile
): { pose: CharacterPose | ""; url: string } {
  const available = listCharacterImages(profile);
  if (!available.length) return { pose: "", url: "" };

  const preferred = available.find((a) => a.pose === profile.previewPose);
  if (preferred) return preferred;
  return available[0];
}

/** Danh sách ảnh generate cho character theo mode hiện tại. */
export function getCharacterImagesForGeneration(profile: CharacterProfile): string[] {
  if (profile.randomImagesEnabled) {
    return listCharacterImages(profile).map((img) => img.url);
  }
  const picked = pickCharacterImage(profile);
  return picked.url ? [picked.url] : [];
}

/** Tạo prompt tự động từ profile (ghép mô tả + bối cảnh). */
export function buildCharacterAutoPrompt(profile: CharacterProfile): string {
  const parts: string[] = [];
  const charName = profile.characterName.trim() || profile.name.trim();
  if (charName) parts.push(`Character Name: ${charName}`);
  if (profile.characterSummary.trim()) {
    parts.push(`Character Summary:\n${profile.characterSummary.trim()}`);
  }
  if (profile.appearanceDetails.trim()) {
    parts.push(`Appearance Details:\n${profile.appearanceDetails.trim()}`);
  }
  if (profile.audioVoice.trim()) {
    parts.push(`Audio & Voice:\n${profile.audioVoice.trim()}`);
  }
  if (profile.backgroundSound.trim()) {
    parts.push(`Background Sound:\n${profile.backgroundSound.trim()}`);
  }
  profile.scenes.forEach((scene, i) => {
    if (!scene.content.trim()) return;
    parts.push(`${scene.name || `Environment ${i + 1}`}:\n${scene.content.trim()}`);
  });
  const hasImage = Object.values(profile.images).some(Boolean);
  if (hasImage) {
    parts.push(
      "Reference images available: " +
        (["standing", "sitting", "fashion"] as CharacterPose[])
          .filter((p) => profile.images[p])
          .join(", ")
    );
  }
  return parts.join("\n\n");
}

export const DEFAULT_GENERATE_VIDEO_CONFIG: GenerateVideoConfig = {
  prompts: {
    directives: getDefaultPrompt("directives"),
    rulesNegative: getDefaultPrompt("rulesNegative"),
    dialogueSystem: getDefaultPrompt("dialogueSystem"),
    dialogueSection1: getDefaultPrompt("dialogueSection1"),
    dialogueSectionLast: getDefaultPrompt("dialogueSectionLast"),
    dialogue: "",
    checkTotal: "",
    image: getDefaultPrompt("image"),
  },
  activePrompt: "",
  workflow: "start-end",
  voice: "Achernar",
  techniqueId: "tech-professional",
  characterId: "char-ao-dai",
  actionV1Id: "act1-review",
  actionV2Id: "act2-review",
  techniques: [
    opt("tech-professional", "Professional"),
    opt("tech-cinematic", "Cinematic"),
    opt("tech-minimal", "Minimal"),
  ],
  characters: [
    createEmptyCharacterProfile({
      id: "char-ao-dai",
      name: "Ao Dai",
      characterName: "Ao Dai",
      characterSummary:
        "A Vietnamese woman wearing traditional white Ao Dai, elegant and natural.",
    }),
    createEmptyCharacterProfile({ id: "char-casual", name: "Casual" }),
    createEmptyCharacterProfile({ id: "char-business", name: "Business" }),
  ],
  actionsV1: [opt("act1-review", "Review"), opt("act1-unbox", "Unbox"), opt("act1-demo", "Demo")],
  actionsV2: [
    opt("act2-review", "Review"),
    opt("act2-closeup", "Close-up"),
    opt("act2-lifestyle", "Lifestyle"),
  ],
  watermark: {
    mode: "signature",
    text: "AutoPee Review",
    logoUrl: "",
    size: 50,
    position: "custom",
    effect: "move",
    opacity: 100,
    customX: 50,
    customY: 50,
    stickerCount: 1,
    ffmpegThreads: 1,
  },
  dialogueMode: "keep",
  musicName: "",
  musicUrl: "",
  imageModel: "nano-banana-pro",
  videoModel: "0-credit",
  videosPerJob: 2,
  threadCount: 5,
  quality: "720p",
};

export function createEmptyItem(partial?: Partial<AffiliatePlusItem>): AffiliatePlusItem {
  return {
    id: crypto.randomUUID(),
    shopName: "",
    shopId: "",
    productId: "",
    productName: "",
    productLink: "",
    commission: "",
    imageUrl: "",
    prompt: "",
    videoUrls: [],
    videoDisabled: [],
    mergedVideoUrl: "",
    hostPort: "",
    country: "VN",
    cookie: "",
    uploaded: 0,
    pending: 0,
    delayMin: 180,
    delayMax: 245,
    error: "",
    status: "waiting",
    selected: false,
    countdown: 0,
    ...partial,
  };
}

/** Gộp Directives + Negative (chỉ phần có giá trị). */
export function syncCheckTotalFromRules(directives: string, rulesNegative: string): string {
  const parts: string[] = [];
  const dir = directives.trim();
  const neg = rulesNegative.trim();
  if (dir) {
    parts.push(`**Directives:**\n${dir}`);
  }
  if (neg) {
    parts.push(`**Negative Prompt:**\n${neg}`);
  }
  return parts.join("\n\n");
}

/** Gộp System Instruction + các section thoại thành Prompt Tạo Thoại. */
export function buildDialoguePrompt(
  system: string,
  section1: string,
  sectionLast: string
): string {
  const parts: string[] = [];
  if (system.trim()) {
    parts.push(`System Instruction:\n${system.trim()}`);
  }
  if (section1.trim()) {
    parts.push(`Thoại 1:\n${section1.trim()}`);
  }
  if (sectionLast.trim()) {
    parts.push(`Thoại Cuối:\n${sectionLast.trim()}`);
  }
  return parts.join("\n\n");
}

/** Check Prompt Tổng = tổng hợp các prompt (chỉ xem, không sửa). */
export function buildCheckTotalPrompt(
  prompts: GenerateVideoPromptConfig,
  character?: CharacterProfile | null
): string {
  const rules = syncCheckTotalFromRules(prompts.directives, prompts.rulesNegative);
  const dialogue =
    prompts.dialogue.trim() ||
    buildDialoguePrompt(prompts.dialogueSystem, prompts.dialogueSection1, prompts.dialogueSectionLast);
  const image = prompts.image.trim();
  const randomImagePrompt =
    character?.randomImagesEnabled ? String(character.randomImagesPrompt || "").trim() : "";

  const parts: string[] = [];
  if (rules) parts.push(`=== Rules Negative Prompt ===\n${rules}`);
  if (dialogue) parts.push(`=== Prompt Tạo Thoại ===\n${dialogue}`);
  if (image) parts.push(`=== Prompt Tạo Ảnh ===\n${image}`);
  if (randomImagePrompt) parts.push(`=== Prompt Ảnh Ngẫu Nhiên ===\n${randomImagePrompt}`);
  return parts.join("\n\n");
}

/** Prompt config mặc định từ prompt-templates.json. */
export function getDefaultPromptConfig(): GenerateVideoPromptConfig {
  const prompts: GenerateVideoPromptConfig = {
    directives: getDefaultPrompt("directives"),
    rulesNegative: getDefaultPrompt("rulesNegative"),
    dialogueSystem: getDefaultPrompt("dialogueSystem"),
    dialogueSection1: getDefaultPrompt("dialogueSection1"),
    dialogueSectionLast: getDefaultPrompt("dialogueSectionLast"),
    dialogue: "",
    checkTotal: "",
    image: getDefaultPrompt("image"),
  };
  prompts.dialogue = buildDialoguePrompt(
    prompts.dialogueSystem,
    prompts.dialogueSection1,
    prompts.dialogueSectionLast
  );
  prompts.checkTotal = buildCheckTotalPrompt(prompts);
  return prompts;
}

// Gán dialogue / checkTotal mặc định sau khi helper sẵn sàng
DEFAULT_GENERATE_VIDEO_CONFIG.prompts = getDefaultPromptConfig();

/** Build prompt gửi đi từ config (áp dụng chung cho mọi luồng). */
export function buildActivePromptFromConfig(config: GenerateVideoConfig): string {
  const character =
    config.characters.find((item) => item.id === config.characterId) || config.characters[0] || null;
  const checkTotal = buildCheckTotalPrompt(config.prompts, character);
  return checkTotal.trim() || config.activePrompt;
}

export function getTotalVideos(item: AffiliatePlusItem): number {
  const filled = (item.videoUrls || []).filter((u) => String(u || "").trim()).length;
  return Math.max(filled, item.uploaded + item.pending, 1);
}

/** Pad/cắt videoUrls về đúng số slot config; giữ index (slot trống = lỗi). */
export function padVideoSlots(
  urls: string[],
  slotCount: number
): { videoUrls: string[]; videoDisabled: boolean[] } {
  const n = Math.max(1, Math.round(slotCount) || 1);
  const videoUrls = Array.from({ length: n }, (_, i) => String(urls[i] || "").trim());
  return {
    videoUrls,
    videoDisabled: Array.from({ length: n }, () => false),
  };
}

/** URL dùng để nối — bỏ slot trống và slot bị disable. */
export function getMergeableVideoUrls(item: AffiliatePlusItem): string[] {
  return (item.videoUrls || [])
    .map((u, idx) => ({
      url: String(u || "").trim(),
      disabled: Boolean(item.videoDisabled?.[idx]),
    }))
    .filter((x) => x.url && !x.disabled)
    .map((x) => x.url);
}

export const STATUS_LABELS: Record<ThreadStatus, string> = {
  waiting: "Chờ",
  uploading: "Đang upload",
  success: "Thành công",
  error: "Lỗi",
  stopped: "Dừng",
  running: "Đang chạy",
};

export const STATUS_COLORS: Record<ThreadStatus, string> = {
  waiting: "bg-amber-50 text-amber-700 border-amber-200",
  uploading: "bg-sky-50 text-sky-700 border-sky-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  stopped: "bg-gray-100 text-gray-600 border-gray-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
};
