import type { AudioImageScene, AudioImageToVideoFormState } from "./audio-image-types";

/**
 * Phong cách mặc định cho GENERATE ẢNH — whiteboard explainer 2D (không bàn tay).
 * Chỉ khóa nét/palette/nền — KHÔNG khóa layout/icon cố định (tránh mọi scene giống nhau).
 */
export const DEFAULT_AUDIO_IMAGE_ART_STYLE = `Minimalist 2D whiteboard explainer illustration drawn ON TOP of the provided reference background image (keep that background 100% unchanged). Clean black line-art with flat vector / doodle look — thin consistent outlines, minimal shading, high contrast. Depict the UNIQUE subject, objects, and metaphor that match THIS scene's dialogue — vary composition freely (single icon, process steps, characters, objects, charts-as-shapes, before/after, etc.) as the dialogue requires. Use accent colors sparingly when helpful (e.g. soft yellow highlight, red for negative, green for positive) — do NOT force a left-red-X / right-green-check layout on every scene. Finished static slide only — absolutely NO text, NO numbers, NO logos, NO human hand, NO fingers, NO arm, NO pen, NO marker, NO drawing utensil, NO drawing-in-progress. Professional presentation / explainer-video aesthetic — NOT 3D, NOT cinematic, NOT photorealistic.`;

/** Suffix ngắn gắn vào mỗi visualPrompt — không nhét layout mẫu vào mọi scene */
export const STYLE_LOCK_SUFFIX =
  " [STYLE LOCK — same 2D whiteboard series: black line-art doodle on unchanged reference background, consistent stroke weight & limited accent palette; UNIQUE subject/composition for THIS scene's dialogue only. No hand, no text/numbers/logos.]";

/** Chỉ dùng cho motionPrompt khi bật "Bàn tay đang vẽ" — không gắn vào generate ảnh */
export const DEFAULT_AUDIO_IMAGE_MOTION_HAND_NOTE = `In the video motion, a realistic human right hand holding a white dry-erase marker progressively draws the illustration on the whiteboard.`;

/**
 * Gắn vào prompt gen video khi có ảnh draw-audio.jpg làm tham chiếu thành phần.
 * Yêu cầu model khớp đúng bàn tay / bút trong ảnh reference.
 */
export const DRAWING_HAND_REFERENCE_PROMPT =
  "Use the provided hand-holding-pen reference image as the exact visual identity for the drawing hand (same hand shape, skin tone, grip, and pen). Animate that referenced hand progressively drawing the illustration on the whiteboard.";

/** Chỉ gắn vào prompt GENERATE ẢNH — giữ đúng ảnh nền 100% */
export const USE_UPLOADED_BACKGROUND_PROMPT =
  "Keep the reference background image 100% unchanged (colors, size, aspect ratio, UI/appearance, contrast, material/texture). Only draw new content on top of it.";

/** Chỉ gắn vào prompt GENERATE ẢNH — không vẽ chữ / số / logo */
export const NO_TEXT_NUMBERS_LOGO_IMAGE_PROMPT =
  "Do NOT draw or write any text, numbers, letters, words, captions, labels, typography, or logos.";

/**
 * Gỡ các rule nền/video cũ khỏi motionPrompt (không gắn thêm gì).
 * Gen video audio-image chỉ gửi motion + dialogue; ảnh đầu/cuối làm tham chiếu component.
 */
export function ensureMotionStartsFromBlankPaper(motionPrompt: string): string {
  return (motionPrompt || "")
    .replace(
      /^Keep the (?:entire )?reference background image 100% unchanged[\s\S]*?(?:The first frame MUST be exactly that (?:full )?background image\.)\s*/i,
      ""
    )
    .replace(
      /^CRITICAL:\s*The very first frame MUST show ONLY[\s\S]*?(?:Then content appears on that same uploaded background\.\s*)?/i,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** @deprecated */
export const VIDEO_BACKGROUND_START_PROMPT = "";
/** @deprecated */
export const BLANK_ON_UPLOADED_BG_MOTION_PREFIX = "";

/** Gắn rule nền + không chữ/số/logo vào ĐẦU prompt gen ảnh (không dùng cho video). */
export function finalizeAudioImageGenPrompt(prompt: string): string {
  const text = (prompt || "").trim();
  const cleaned = text
    .replace(/^Keep the reference background image 100% unchanged[^.]*\.\s*/i, "")
    .replace(/^Do NOT draw or write any text, numbers[\s\S]*?\.\s*/i, "")
    .replace(/\s*CRITICAL BACKGROUND RULE:[\s\S]*$/i, "")
    .replace(/\s*Keep the reference background image 100% unchanged[\s\S]*$/i, "")
    .replace(/\s*Do NOT draw or write any text, numbers[\s\S]*$/i, "")
    .replace(/\s*CRITICAL: The very first frame MUST show ONLY[\s\S]*?(?=\s*$)/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const prefix = `${USE_UPLOADED_BACKGROUND_PROMPT} ${NO_TEXT_NUMBERS_LOGO_IMAGE_PROMPT}`;
  if (!cleaned) return prefix;
  if (
    cleaned.startsWith(USE_UPLOADED_BACKGROUND_PROMPT) &&
    cleaned.includes(NO_TEXT_NUMBERS_LOGO_IMAGE_PROMPT)
  ) {
    return cleaned;
  }
  return `${prefix} ${cleaned}`.trim();
}

/** @deprecated dùng finalizeAudioImageGenPrompt */
export function ensureImageUsesUploadedBackground(prompt: string): string {
  return finalizeAudioImageGenPrompt(prompt);
}

/** Quy tắc đồng nhất style — inject vào prompt phân tích */
export const STYLE_CONSISTENCY_PROMPT_BLOCK = `
QUY TẮC ĐỒNG NHẤT PHONG CÁCH + ĐA DẠNG NỘI DUNG (BẮT BUỘC):
- Đồng nhất PHONG CÁCH (nét, palette, nền): mọi scene cùng series whiteboard 2D trên ĐÚNG ảnh nền tham chiếu (không chỉnh sửa nền), độ dày nét và kiểu doodle/vector giống nhau.
- KHÔNG đổi phong cách giữa các scene (không lẫn 3D / realistic / palette khác).
- ĐA DẠNG NỘI DUNG (bắt buộc): mỗi scene phải có chủ thể / bố cục / metaphor KHÁC nhau, bám sát dialogue của scene đó.
- CẤM copy-paste cùng một bố cục cho nhiều scene (ví dụ mọi scene đều lightbulb giữa, hoặc mọi scene đều so sánh trái X đỏ / phải tick xanh) trừ khi đúng dialogue của scene đó là so sánh.
- visualPrompt phải nêu rõ đối tượng cụ thể của scene (người/vật/hành động/khái niệm trong dialogue) — không dùng mô tả chung chung lặp lại.
- visualPrompt / generate ảnh: không bàn tay; không chữ/số/logo; nền tham chiếu giữ nguyên 100%.`;

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
  // Art style mặc định đã dài + chứa hướng dẫn chung → chỉ gắn suffix ngắn để tránh mọi scene bị “dán” cùng layout mẫu.
  if (!trimmed || trimmed === DEFAULT_AUDIO_IMAGE_ART_STYLE) {
    return `${STYLE_LOCK_SUFFIX}${NO_HAND_IMAGE_SUFFIX}`;
  }
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
