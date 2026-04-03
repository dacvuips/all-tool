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

export type StoryModeType = "prompt_to_video" | "image_to_video";

/** Affiliate sidebar form configuration */
export interface AffiliateFormConfig {
  category: string;
  objectToPersonify: string;
  tipContent: string;
  mood: string;
  language: string;
  artStyle: string;
  storyModeType: StoryModeType;
  aspectRatio: AspectRatio;
  batchSize: number;
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

// ── Sidebar Form Options ───────────────────────────────────────────────────

/** @deprecated Use ART_STYLE_OPTIONS instead */
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
  { value: "pixar", label: "3D Pixar" },
  { value: "realistic", label: "Chân thực (Realistic)" },
  { value: "pixar_realism", label: "Pixar Realism (Nhân hoá)" },
  { value: "crochet", label: "Len Móc (Crochet/Amigurumi)" },
  { value: "clay", label: "Đất Sét (Claymation)" },
  { value: "diorama", label: "Mô hình Tí hon (Diorama)" },
  { value: "lego", label: "Đồ chơi Gạch (LEGO)" },
  { value: "mannequin", label: "Mannequin 3D (Siêu thực)" },
  { value: "zack_doge", label: "3D Educational (Zack D.Style)" },
  { value: "chalkboard", label: "Bảng Phấn (Chalkboard)" },
  { value: "2d_minimalist", label: "2D Tối Giản (Minimalist)" },
  { value: "stickman", label: "Người Que (Stickman)" },
  { value: "simpsons", label: "Hoạt hình Simpsons" },
  { value: "business", label: "Giải thích Doanh nghiệp" },
  { value: "cinematic_dark", label: "Cinematic Dark Surrealism" },
];

export const LANGUAGE_OPTIONS = [
  { value: "vn", label: "🇻🇳 Tiếng Việt", flag: "vn" },
  { value: "en", label: "🇺🇸 English", flag: "us" },
  { value: "zh", label: "🇨🇳 中文", flag: "cn" },
  { value: "ja", label: "🇯🇵 日本語", flag: "jp" },
  { value: "ko", label: "🇰🇷 한국어", flag: "kr" },
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

export interface SceneItem {
  id: string;
  number: number;
  cameraShot: CameraShotType;
  imageGenPrompt: string;
  motionPrompt: string;
  dialogue: string;
}

export interface ScriptData {
  title: string;
  tag: string;
  characters: CharacterItem[];
  environment: EnvironmentConfig;
  audioConfig: AudioVoiceConfig;
  scenes: SceneItem[];
}

// ── Mock Script Data ───────────────────────────────────────────────────────
export const MOCK_SCRIPT: ScriptData = {
  title: "Dàn Nhân Vật (Cast)",
  tag: "10 MẸO VẶT NGÀY TẾT - DRAMA MẸ CHỒNG NÀNG DÂU CỰC CĂNG",
  characters: [
    {
      id: "c1",
      number: 1,
      name: "Bà Lan",
      tag: "Mẹ chồng",
      description:
        "Gender: Female, Age: 65, Ethnicity: Vietnamese, Skin tone: warm tan, Hair: short curly black hair with gray streaks tied in a loose bun, Eyes: dark brown, Face: round face with fine wrinkles around eyes and mouth, Body: plump medium build, Clothing: dark red cotton áo bà ba with subtle gold floral embroidery, black cloth slippers, Distinctive features: gold hoop earrings, green jade bangle bracelet",
    },
    {
      id: "c2",
      number: 2,
      name: "Chị Minh",
      tag: "Nàng dâu",
      description:
        "Gender: Female, Age: 28, Ethnicity: Vietnamese, Skin tone: warm light brown, Hair: long straight black hair tied in neat ponytail, Eyes: dark almond-shaped, Face: oval face with smooth skin, Body: slim athletic build, Clothing: light pink cotton blouse with white floral pattern, beige capri pants, white canvas sneakers, Distinctive features: simple silver hoop earrings",
    },
  ],
  environment: {
    environment:
      "Traditional Vietnamese family home during Tet holiday, ancestor altar with incense smoke and fresh fruits like oranges and coconuts, busy kitchen counter cluttered with banana leaves sticky rice pots boiling, courtyard with potted kumquat tree peach blossoms, red lanterns motorbikes outside bustling street sounds.",
    artStyle:
      "Cinematic realistic lighting, 8k, photorealistic, high fidelity, shot on 35mm lens, depth of field, natural colors. DO NOT USE '3d', 'render' or 'cartoon' keywords.",
  },
  audioConfig: {
    gender: "Female",
    mood: "Energetic",
    style: "Casual",
    fullPrompt:
      "(Voice: Female, Southern, Middle-aged, Energetic). Speak in a Energetic Southern Vietnamese Middle-aged Female voice.",
  },
  scenes: [
    {
      id: "s1",
      number: 1,
      cameraShot: "LOW ANGLE SHOT",
      imageGenPrompt:
        'Gender: Female, Age: 65, Ethnicity: Vietnamese, Skin tone: warm tan, Hair: short curly black hair with gray streaks tied in a loose bun, Eyes: dark brown, Face: round face with fine wrinkles around eyes and mouth, Body: plump medium build, Clothing: dark red cotton áo bà ba with subtle gold floral embroidery, black cloth slippers, Distinctive features: gold hoop earrings, green jade bangle bracelet. Gender: Female, Age: 28, Ethnicity: Vietnamese, Skin tone: warm light brown, Hair: long straight black hair tied in neat ponytail, Eyes: dark almond-shaped, Face: oval face with smooth skin, Body: slim athletic build, Clothing: light pink cotton blouse with white floral pattern, beige capri pants, white canvas sneakers, Distinctive features: simple silver hoop earrings. Chị Minh squeezes toothpaste tube towards silver tray with confident squeeze, fingers gripping firmly, Bà Lan shakes head slowly arms tightening across chest, stern scowl deepening, incense smoke curling upwards, pots bubbling softly, camera low angle pushing up to emphasize tension. Setting: Traditional Vietnamese family home during Tet holiday, ancestor altar with incense smoke and fresh fruits like oranges and coconuts, busy kitchen counter cluttered with banana leaves sticky rice pots boiling, courtyard with potted kumquat tree peach blossoms, red lanterns motorbikes outside bustling street sounds. Cinematic realistic lighting, 8k, photorealistic, high fidelity, shot on 35mm lens, depth of field, natural colors. DO NOT USE \'3d\', \'render\' or \'cartoon\' keywords.',
      motionPrompt:
        "Chị Minh squeezes toothpaste tube towards silver tray with confident squeeze, fingers gripping firmly, Bà Lan shakes head slowly arms tightening across chest, stern scowl deepening, incense smoke curling upwards, pots bubbling softly, camera low angle pushing up to emphasize tension.",
      dialogue:
        '"Chị Minh, cô gái áo hồng nhạt tóc đuôi gà: \'Mẹo 1 lau bạc: kem đánh răng chà lên khay, lau sạch bóng loáng ngay mẹ ơi!\' Bà Lan, bà áo bà ba đỏ sậm: \'Làm nhanh đi con, đừng lề mề kéo Tết muộn!\'"',
    },
    {
      id: "s2",
      number: 2,
      cameraShot: "OVER-THE-SHOULDER TRACKING SHOT",
      imageGenPrompt:
        "Chị Minh shakes jar vigorously back and forth with both hands gripping tight, garlic skins loosening fluttering inside, face focused brows furrowed, Bà Lan taps foot impatiently jade bracelet jangling, steam rising from background pot, camera over-the-shoulder tracking shake.",
      motionPrompt:
        "Chị Minh shakes jar vigorously back and forth with both hands gripping tight, garlic skins loosening fluttering inside, face focused brows furrowed, Bà Lan taps foot impatiently jade bracelet jangling, steam rising from background pot, camera over-the-shoulder tracking shake.",
      dialogue:
        '"Chị Minh, cô gái áo hồng nhạt tóc đuôi gà: \'Mẹo 2 bóc tỏi: cho vào lọ lắc mạnh, vỏ tự bong sạch sẽ!\' Bà Lan, bà áo bà ba đỏ sậm: \'Nhanh chứ lắc mãi không xong thì phí công!\'"',
    },
    {
      id: "s3",
      number: 3,
      cameraShot: "MACRO EXTREME CLOSE-UP",
      imageGenPrompt:
        "Knife twists in spiral motion peeling continuous strip unfurling smoothly, papaya rotating slowly under firm grip, juice droplets trickling down blade sparkling, peels fluttering lightly, camera macro dolly zooming in on peeling contact point with subtle hand tremor.",
      motionPrompt:
        "Knife twists in spiral motion peeling continuous strip unfurling smoothly, papaya rotating slowly under firm grip, juice droplets trickling down blade sparkling, peels fluttering lightly, camera macro dolly zooming in on peeling contact point with subtle hand tremor.",
      dialogue: '"Người dẫn chuyện: \'Mẹo 3 got đủ đũa: xoắn dao theo xoắn ốc, đẹp mắt mời khách Tết!\'"',
    },
  ],
};
