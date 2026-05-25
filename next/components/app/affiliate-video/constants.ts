/**
 * affiliate-video/constants.ts
 * Shared design tokens, types, and constants for the AI Video Generator (Veo 3).
 */

import { ServiceImageEnum } from "./elements/constants";

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
export type TrendingModeType = "single_variant" | "story_script";

/** Affiliate sidebar form configuration */
export interface VideoFormBase {
  category?: string;
  mood: string;
  language: string;
  artStyle: string;
  artStyleId?: string;
  aspectRatio: AspectRatio;
}
export interface AffiliateVideoFormConfig extends VideoFormBase {
  objectToPersonify: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImage?: ElementFormImage;
  tipContent: string;
  storyModeType: StoryModeTypeEnum;
  batchSize: number;
  productImages?: string[];
}

export interface TrendingVideoFormConfig extends VideoFormBase {
  tipContent: string;
  batchSize: number;
  productImages?: string[];
  trendingModeType: TrendingModeTypeEnum;
  /** ID của trending item đang được sử dụng (nếu user chọn "Dùng ngay") */
  promptId?: string;
}

export interface CopyVideoFormConfig extends VideoFormBase {
  sourceVideo?: { base64: string; mimeType: string };
  productImages?: string[];
  objectToPersonify: string;
  objectToPersonifyCode?: string;
  objectToPersonifyImage?: ElementFormImage;
}

export interface ElementFormImage {
  fifeUrl: string;
  imageBytes: string;
  mimeType: string;
  name: string;
}

export interface ElementFormVideo {
  fifeUrl: string;
  videoBytes: string;
  mimeType: string;
  name: string;
}

export interface ElementFormConfig {
  prompt: string;
  /** Ảnh tham chiếu – có thể upload nhiều ảnh */
  artStyleImg?: ElementFormImage[];
  objectImg?: ElementFormImage;
  itemImg?: ElementFormImage;
  /** Video tham chiếu cho chế độ video-to-video (có thể upload nhiều video) */
  videoRef?: ElementFormVideo[];
  aspectRatio: AspectRatio;
  artStyle: string;
  artStyleId?: string;
  serviceImageType?: string;
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

/** Mood options aligned with AffiliateFormConfig.mood (same values as TONE_OPTIONS) */

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
  noText?: boolean;
  audio?: string;
  aspectRatio?: "16:9" | "9:16";
  selectedProductImages?: string[];
  product_image_prompt?: string;
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
  aspectRatio: "16:9" | "9:16";
  scenes: SceneScript[];
  productImages?: string[];
  objectToPersonifyImage?: ElementFormImage;
}

export interface TrendingScriptData {
  trendingModeType: TrendingModeTypeEnum;
  topicTitle: string;
  artStyle: string;
  environment: string;
  characterName: string;
  characterBaseDescription: string;
  voiceGender: string;
  voiceTone: string;
  voiceStyle: string;
  aspectRatio: "16:9" | "9:16";
  scenes: SceneScript[];
  productImages?: string[];
}

export const DB_NAME = {
  generateScene: "generate-scene",
  generateScript: "generate-script",
  generateVideo: "generate-video",
  generateVoice: "generate-voice",
  generateImage: "generate-image",
  copyVideo: "copy-video",
  generateElement: "generate-element",
};
export const STORE_NAME = {
  generateScene: "generate-scene",
  generateTrending: "generate-trending",
  copyVideo: "copy-video",
  generateElement: "generate-element",
};
export type DB_NAME_TYPE = keyof typeof DB_NAME | string;
export const DB_VERSION = 1;

export const CACHE_KEY = {
  lastScript: "lastScript",
  generateInput: "generateInput",
  sceneHistory: "sceneHistory",
  copyVideoHistory: "copyVideoHistory",
  lastCopyVideoScript: "lastCopyVideoScript",
  copyVideoInput: "copyVideoInput",
  lastTrendingScript: "lastTrendingScript",
  trendingInput: "trendingInput",
  trendingHistory: "trendingHistory",
  lastElementScript: "lastElementScript",
  elementInput: "elementInput",
  elementHistory: "elementHistory",
};

// ── Copy Video Analysis Types ──────────────────────────────────────────────

export interface CopyVideoCharacter {
  name: string;
  description: string;
}

export interface CopyVideoProp {
  name: string;
  description: string;
}

export interface CopyVideoScene {
  id: string;
  timestamp: string;
  scene_type: "CHARACTER" | "OBJECT";
  visual_prompt: string;
  motion_description: string;
  audio_description: string;
  original_content: string;
  translated_content?: string | null;
  disabled?: boolean;
  voiceDisable?: boolean;
  noText?: boolean;
  selectedProductImages?: string[];
  /** 3 ô ảnh tham chiếu (phong cách / đối tượng / SP) theo scene */
  elementImageSlots?: (ElementFormImage | undefined)[];
  /** 1 ô video tham chiếu theo scene – auto-match tên video trong prompt */
  elementVideoSlots?: (ElementFormVideo | undefined)[];
  product_image_prompt?: string;
  sceneNumber?: number;
}

export interface CopyVideoAnalysisData {
  characters: CopyVideoCharacter[];
  props: CopyVideoProp[];
  scenes: CopyVideoScene[];
  aspectRatio?: string;
  productImages?: string[];
  objectToPersonifyImage?: ElementFormImage;
}

/** Right panel tabs for element video workflow */
export enum ElementScriptTabEnum {
  batch = "batch",
  imagesToVideo = "images-to-video",
  videoToVideo = "video-to-video",
}

/** Query param key for element right-panel active tab (value = ElementScriptTabEnum) */
export const ELEMENT_SCRIPT_TAB_QUERY_KEY = "elementScriptTab";

export interface ElementAnalysisData {
  scenes: ElementScene[];
  aspectRatio?: string;
  artStyleId?: string;
  artStyle?: string;
  serviceImageType?: ServiceImageEnum;
}

export interface ElementHistoryItem {
  id: string;
  createdAt: number;
  label: string;
  data: ElementAnalysisData;
}
export interface CopyVideoHistoryItem {
  id: string;
  createdAt: number;
  label: string;
  data: CopyVideoAnalysisData;
}

export interface ElementScene {
  id: string;
  timestamp: string;
  scene_type: "CHARACTER" | "OBJECT";
  visual_prompt: string;
  motion_description: string;
  audio_description: string;
  original_content: string;
  translated_content?: string | null;
  disabled?: boolean;
  voiceDisable?: boolean;
  noText?: boolean;
  selectedProductImages?: string[];
  /** 3 ô ảnh tham chiếu (phong cách / đối tượng / SP) theo scene */
  elementImageSlots?: (ElementFormImage | undefined)[];
  /** 1 ô video tham chiếu theo scene – auto-match tên video trong prompt */
  elementVideoSlots?: (ElementFormVideo | undefined)[];
  product_image_prompt?: string;
  sceneNumber?: number;
}

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
export interface TrendingHistoryItem {
  /** Unique ID for this history entry */
  id: string;
  /** Timestamp when the scene was generated */
  createdAt: number;
  /** Human-readable label (e.g. "Kịch bản – 25/04 14:52") */
  label: string;
  /** The generated script data */
  data: TrendingScriptData;
}

export enum TAB_TYPE {
  single = "single",
  batch = "batch",
}

/**
 * Chế độ tạo nội dung:
 * - single_variant: Tab "Đơn Lẻ" – tạo nhiều phiên bản khác nhau từ 1 prompt gốc,
 *   không sáng tạo thêm, hình ảnh không lệch so với prompt gốc.
 * - story_script: Tab "Cốt truyện/kịch bản" – tạo nhiều phân cảnh liên quan
 *   tạo thành cốt truyện mạch lạc, có thể sáng tạo dựa trên chủ đề prompt.
 */
export enum StoryModeTypeEnum {
  prompt_to_video = "prompt_to_video",
  image_to_video = "image_to_video",
}
export enum TrendingModeTypeEnum {
  single_variant = "single_variant",
  story_script = "story_script",
}

/** Tiêu đề hiển thị trên BatchSizeSlider tuỳ theo mode */
export const BATCH_SIZE_LABELS: Record<TrendingModeTypeEnum, string> = {
  [TrendingModeTypeEnum.single_variant]: "Số phiên bản",
  [TrendingModeTypeEnum.story_script]: "Số phân cảnh",
};

/** Mô tả phụ hiển thị bên dưới slider tuỳ theo mode */
export const BATCH_SIZE_DESCRIPTIONS: Record<TrendingModeTypeEnum, string> = {
  [TrendingModeTypeEnum.single_variant]:
    "AI sẽ viết lại prompt gốc thành {count} phiên bản khác nhau, giữ nguyên ý nghĩa.",
  [TrendingModeTypeEnum.story_script]:
    "AI sẽ sáng tạo {count} phân cảnh liên kết thành cốt truyện mạch lạc.",
};

export enum ArtStyleMapEnum {
  PIXAR = "Pixar",
  PIXAR_REALISTIC = "Pixar_Realistic",
  REALISTIC = "Realistic",
  CROCHET = "Crochet",
  CLAY = "Clay",
  DIORAMA = "Diorama",
  LEGO = "Lego",
  MANNEQUIN = "Mannequin",
  ZACK_DOGE = "Zack_Doge",
  CHALKBOARD = "Chalkboard",
  MINIMALIST_2D = "2D_Minimalist",
  STICKMAN = "Stickman",
  SIMPSONS = "Simpsons",
  BUSINESS = "Business",
  CINEMATIC_DARK = "Cinematic_Dark",
  DARK_FANTASY = "Dark_Fantasy",
  ANIME = "Anime",
  GAME_2D = "Game_2D",
  DARK_GROTESQUE = "Dark_Grotesque",
  FLAT_SCIENCE = "Flat_Science",
  MINECRAFT = "Minecraft",
  PENCIL_SKETCH = "Pencil_Sketch",
  WATERCOLOR = "Watercolor",
  RENAISSANCE = "Renaissance",
  CRAYON = "Crayon",
}
