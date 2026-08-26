import type { AudioImageScene, AudioImageToVideoFormState } from "./audio-image-types";

/**
 * Phong cách mặc định cho GENERATE ẢNH — whiteboard explainer 2D (không bàn tay):
 * nền trắng, icon nét đen tối giản, ý chính ở giữa, đối chiếu trái/phải, accent đỏ/xanh/vàng.
 */
export const DEFAULT_AUDIO_IMAGE_ART_STYLE = `Minimalist 2D whiteboard explainer slide on a pure white background. Clean black line-art icons with flat vector / doodle look — thin consistent outlines, minimal shading, high contrast. Main idea centered as a bold simple icon or metaphor matching the dialogue (like a glowing lightbulb for a key concept). Optional left-vs-right comparison layout: negative/complex ideas on the left marked with a textured bold red X; positive/simple ideas on the right marked with a textured bold green checkmark; a simple black arrow showing the transition. Use soft yellow glow only to highlight the central key idea. Bottom-center title text in clean black sans-serif all-caps casual lettering summarizing the scene topic. Finished static slide only — absolutely NO human hand, NO fingers, NO arm, NO pen, NO marker, NO drawing utensil, NO drawing-in-progress. Professional presentation / explainer-video aesthetic — NOT 3D, NOT cinematic, NOT photorealistic.`;

/** Chỉ dùng cho motionPrompt khi bật "Bàn tay đang vẽ" — không gắn vào generate ảnh */
export const DEFAULT_AUDIO_IMAGE_MOTION_HAND_NOTE = `In the video motion, a realistic human right hand holding a white dry-erase marker progressively draws the illustration on the whiteboard.`;

/** Quy tắc đồng nhất style — inject vào prompt phân tích */
export const STYLE_CONSISTENCY_PROMPT_BLOCK = `
QUY TẮC ĐỒNG NHẤT PHONG CÁCH (BẮT BUỘC — áp dụng MỌI scene):
- Tất cả scene trong cùng một video PHẢI trông như cùng một bộ slide / cùng một series whiteboard explainer.
- Giữ CỐ ĐỊNH xuyên suốt: nền trắng, độ dày nét vẽ, palette màu (đen line-art + đỏ X + xanh tick + vàng glow nhấn), kiểu icon doodle/vector, font chữ caps ở footer.
- KHÔNG đổi phong cách giữa các scene (không scene kiểu 3D, scene kiểu realistic, scene kiểu khác palette).
- Chỉ thay NỘI DUNG minh họa theo dialogue; phong cách trình bày giữ nguyên 100%.
- Scene 1 đặt "style anchor" — mọi scene sau bám đúng anchor đó.
- visualPrompt / generate ảnh: tuyệt đối không có bàn tay cầm bút.`;

export const NO_HAND_IMAGE_SUFFIX =
  " IMPORTANT: still image only — do NOT show any human hand, fingers, arm, pen, marker, pencil, or drawing utensil.";

/** Cắt các cụm mô tả bàn tay / bút vẽ khỏi prompt gen ảnh */
export function stripDrawingHandFromPrompt(text: string): string {
  if (!text?.trim()) return text || "";
  return text
    .replace(/\b(realistic|stylized|cartoon|2d|human)?\s*(right|left)?\s*hand[s]?\b[^.\[;\n]{0,120}/gi, " ")
    .replace(/\b(fingers?|arm|wrist)\b[^.\[;\n]{0,40}/gi, " ")
    .replace(
      /\b(holding|gripping|grasping)\s+(a\s+)?(grey|gray|white|black)?\s*(dry-?erase\s+)?(marker|pen|pencil|brush)\b[^.\[;\n]{0,80}/gi,
      " "
    )
    .replace(/\b(marker|pen|pencil|brush)\s+(near|on|at|touching)\b[^.\[;\n]{0,60}/gi, " ")
    .replace(/\b(as if|currently|progressively)\s+(drawing|writing|sketching)[^.\[;\n]{0,80}/gi, " ")
    .replace(/\bdrawing[- ]in[- ]progress\b/gi, " ")
    .replace(/\bhand[- ]drawing\b/gi, "flat illustration")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Prompt dùng riêng cho Generate Image — đã loại bàn tay + ép negative */
export function toStillImageGenPrompt(visualPrompt: string): string {
  const cleaned = stripDrawingHandFromPrompt(visualPrompt);
  if (!cleaned) return NO_HAND_IMAGE_SUFFIX.trim();
  if (cleaned.includes("do NOT show any human hand")) return cleaned;
  return `${cleaned}${NO_HAND_IMAGE_SUFFIX}`;
}

function buildStyleLockSuffix(artStyle: string): string {
  const trimmed = stripDrawingHandFromPrompt(artStyle.trim());
  if (!trimmed) return NO_HAND_IMAGE_SUFFIX;
  return ` [STYLE LOCK — identical series look across all scenes: ${trimmed}]${NO_HAND_IMAGE_SUFFIX}`;
}

/** Gắn style lock vào cuối mỗi visualPrompt; imageGenPrompt dùng bản không bàn tay */
export function applyStyleLockToScenes(
  scenes: AudioImageScene[],
  artStyle: string
): AudioImageScene[] {
  const lock = buildStyleLockSuffix(artStyle);

  return scenes.map((scene) => {
    let visual = scene.visualPrompt.trim();
    if (!visual) return scene;

    visual = stripDrawingHandFromPrompt(visual);
    if (!visual.includes("[STYLE LOCK") && !visual.includes("do NOT show any human hand")) {
      visual = `${visual}${lock}`;
    } else if (!visual.includes("do NOT show any human hand")) {
      visual = `${visual}${NO_HAND_IMAGE_SUFFIX}`;
    }

    return {
      ...scene,
      visualPrompt: visual,
    };
  });
}

export function hasCustomArtStyle(form: AudioImageToVideoFormState): boolean {
  return !!(form.artStyle?.trim() || form.artStyleId?.trim());
}

/**
 * Art style cho generate ẢNH / visualPrompt tĩnh.
 * Luôn không có bàn tay — bàn tay chỉ nằm trong motionPrompt (video).
 */
export function resolveAudioImageArtStyle(form: AudioImageToVideoFormState): string {
  if (form.artStyle?.trim()) {
    return stripDrawingHandFromPrompt(form.artStyle.trim());
  }
  return DEFAULT_AUDIO_IMAGE_ART_STYLE;
}
