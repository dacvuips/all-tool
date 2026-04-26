/**
 * affiliate-video/constants.ts
 * Shared design tokens, types, and constants for the AI Video Generator (Veo 3).
 */

// ── CSS Design Tokens ──────────────────────────────────────────────────────
export const CSS = {
  bg: "#080815",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardHover: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderAccent: "1px solid rgba(99,102,241,0.5)",
  accent: "#6366f1",
  accentTeal: "#06b6d4",
  accentAmber: "#f59e0b",
  gradAccent: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
  gradBg: "linear-gradient(135deg, #080815 0%, #0e0a20 40%, #080e1e 100%)",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#475569",
  radius: "12px",
  radiusSm: "8px",
  radiusLg: "18px",
  shadow: "0 4px 24px rgba(0,0,0,0.4)",
  shadowAccent: "0 4px 24px rgba(99,102,241,0.3)",
} as const;

// ── Unique ID helper ───────────────────────────────────────────────────────
let _uid = 0;
export const uid = () => `${Date.now()}-${++_uid}`;

// ── Core Types ─────────────────────────────────────────────────────────────
export type MediaType = "image" | "video";
export type ItemRole = "input" | "keyframe" | "output";
export type AspectRatio = "9:16" | "16:9";
export type Quality = "standard" | "high";
export type OutputFormat = "mp4" | "webm";
export type SpeedMode = "fast" | "relaxed" | "quality";

/** Full video generation configuration */

export type StoryModeType = "prompt_to_video" | "image_to_video";

/** Affiliate sidebar form configuration */
export interface AffiliateVideoFormConfig {
  category: string;
  objectToPersonify: string;
  tipContent: string;
  mood: string;
  language: string;
  artStyle: string;
  storyModeType: StoryModeTypeEnum;
  aspectRatio: AspectRatio;
  batchSize: number;
}

export type OpStatus = "idle" | "loading" | "done" | "error";

/** A single prompt item in the Step 2 result list */

/** A prompt template option */

// ── Model Options ──────────────────────────────────────────────────────────

export const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "9:16", label: "9:16 Portrait", icon: "📱" },
  { value: "16:9", label: "16:9 Landscape", icon: "🖥" },
];

// ── Duration Options (seconds) ─────────────────────────────────────────────
export const DURATION_OPTIONS = [5, 6, 7, 8];

// ── Built-in TTS Voice Options ─────────────────────────────────────────────
export const BUILTIN_VOICES = [
  { value: "Aoede", label: "Aoede – Nữ, tươi vui" },
  { value: "Charon", label: "Charon – Nam, trầm ấm" },
  { value: "Fenrir", label: "Fenrir – Nam, mạnh mẽ" },
  { value: "Kore", label: "Kore – Nữ, chuyên nghiệp" },
  { value: "Leda", label: "Leda – Nữ, nhẹ nhàng" },
  { value: "Orus", label: "Orus – Nam, điềm tĩnh" },
  { value: "Puck", label: "Puck – Nam, thú vị" },
  { value: "Zephyr", label: "Zephyr – Nam, sáng sủa" },
];
export const CAMERA_ANGLES = [
  "Cận cảnh",
  "Trung cận",
  "Trung cảnh",
  "Toàn cảnh",
  "Viền cảnh",
  "Góc thấp",
  "Góc cao",
  "Qua vai",
  "Góc nghiêng",
  "Theo dõi",
  "POV",
];

export const IMAGE_STYLES = [
  { value: "realistic", label: "Chân thực (Realistic)" },
  { value: "3d_pixar", label: "3D Pixar Cute" },
  { value: "pixar_realism", label: "Pixar Realism (Nhân hoá)" },
  { value: "crochet", label: "Len Móc (Crochet/Amigurumi)" },
  { value: "clay", label: "Đất Sét (Claymation)" },
  { value: "diorama", label: "Mô hình Tí hon (Diorama)" },
  { value: "lego", label: "Đồ chơi Gạch (LEGO)" },
  { value: "mannequin", label: "Mannequin 3D (Siêu thực)" },
  { value: "zack_doge", label: "3D Educational Simulation (Zack D.Style)" },
  { value: "chalkboard", label: "Bảng Phấn (Chalkboard)" },
  { value: "2d_minimalist", label: "2D Tối Giản (Minimalist Animation)" },
  { value: "stickman", label: "Người Que (Stickman)" },
  { value: "simpsons", label: "Hoạt hình Simpsons" },
  { value: "business", label: "Giải thích Doanh nghiệp (Business Explainer)" },
  { value: "cinematic_dark", label: "Cinematic Dark Surrealism (Siêu thực Đen tối)" },
];

/** Art style options aligned with AffiliateFormConfig.artStyle */
export const ART_STYLE_OPTIONS = [
  { value: "none", label: "Tự do (Không dán đè Style)" },
  { value: "pixar", label: "3D Pixar Cute" },
  { value: "pixar_realism", label: "Pixar Realism (Nhân hoá)" },
  { value: "realistic", label: "Chân thực (Realistic)" },
  { value: "crochet", label: "Len Móc (Crochet/Amigurumi)" },
  { value: "clay", label: "Đất Sét (Claymation)" },
  { value: "diorama", label: "Mô hình Tí hon (Diorama)" },
  { value: "lego", label: "Đồ chơi Gạch (LEGO)" },
  { value: "mannequin", label: "Mannequin 3D (Siêu thực)" },
  { value: "zack_doge", label: "3D Educational Simulation (Zack D. Style)" },
  { value: "chalkboard", label: "Bảng Phấn (Chalkboard)" },
  { value: "2d_minimalist", label: "2D Tối Giản (Minimalist Animation)" },
  { value: "stickman", label: "Người Que (Stickman)" },
  { value: "simpsons", label: "Hoạt hình Simpsons" },
  { value: "business", label: "Giải thích Doanh nghiệp (Business Explainer)" },
  { value: "cinematic_dark", label: "Cinematic Dark Surrealism (Siêu thực Đen tối)" },
  { value: "dark_fantasy", label: "Dark Fantasy Folk Storytelling Digital Painting" },
  { value: "anime", label: "Hoạt hình Anime (Japanese Anime)" },
  { value: "game_2d", label: "Game 2D / Casual Mobile Game" },
  { value: "dark_grotesque", label: "Dark Grotesque Realism (Hài Đen Gây Sốc)" },
];

export const LANGUAGE_OPTIONS = [
  { value: "vn", label: "🇻🇳 Tiếng Việt", flag: "vn" },
  { value: "en", label: "🇺🇸 English", flag: "us" },
  { value: "zh", label: "🇨🇳 中文", flag: "cn" },
  { value: "ja", label: "🇯🇵 日本語", flag: "jp" },
  { value: "ko", label: "🇰🇷 한국어", flag: "kr" },
  { value: "hi", label: "🇮🇳 हिन्दी", flag: "hi" },
  { value: "fr", label: "🇫🇷 Français", flag: "fr" },
  { value: "de", label: "🇩🇪 Deutsch", flag: "de" },
  { value: "es", label: "🇪🇸 Español", flag: "es" },
  { value: "it", label: "🇮🇹 Italiano", flag: "it" },
  { value: "pt", label: "🇵🇹 Português", flag: "pt" },
  { value: "ru", label: "🇷🇺 Русский", flag: "ru" },
  { value: "ar", label: "🇸🇦 العربية", flag: "sa" },
  { value: "tr", label: "🇹🇷 Türkçe", flag: "tr" },
];

export const CATEGORY_OPTIONS = [
  { value: "meo_nau_an", label: "Mẹo Nấu Ăn" },
  { value: "meo_cuoc_song", label: "Mẹo Vật Cuộc Sống" },
  { value: "meo_don_dep", label: "Mẹo Don Dẹp" },
  { value: "thu_cong_diy", label: "Thủ Công & DIY" },
  { value: "meo_hoc_tap", label: "Mẹo Học Tập" },
  { value: "suc_khoe", label: "Mẹo Sức Khoẻ" },
  { value: "lam_dep", label: "Mẹo Làm Đẹp" },
  { value: "tai_chinh", label: "Mẹo Tài Chính" },
  { value: "cong_nghe", label: "Mẹo Công Nghệ" },
  { value: "cham_thu_cung", label: "Mẹo Chăm Thú Cưng" },
];

export const TONE_OPTIONS = [
  { value: "dynamic", label: "Năng động & Nhiệt tình" },
  { value: "drama", label: "Drama & Kịch tính" },
  { value: "expert", label: "Chuyên gia khó tính" },
  { value: "hau_dau", label: "Hậu đậu & Hài hước" },
  { value: "zen", label: "Điềm tính (Zen)" },
  { value: "thriller", label: "Kịch tính & Lố lăng" },
  { value: "creative", label: "Sáng tạo & Nghệ sĩ" },
];

/** Mood options aligned with AffiliateFormConfig.mood (same values as TONE_OPTIONS) */
export const MOOD_OPTIONS = TONE_OPTIONS;

// ── Camera Shot Types ──────────────────────────────────────────────────────
export type CameraShotType =
  | "LOW ANGLE SHOT"
  | "OVER-THE-SHOULDER TRACKING SHOT"
  | "MACRO EXTREME CLOSE-UP"
  | "POV SHOT"
  | "WIDE SHOT"
  | "CLOSE-UP"
  | "TWO-SHOT";

// ── Script / Cast Types ────────────────────────────────────────────────────

export interface CharacterItem {
  id: string;
  number: number;
  name: string;
  tag: string;
  description: string;
}

export interface EnvironmentConfig {
  environment: string;
  artStyle: string;
}

export interface AudioVoiceConfig {
  gender: string;
  mood: string;
  style: string;
  fullPrompt: string;
}

export interface SceneScript {
  id: string;
  sceneNumber: number;
  camera: string;
  visualPrompt: string;
  imageGenPrompt: string;
  motionPrompt: string;
  dialogue: string;
  disabled?: boolean;
  voiceDisable?: boolean;
  audio?: string;
}

export interface ScriptData {
  storyModeType: StoryModeTypeEnum;
  topicTitle: string;
  artStyle: string;
  environment: string;
  characterName: string;
  characterBaseDescription: string;
  voiceGender: string;
  voiceTone: string;
  voiceStyle: string;
  scenes: SceneScript[];
}

export const DB_NAME = {
  generateScene: "generate-scene",
  generateScript: "generate-script",
  generateVideo: "generate-video",
  generateVoice: "generate-voice",
  generateImage: "generate-image",
};
export const STORE_NAME = {
  generateScene: "generate-scene",
};
export type DB_NAME_TYPE = keyof typeof DB_NAME | string;
export const DB_VERSION = 1;

export const CACHE_KEY = {
  lastScript: "lastScript",
  generateInput: "generateInput",
  sceneHistory: "sceneHistory",
};

/** A single entry in the scene generation history */
export interface SceneHistoryItem {
  /** Unique ID for this history entry */
  id: string;
  /** Timestamp when the scene was generated */
  createdAt: number;
  /** Human-readable label (e.g. "Kịch bản – 25/04 14:52") */
  label: string;
  /** The generated script data */
  data: ScriptData;
}

export enum TAB_TYPE {
  single = "single",
  batch = "batch",
}

export enum StoryModeTypeEnum {
  prompt_to_video = "prompt_to_video",
  image_to_video = "image_to_video",
}
