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
  visualPrompt: string;
}

export interface SceneScript {
  sceneNumber: number;
  camera: string;
  visualPrompt: string;
  imagePrompt: string;
  motionPrompt: string;
  dialogue: string;
}

export interface ScriptData {
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

/* ── Example JSON shape (for reference) ────────────────────────────────────
{
    "topicTitle": "Cách ăn chuối tốt nhất",
    "artStyle": "Hoạt hình 3D phong cách Pixar, tươi sáng và rực rỡ",
    "environment": "Một căn bếp hiện đại, sáng sủa với ánh nắng tự nhiên chiếu vào",
    "characterName": "Chuối Vàng",
    "characterBaseDescription": "...",
    "voiceGender": "Nam",
    "voiceTone": "Vui vẻ, thân thiện",
    "voiceStyle": "Hoạt bát, năng động",
    "scenes": [
        {
            "sceneNumber": 1,
            "camera": "close-up",
            "visualPrompt": "A close-up shot on an anthropomorphic, cheerful 3D Pixar style banana named Chuối Vàng, standing confidently on a clean kitchen counter. The background is a bright, slightly blurred modern kitchen. The banana has expressive eyes, a wide smile, and small, animated arms and legs. Shot for 9:16 aspect ratio.",
            "imagePrompt": "A vibrant, highly detailed 3D Pixar animation of a fresh, anthropomorphic banana character, \"Chuối Vàng\", with large expressive eyes, a friendly wide smile, and small, jointed limbs. He stands on a polished kitchen counter, casting a soft shadow. The background is a sunlit, modern kitchen interior, with warm tones.",
            "motionPrompt": "Chuối Vàng bounces slightly with excitement, waving one hand. His facial expression is animated, showing eagerness as he gestures to the viewer. His body language is inviting and full of positive energy. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
            "dialogue": "Chào các bạn! Mình là Chuối Vàng đây! Hôm nay, mình sẽ bật mí một bí mật nhỏ nhưng cực kỳ quan trọng: đó là cách ăn chuối ngon nhất, đúng chuẩn nhất để tận hưởng trọn vẹn hương vị và dinh dưỡng!"
        },
        {
            "sceneNumber": 2,
            "camera": "medium shot",
            "visualPrompt": "Medium shot of Chuối Vàng demonstrating how to peel a banana. He holds a second, identical banana (not anthropomorphic) with his animated hands, showing the \"bottom-up\" peeling method. His expression is focused and didactic but still cheerful. Kitchen counter background. 9:16 aspect ratio.",
            "imagePrompt": "A cheerful 3D Pixar anthropomorphic banana, \"Chuối Vàng\", demonstrating the peeling of a regular banana. He holds the banana firmly, peeling it from the non-stem end (the bottom) with his animated hands. His expression is helpful and confident. The setting is a bright, clean kitchen counter.",
            "motionPrompt": "Chuối Vàng slowly and deliberately peels the banana from the bottom, showing the technique with clear hand gestures. He looks at the camera, then down at the banana, emphasizing the motion. His eyes twinkle, and he nods subtly as if to confirm the right way. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
            "dialogue": "Thường thì chúng ta hay bóc từ cuống đúng không? Nhưng bí quyết là hãy bóc từ 'đít' chuối, hay còn gọi là phần cuối của quả. Các bạn thấy không? Cách này không chỉ giúp chuối không bị nát mà còn dễ bóc hơn nhiều đấy!"
        },
        {
            "sceneNumber": 3,
            "camera": "close-up",
            "visualPrompt": "Close-up on Chuối Vàng holding up a perfectly ripe banana (not anthropomorphic) to the camera. His face expresses satisfaction and delight. The banana has a few tiny brown spots, indicating ripeness. Bright kitchen background. 9:16 aspect ratio.",
            "imagePrompt": "A joyful 3D Pixar anthropomorphic banana, \"Chuối Vàng\", proudly presenting a ripe banana. The banana he holds has a vibrant yellow color with a few natural brown speckles, signaling its optimal ripeness. His facial expression is one of pure happiness and contentment.",
            "motionPrompt": "Chuối Vàng gently holds the ripe banana, turning it slightly to show its perfect condition. He smiles broadly and nods encouragingly to the camera, his eyes sparkling. He might give a little \"thumbs up\" with his tiny hand. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
            "dialogue": "Và nhớ nhé, hãy chọn những quả chuối chín vàng, có lấm tấm vài chấm nâu nhỏ. Đó là lúc chuối ngọt nhất, thơm nhất và dễ tiêu hóa nhất. Ăn chuối chín không chỉ ngon mà còn tốt cho sức khỏe nữa!"
        },
        {
            "sceneNumber": 4,
            "camera": "medium shot",
            "visualPrompt": "Medium shot of Chuối Vàng happily taking a bite out of the peeled, ripe banana. He chews with visible enjoyment, perhaps closing his eyes momentarily in bliss. A slight messiness around his mouth, adding to the fun. 9:16 aspect ratio.",
            "imagePrompt": "A delightful 3D Pixar anthropomorphic banana, \"Chuối Vàng\", joyfully taking a large bite out of a perfectly peeled and ripe banana. His eyes are wide with pleasure, and a satisfied smile is on his face, indicating pure enjoyment of the delicious fruit.",
            "motionPrompt": "Chuối Vàng takes a big, enthusiastic bite of the banana. His cheeks puff out slightly as he chews with gusto, making happy, exaggerated facial expressions. He might hum a little tune of satisfaction while eating. His small hands hold the banana firmly. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
            "dialogue": "Ngọt lịm, thơm lừng... thật không gì sánh bằng! Và đừng bỏ lỡ phần đầu nhọn nhỏ xíu ở cuối quả nhé, đó là một phần của chuối và hoàn toàn ăn được. Tận hưởng trọn vẹn từng miếng, từng chút một!"
        },
        {
            "sceneNumber": 5,
            "camera": "full shot",
            "visualPrompt": "Full shot of Chuối Vàng striking a confident, friendly pose, perhaps with arms akimbo or giving a thumbs-up. He winks at the camera. The background is a cheerful, slightly deeper focus on the kitchen environment. 9:16 aspect ratio.",
            "imagePrompt": "A charming 3D Pixar anthropomorphic banana, \"Chuối Vàng\", giving a cheerful thumbs-up to the viewer. He stands tall with a confident, happy expression and a friendly wink. The bright, inviting kitchen background is now in sharper focus, showcasing a pleasant home environment.",
            "motionPrompt": "Chuối Vàng gives a final, energetic thumbs-up or a triumphant gesture. He winks playfully at the camera, his body swaying slightly with good humor. He maintains a wide, confident smile, exuding positivity. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
            "dialogue": "Đó! Giờ thì các bạn đã biết cách ăn chuối 'chuẩn không cần chỉnh' rồi đấy! Hãy cùng mình thưởng thức những quả chuối thơm ngon và sống thật vui vẻ mỗi ngày nhé! Tạm biệt và hẹn gặp lại!"
        }
    ]
}
─────────────────────────────────────────────────────────────────────────── */

// ── Mock Script Data ───────────────────────────────────────────────────────
export const MOCK_SCRIPT: ScriptData = {
  topicTitle: "Cách ăn chuối tốt nhất",
  artStyle: "Hoạt hình 3D phong cách Pixar, tươi sáng và rực rỡ",
  environment: "Một căn bếp hiện đại, sáng sủa với ánh nắng tự nhiên chiếu vào",
  characterName: "Chuối Vàng",
  characterBaseDescription:
    "Một quả chuối tươi, được nhân hóa với đôi mắt to tròn, biểu cảm linh hoạt, miệng cười rạng rỡ, và đôi tay, đôi chân nhỏ nhắn đáng yêu. Phong cách hoạt hình 3D của Pixar, với bề mặt mịn màng, màu vàng tươi và một chút xanh ở cuống.",
  voiceGender: "Nam",
  voiceTone: "Vui vẻ, thân thiện",
  voiceStyle: "Hoạt bát, năng động",
  scenes: [
    {
      sceneNumber: 1,
      camera: "close-up",
      visualPrompt:
        "A close-up shot on an anthropomorphic, cheerful 3D Pixar style banana named Chuối Vàng, standing confidently on a clean kitchen counter. The background is a bright, slightly blurred modern kitchen. The banana has expressive eyes, a wide smile, and small, animated arms and legs. Shot for 9:16 aspect ratio.",
      imagePrompt:
        'A vibrant, highly detailed 3D Pixar animation of a fresh, anthropomorphic banana character, "Chuối Vàng", with large expressive eyes, a friendly wide smile, and small, jointed limbs. He stands on a polished kitchen counter, casting a soft shadow. The background is a sunlit, modern kitchen interior, with warm tones.',
      motionPrompt:
        "Chuối Vàng bounces slightly with excitement, waving one hand. His facial expression is animated, showing eagerness as he gestures to the viewer. His body language is inviting and full of positive energy. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
      dialogue:
        "Chào các bạn! Mình là Chuối Vàng đây! Hôm nay, mình sẽ bật mí một bí mật nhỏ nhưng cực kỳ quan trọng: đó là cách ăn chuối ngon nhất, đúng chuẩn nhất để tận hưởng trọn vẹn hương vị và dinh dưỡng!",
    },
    {
      sceneNumber: 2,
      camera: "medium shot",
      visualPrompt:
        'Medium shot of Chuối Vàng demonstrating how to peel a banana. He holds a second, identical banana (not anthropomorphic) with his animated hands, showing the "bottom-up" peeling method. His expression is focused and didactic but still cheerful. Kitchen counter background. 9:16 aspect ratio.',
      imagePrompt:
        'A cheerful 3D Pixar anthropomorphic banana, "Chuối Vàng", demonstrating the peeling of a regular banana. He holds the banana firmly, peeling it from the non-stem end (the bottom) with his animated hands. His expression is helpful and confident. The setting is a bright, clean kitchen counter.',
      motionPrompt:
        "Chuối Vàng slowly and deliberately peels the banana from the bottom, showing the technique with clear hand gestures. He looks at the camera, then down at the banana, emphasizing the motion. His eyes twinkle, and he nods subtly as if to confirm the right way. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
      dialogue:
        "Thường thì chúng ta hay bóc từ cuống đúng không? Nhưng bí quyết là hãy bóc từ 'đít' chuối, hay còn gọi là phần cuối của quả. Các bạn thấy không? Cách này không chỉ giúp chuối không bị nát mà còn dễ bóc hơn nhiều đấy!",
    },
    {
      sceneNumber: 3,
      camera: "close-up",
      visualPrompt:
        "Close-up on Chuối Vàng holding up a perfectly ripe banana (not anthropomorphic) to the camera. His face expresses satisfaction and delight. The banana has a few tiny brown spots, indicating ripeness. Bright kitchen background. 9:16 aspect ratio.",
      imagePrompt:
        'A joyful 3D Pixar anthropomorphic banana, "Chuối Vàng", proudly presenting a ripe banana. The banana he holds has a vibrant yellow color with a few natural brown speckles, signaling its optimal ripeness. His facial expression is one of pure happiness and contentment.',
      motionPrompt:
        'Chuối Vàng gently holds the ripe banana, turning it slightly to show its perfect condition. He smiles broadly and nods encouragingly to the camera, his eyes sparkling. He might give a little "thumbs up" with his tiny hand. Smooth, fluid Pixar-style character animation, optimized for 9:16.',
      dialogue:
        "Và nhớ nhé, hãy chọn những quả chuối chín vàng, có lấm tấm vài chấm nâu nhỏ. Đó là lúc chuối ngọt nhất, thơm nhất và dễ tiêu hóa nhất. Ăn chuối chín không chỉ ngon mà còn tốt cho sức khỏe nữa!",
    },
    {
      sceneNumber: 4,
      camera: "medium shot",
      visualPrompt:
        "Medium shot of Chuối Vàng happily taking a bite out of the peeled, ripe banana. He chews with visible enjoyment, perhaps closing his eyes momentarily in bliss. A slight messiness around his mouth, adding to the fun. 9:16 aspect ratio.",
      imagePrompt:
        'A delightful 3D Pixar anthropomorphic banana, "Chuối Vàng", joyfully taking a large bite out of a perfectly peeled and ripe banana. His eyes are wide with pleasure, and a satisfied smile is on his face, indicating pure enjoyment of the delicious fruit.',
      motionPrompt:
        "Chuối Vàng takes a big, enthusiastic bite of the banana. His cheeks puff out slightly as he chews with gusto, making happy, exaggerated facial expressions. He might hum a little tune of satisfaction while eating. His small hands hold the banana firmly. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
      dialogue:
        "Ngọt lịm, thơm lừng... thật không gì sánh bằng! Và đừng bỏ lỡ phần đầu nhọn nhỏ xíu ở cuối quả nhé, đó là một phần của chuối và hoàn toàn ăn được. Tận hưởng trọn vẹn từng miếng, từng chút một!",
    },
    {
      sceneNumber: 5,
      camera: "full shot",
      visualPrompt:
        "Full shot of Chuối Vàng striking a confident, friendly pose, perhaps with arms akimbo or giving a thumbs-up. He winks at the camera. The background is a cheerful, slightly deeper focus on the kitchen environment. 9:16 aspect ratio.",
      imagePrompt:
        'A charming 3D Pixar anthropomorphic banana, "Chuối Vàng", giving a cheerful thumbs-up to the viewer. He stands tall with a confident, happy expression and a friendly wink. The bright, inviting kitchen background is now in sharper focus, showcasing a pleasant home environment.',
      motionPrompt:
        "Chuối Vàng gives a final, energetic thumbs-up or a triumphant gesture. He winks playfully at the camera, his body swaying slightly with good humor. He maintains a wide, confident smile, exuding positivity. Smooth, fluid Pixar-style character animation, optimized for 9:16.",
      dialogue:
        "Đó! Giờ thì các bạn đã biết cách ăn chuối 'chuẩn không cần chỉnh' rồi đấy! Hãy cùng mình thưởng thức những quả chuối thơm ngon và sống thật vui vẻ mỗi ngày nhé! Tạm biệt và hẹn gặp lại!",
    },
  ],
};
