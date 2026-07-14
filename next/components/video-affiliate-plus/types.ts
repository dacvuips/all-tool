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
  /** Video đã nối (ffmpeg) — runtime có thể là blob URL; persist dùng marker "indexeddb". */
  mergedVideoUrl: string;
  hostPort: string;
  country: string;
  cookie: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  error: string;
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
  /** Link/key video đã nối — blob/data không persist; dùng marker "indexeddb". */
  mergedVideoUrl: string;
  assignedAt: number;
}

export interface AffiliatePlusUser {
  id: string;
  username: string;
  email: string;
  role: string;
  cookie?: string;
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
  });
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
export function buildCheckTotalPrompt(prompts: GenerateVideoPromptConfig): string {
  const rules = syncCheckTotalFromRules(prompts.directives, prompts.rulesNegative);
  const dialogue =
    prompts.dialogue.trim() ||
    buildDialoguePrompt(prompts.dialogueSystem, prompts.dialogueSection1, prompts.dialogueSectionLast);
  const image = prompts.image.trim();

  const parts: string[] = [];
  if (rules) parts.push(`=== Rules Negative Prompt ===\n${rules}`);
  if (dialogue) parts.push(`=== Prompt Tạo Thoại ===\n${dialogue}`);
  if (image) parts.push(`=== Prompt Tạo Ảnh ===\n${image}`);
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
  const checkTotal = buildCheckTotalPrompt(config.prompts);
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
