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
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type Quality = "standard" | "high";
export type OutputFormat = "mp4" | "webm";
export type SpeedMode = "fast" | "relaxed" | "quality";

/** A single media item (image or video) in the generation pipeline */
export interface MediaItem {
  id: string;
  role: ItemRole;
  mediaType: MediaType;
  /** data URL (base64) or external http URL */
  src: string | null;
  name?: string;
  /** Per-item AI prompt override */
  prompt: string;
}

/** A subtitle / dialogue segment with start/end timing */
export interface DialogueLine {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  voice: string; // voice name
}

/** Voice settings for the generated video */
export interface VoiceConfig {
  type: "builtin" | "custom";
  voiceName: string;
  customAudioSrc?: string;
  customAudioName?: string;
}

/** Full video generation configuration */
export interface VideoConfig {
  duration: number; // seconds, default 8
  aspectRatio: AspectRatio;
  quality: Quality;
  outputFormat: OutputFormat;
  numberOfOutputs: number;
  generateSubtitles: boolean;
  personGeneration: "allow_adult" | "dont_allow";
  speed: SpeedMode | string;
}

// ── Mock Video Data (demo UI) ──────────────────────────────────────────────
export interface MockVideo {
  id: string;
  thumbnail: string;
  label: string;
  aspectRatio: string;
  styleTag: string;
  quality?: string;
  description: string;
  model: string;
  seed: string;
  timeInfo: string;
  status: "generating" | "done";
}

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "m1",
    thumbnail: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    quality: "1080p",
    description:
      "Phòng ngủ phong cách Scandinavian ấm cúng với tường kem, sàn gỗ sáng màu, giường bọc nệm vải be, cửa sổ kính lớn chiếm gần trọn bức tường...",
    model: "fast_ultra_relaxed",
    seed: "528414",
    timeInfo: "15:53",
    status: "generating",
  },
  {
    id: "m2",
    thumbnail: "https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ hiện đại sang trọng với nội thất gỗ óc chó, ga giường trắng ngà, thảm lông mềm, cửa sổ kính lớn nhìn ra thành phố về đêm đang...",
    model: "fast_ultra_relaxed",
    seed: "886026",
    timeInfo: "15:55",
    status: "generating",
  },
  {
    id: "m3",
    thumbnail: "https://images.unsplash.com/photo-1600210491892-03d54079f2b4?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ phong cách bãi biển nhiệt đới với nội thất mây tre, chăn ga màu cát, cửa sổ kính nhìn ra bãi biển vàng đang mưa, sóng biển nhẹ và...",
    model: "fast_ultra_relaxed",
    seed: "179785",
    timeInfo: "15:55",
    status: "generating",
  },
  {
    id: "m4",
    thumbnail: "https://images.unsplash.com/photo-1617098474202-0d0d7c5a4a8e?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ cổ điển châu Âu với tường màu xanh xám, giường đầu cao bọc nhung, bàn gỗ cổ, cửa sổ kính nhìn ra khu phố lát đá cổ kính...",
    model: "fast_ultra_relaxed",
    seed: "561736",
    timeInfo: "15:55",
    status: "generating",
  },
  {
    id: "m5",
    thumbnail: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ phong cách boho với ga giường họa tiết nhẹ, thảm dệt thủ công, cây xanh trong nhà, cửa sổ kính nhìn ra cánh đồng hoa oải hương...",
    model: "fast_ultra_relaxed",
    seed: "419841",
    timeInfo: "15:55",
    status: "generating",
  },
  {
    id: "m6",
    thumbnail: "https://images.unsplash.com/photo-1560448205-4d9b3e6bb6db?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ tối giản hiện đại với gam màu xám ấm, giường lớn gọn gàng, tường bê tông mịn, cửa sổ kính lớn nhìn ra cây cầu dát bạc qua đồng...",
    model: "fast_ultra_relaxed",
    seed: "399767",
    timeInfo: "15:55",
    status: "generating",
  },
  {
    id: "m7",
    thumbnail: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    quality: "1080p",
    description:
      "Phòng ngủ vintage sang trọng với đèn chùm pha lê, rèm nhung đỏ đô, giường canopy gỗ cổ điển, sàn gỗ parquet bóng loáng...",
    model: "fast_ultra_relaxed",
    seed: "781234",
    timeInfo: "15:55",
    status: "done",
  },
  {
    id: "m8",
    thumbnail: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80&fit=crop",
    label: "TEXT TO VIDEO",
    aspectRatio: "16:9",
    styleTag: "relaxed",
    description:
      "Phòng ngủ penthouse tối giản với tường kính toàn cảnh thành phố ban ngày, ánh sáng chan hòa, giường king-size trắng tinh...",
    model: "fast_ultra_relaxed",
    seed: "643218",
    timeInfo: "15:55",
    status: "done",
  },
];

/** A generation job (pending / running / done / error) */
export interface GenerationJob {
  id: string;
  ts: number;
  status: "pending" | "running" | "done" | "error";
  /** Output video data URLs or URIs */
  videos: string[];
  error?: string;
  prompt: string;
  configSnapshot: VideoConfig;
}

/** Status for individual async operations */
export type OpStatus = "idle" | "loading" | "done" | "error";

/** A single prompt item in the Step 2 result list */
export interface PromptItem {
  id: string;
  promptText: string;
  /** Voice-over / dialogue text (from voids array) */
  voiceText?: string;
  /** Generated video data URL / URI */
  videoSrc?: string;
  videoStatus: OpStatus;
  videoError?: string;
  /** Generated audio data URL */
  audioSrc?: string;
  audioStatus: OpStatus;
  audioError?: string;
}

/** A prompt template option */
export interface PromptTemplate {
  id: string;
  label: string;
  icon: string;
  template: string;
  placeholder: string;
  prompt: string;
}

// ── Model Options ──────────────────────────────────────────────────────────

export const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "16:9", label: "16:9 Landscape", icon: "🖥" },
  { value: "9:16", label: "9:16 Portrait", icon: "📱" },
  { value: "1:1", label: "1:1 Square", icon: "⬜" },
  { value: "4:3", label: "4:3 Standard", icon: "📺" },
  { value: "3:4", label: "3:4 Portrait", icon: "📄" },
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

// ── Style Reference Gallery ────────────────────────────────────────────────
export const STYLE_GALLERY = [
  {
    url: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=220&q=75&fit=crop",
    label: "Cinematic",
    prompt: "Cinematic film style, dramatic lighting, professional movie color grading",
  },
  {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=220&q=75&fit=crop",
    label: "Sci-Fi",
    prompt: "Futuristic sci-fi aesthetic, clean holographic tech look, cool blue tones",
  },
  {
    url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=220&q=75&fit=crop",
    label: "Vintage",
    prompt: "Vintage 35mm film look, warm grain texture, retro color palette",
  },
  {
    url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=220&q=75&fit=crop",
    label: "Neon Noir",
    prompt: "Dark neon-noir cyberpunk atmosphere, rain-slicked streets, vivid neon lights",
  },
  {
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=220&q=75&fit=crop",
    label: "Portrait",
    prompt: "Soft portrait photography, studio bokeh, warm skin tones",
  },
  {
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=220&q=75&fit=crop",
    label: "Nature",
    prompt: "Breathtaking nature photography, golden hour light, vivid landscape",
  },
];

// ── Prompt Templates ──────────────────────────────────────────────────────
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "affiliate_review",
    label: "Review Sản phẩm",
    icon: "⭐",
    template: `Nhân vật: “Dạ Dày” Concept: Dạ dày là đầu bếp chính, phải xử lý mọi món ăn con người gửi xuống. Nội dung: Mở đầu: Dạ dày tự hào chế biến “món ăn năng lượng”. Vấn đề: Đồ cay nóng, ăn khuya, ăn nhanh → bếp cháy, đầu bếp stress. Giáo dục: Tiêu hoá, acid dạ dày, nguy cơ viêm loét. Giải pháp: Ăn đúng giờ, nhai kỹ, giảm đồ cay dầu. Kết: Trà An Sinh như “nước làm dịu nhà bếp”, dạ dày hoạt động êm ái.`,
    placeholder:
      "VD: `Nhân vật: “Dạ Dày” Concept: Dạ dày là đầu bếp chính, phải xử lý mọi món ăn con người gửi xuống. Nội dung: Mở đầu: Dạ dày tự hào chế biến “món ăn năng lượng”. Vấn đề: Đồ cay nóng, ăn khuya, ăn nhanh → bếp cháy, đầu bếp stress. Giáo dục: Tiêu hoá, acid dạ dày, nguy cơ viêm loét. Giải pháp: Ăn đúng giờ, nhai kỹ, giảm đồ cay dầu. Kết: Trà An Sinh như “nước làm dịu nhà bếp”, dạ dày hoạt động êm ái.",
    prompt: `
    Prompt được viết bằng tiếng Anh. Sau đó viết giúp tôi {{videoCount}} prompt tạo ra {{videoCount}} Video, mỗi Video dài {{videoDuration}} giây được tạo từ Google Flow Veo 3.1. Mỗi prompt không cần lời thoại hay voice over, chỉ có âm thanh của hành động và âm thanh môi trường, không nhạc nền. Prompt viết liền, không giải thích, không xuống dòng, không cách dòng, không tạo bảng, hãy xuất ra 1 mãng mà mỗi phần tử là 1 prompt trong đó, câu hội thoại để trong dấu ' '. Bạn hãy luôn ghi nhớ, bất kỳ cảnh nào có nhân vật "Nhân vật", đều phải đưa chi tiết mô tả của nhân vật "Nhân vật" vào trong từng Prompt khi có nhân vật xuất hiện, phải viết cực kỳ chi tiết mô tả nhân vật, không được viết tắt, không được bỏ qua. Hãy nhắc để tạo Video chính xác trong từng prompt. Lời thoại là Tiếng Việt tương thích với từng prompt, nội dung phù hợp với mỗi video dài 8 giây hãy lưu hội thoại vào 1 mãng riêng có tên field "voids" trong object kết quả. Bắt buộc phải xuất kết quả dạng {prompts:[],voids:[]}. Bắt đầu viết khi tôi gửi nội dung dưới đây nha: {{template}}`,
  },
  {
    id: "unboxing",
    label: "Unboxing",
    icon: "📦",
    template: "Mở hộp sản phẩm theo phong cách viral",
    placeholder: "VD: iPhone 16 Pro Max màu titan sa mạc, hộp trắng cao cấp...",
    prompt: "Mở hộp sản phẩm theo phong cách viral",
  },
  {
    id: "comparison",
    label: "So sánh",
    icon: "⚖️",
    template: "So sánh sản phẩm vs đối thủ hoặc before/after",
    placeholder: "VD: Kem chống nắng A vs B, test độ bền dưới nước...",
    prompt: "So sánh sản phẩm vs đối thủ hoặc before/after",
  },
  {
    id: "tutorial",
    label: "Hướng dẫn",
    icon: "📖",
    template: "Video tutorial, hướng dẫn sử dụng step-by-step",
    placeholder: "VD: Máy xay sinh tố, các bước làm sinh tố, nút bấm...",
    prompt: "Video tutorial, hướng dẫn sử dụng step-by-step",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    icon: "✨",
    template: "Phong cách sống, aspirational marketing cao cấp",
    placeholder: "VD: Túi da thật Ý, người phụ nữ thanh lịch, cafe Paris...",
    prompt: "Phong cách sống, aspirational marketing cao cấp",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    icon: "🗣️",
    template: "User-generated content, người thật chia sẻ cảm nhận",
    placeholder: "VD: Serum Vitamin C, da sáng sau 2 tuần, người dùng thật...",
    prompt: "User-generated content, người thật chia sẻ cảm nhận",
  },
  {
    id: "custom",
    label: "Tùy chỉnh",
    icon: "🎨",
    template: "Nhập ý tưởng bất kỳ, AI sẽ tạo prompt chuyên nghiệp",
    placeholder: "Mô tả ý tưởng video của bạn...",
    prompt: "Nhập ý tưởng bất kỳ, AI sẽ tạo prompt chuyên nghiệp",
  },
];

// ── Default Configs ────────────────────────────────────────────────────────
export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  duration: 8,
  aspectRatio: "16:9",
  quality: "high",
  outputFormat: "mp4",
  numberOfOutputs: 1,
  generateSubtitles: false,
  personGeneration: "allow_adult",
  speed: "relaxed",
};

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  type: "builtin",
  voiceName: BUILTIN_VOICES[0].value,
};

// ── Prompt Builder ─────────────────────────────────────────────────────────

/**
 * Các biến có thể dùng trong prompt template dưới dạng {{key}}.
 * Thêm key mới ở đây nếu cần thêm placeholder mới trong tương lai.
 */
export interface PromptVars {
  /** Số lượng video cần tạo (từ videoConfig.numberOfOutputs) */
  videoCount: number;
  /** Thời lượng mỗi video tính bằng giây (từ videoConfig.duration) */
  videoDuration: number;
  /** Nội dung template (from PromptTemplate.template) */
  template: string;
  /** Nội dung người dùng nhập vào textarea */
  userInput: string;
  /** Các biến mở rộng tùy ý khác */
  [key: string]: string | number;
}

/**
 * Nhận chuỗi template có dạng {{key}} và một object vars,
 * thay thế tất cả {{key}} bằng giá trị tương ứng trong vars.
 *
 * Ví dụ:
 *   buildPrompt("Tạo {{videoCount}} video dài {{videoDuration}}s", { videoCount: 3, videoDuration: 8 })
 *   → "Tạo 3 video dài 8s"
 */
export function buildPrompt(templatePrompt: string, vars: PromptVars): string {
  // Replace tất cả {{key}} với giá trị từ vars
  let result = templatePrompt.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
  return result;
}

// ── Factory Helpers ────────────────────────────────────────────────────────
export const makeMediaItem = (role: ItemRole, mediaType: MediaType = "image"): MediaItem => ({
  id: uid(),
  role,
  mediaType,
  src: null,
  prompt: "",
});

export const makeDialogueLine = (start = 0, end = 3): DialogueLine => ({
  id: uid(),
  start,
  end,
  text: "",
  voice: BUILTIN_VOICES[0].value,
});

// ── Shared button/card style builders ─────────────────────────────────────
type CSSProps = Record<string, any>;

export const card = (extra: CSSProps = {}): CSSProps => ({
  background: CSS.bgCard,
  border: CSS.border,
  borderRadius: CSS.radius,
  backdropFilter: "blur(10px)",
  ...extra,
});

export const btn = (extra: CSSProps = {}): CSSProps => ({
  border: "none",
  borderRadius: CSS.radiusSm,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.15s",
  ...extra,
});
