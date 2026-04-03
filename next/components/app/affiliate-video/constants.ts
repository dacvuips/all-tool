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
  storyModeType: StoryModeType;
  aspectRatio: AspectRatio;
  batchSize: number;
}

export type OpStatus = "idle" | "loading" | "done" | "error";

/** A single prompt item in the Step 2 result list */

/** A prompt template option */

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
        "Gender: Female, Age: 65, Ethnicity: Vietnamese, Skin tone: warm tan, Hair: short curly black hair with gray streaks tied in a loose bun, Eyes: dark brown, Face: round face with fine wrinkles around eyes and mouth, Body: plump medium build, Clothing: dark red cotton áo bà ba with subtle gold floral embroidery, black cloth slippers, Distinctive features: gold hoop earrings, green jade bangle bracelet. Gender: Female, Age: 28, Ethnicity: Vietnamese, Skin tone: warm light brown, Hair: long straight black hair tied in neat ponytail, Eyes: dark almond-shaped, Face: oval face with smooth skin, Body: slim athletic build, Clothing: light pink cotton blouse with white floral pattern, beige capri pants, white canvas sneakers, Distinctive features: simple silver hoop earrings. Chị Minh squeezes toothpaste tube towards silver tray with confident squeeze, fingers gripping firmly, Bà Lan shakes head slowly arms tightening across chest, stern scowl deepening, incense smoke curling upwards, pots bubbling softly, camera low angle pushing up to emphasize tension. Setting: Traditional Vietnamese family home during Tet holiday, ancestor altar with incense smoke and fresh fruits like oranges and coconuts, busy kitchen counter cluttered with banana leaves sticky rice pots boiling, courtyard with potted kumquat tree peach blossoms, red lanterns motorbikes outside bustling street sounds. Cinematic realistic lighting, 8k, photorealistic, high fidelity, shot on 35mm lens, depth of field, natural colors. DO NOT USE '3d', 'render' or 'cartoon' keywords.",
      motionPrompt:
        "Chị Minh squeezes toothpaste tube towards silver tray with confident squeeze, fingers gripping firmly, Bà Lan shakes head slowly arms tightening across chest, stern scowl deepening, incense smoke curling upwards, pots bubbling softly, camera low angle pushing up to emphasize tension.",
      dialogue:
        "\"Chị Minh, cô gái áo hồng nhạt tóc đuôi gà: 'Mẹo 1 lau bạc: kem đánh răng chà lên khay, lau sạch bóng loáng ngay mẹ ơi!' Bà Lan, bà áo bà ba đỏ sậm: 'Làm nhanh đi con, đừng lề mề kéo Tết muộn!'\"",
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
        "\"Chị Minh, cô gái áo hồng nhạt tóc đuôi gà: 'Mẹo 2 bóc tỏi: cho vào lọ lắc mạnh, vỏ tự bong sạch sẽ!' Bà Lan, bà áo bà ba đỏ sậm: 'Nhanh chứ lắc mãi không xong thì phí công!'\"",
    },
    {
      id: "s3",
      number: 3,
      cameraShot: "MACRO EXTREME CLOSE-UP",
      imageGenPrompt:
        "Knife twists in spiral motion peeling continuous strip unfurling smoothly, papaya rotating slowly under firm grip, juice droplets trickling down blade sparkling, peels fluttering lightly, camera macro dolly zooming in on peeling contact point with subtle hand tremor.",
      motionPrompt:
        "Knife twists in spiral motion peeling continuous strip unfurling smoothly, papaya rotating slowly under firm grip, juice droplets trickling down blade sparkling, peels fluttering lightly, camera macro dolly zooming in on peeling contact point with subtle hand tremor.",
      dialogue:
        "\"Người dẫn chuyện: 'Mẹo 3 got đủ đũa: xoắn dao theo xoắn ốc, đẹp mắt mời khách Tết!'\"",
    },
  ],
};
