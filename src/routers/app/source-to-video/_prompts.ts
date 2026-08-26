/**
 * Prompt builders cho Audio / Image / Text → Video (server-side).
 */
export type SourceTab = "audio" | "image" | "text";

export type SourceToVideoFormLike = {
  sourceTab: SourceTab;
  language?: string;
  rhythm?: string;
  aspectRatio?: string;
  artStyle?: string;
  artStyleId?: string;
  showDrawingHand?: boolean;
  textContent?: string;
  imageCount?: number;
};

const SCENE_DURATION_SEC = 8;

const RHYTHM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "auto_content", label: "Auto theo nội dung" },
  { value: "exact_images", label: "Dùng số ảnh chỉ định" },
  { value: "single_image", label: "Một ảnh xuyên suốt" },
  { value: "full_analysis", label: "Phân tích đầy đủ — mỗi nhịp ý nghĩa/ảnh" },
  { value: "balanced", label: "Cân bằng — khoảng 1-3 phút/ảnh" },
  { value: "chapter", label: "Theo chương — khoảng 3-8 phút/ảnh" },
];

export const DEFAULT_AUDIO_IMAGE_ART_STYLE = `Minimalist 2D whiteboard explainer slide on a pure white background. Clean black line-art icons with flat vector / doodle look — thin consistent outlines, minimal shading, high contrast. Main idea centered as a bold simple icon or metaphor matching the dialogue (like a glowing lightbulb for a key concept). Optional left-vs-right comparison layout: negative/complex ideas on the left marked with a textured bold red X; positive/simple ideas on the right marked with a textured bold green checkmark; a simple black arrow showing the transition. Use soft yellow glow only to highlight the central key idea. Bottom-center title text in clean black sans-serif all-caps casual lettering summarizing the scene topic. Finished static slide only — absolutely NO human hand, NO fingers, NO arm, NO pen, NO marker, NO drawing utensil, NO drawing-in-progress. Professional presentation / explainer-video aesthetic — NOT 3D, NOT cinematic, NOT photorealistic.`;

const STYLE_CONSISTENCY_PROMPT_BLOCK = `
QUY TẮC ĐỒNG NHẤT PHONG CÁCH (BẮT BUỘC — áp dụng MỌI scene):
- Tất cả scene trong cùng một video PHẢI trông như cùng một bộ slide / cùng một series whiteboard explainer.
- Giữ CỐ ĐỊNH xuyên suốt: nền trắng, độ dày nét vẽ, palette màu (đen line-art + đỏ X + xanh tick + vàng glow nhấn), kiểu icon doodle/vector, font chữ caps ở footer.
- KHÔNG đổi phong cách giữa các scene (không scene kiểu 3D, scene kiểu realistic, scene kiểu khác palette).
- Chỉ thay NỘI DUNG minh họa theo dialogue; phong cách trình bày giữ nguyên 100%.
- Scene 1 đặt "style anchor" — mọi scene sau bám đúng anchor đó.
- visualPrompt / generate ảnh: tuyệt đối không có bàn tay cầm bút.`;

export const AUDIO_IMAGE_SCENE_JSON_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          dialogue: { type: "string" },
          visualPrompt: { type: "string" },
          motionPrompt: { type: "string" },
        },
        required: ["sceneNumber", "dialogue", "visualPrompt", "motionPrompt"],
      },
    },
  },
  required: ["scenes"],
};

function rhythmLabel(value: string) {
  return RHYTHM_OPTIONS.find((item) => item.value === value)?.label || value;
}

function rhythmRule(value: string, imageCount: number): string {
  switch (value) {
    case "exact_images":
      return `Số scene bám số ảnh đã gửi (${
        imageCount || "N"
      }). Vẫn chia thoại theo đoạn ~${SCENE_DURATION_SEC}s nếu thoại dài hơn.`;
    case "single_image":
      return `Một visual xuyên suốt. Vẫn tách nhiều scene theo thoại, mỗi scene ~${SCENE_DURATION_SEC}s, visualPrompt nhất quán.`;
    case "full_analysis":
      return `Phân tích đầy đủ: mỗi nhịp ý nghĩa trong thoại = 1 scene / 1 slide. Mỗi scene ~${SCENE_DURATION_SEC}s video.`;
    case "balanced":
      return `Cân bằng: visual đổi chậm (khoảng 1-3 phút nội dung/ảnh), nhưng vẫn cắt scene video ~${SCENE_DURATION_SEC}s.`;
    case "chapter":
      return `Theo chương: visual đổi chậm hơn (khoảng 3-8 phút nội dung/ảnh), vẫn cắt scene video ~${SCENE_DURATION_SEC}s.`;
    default:
      return `Auto theo nội dung: chia scene theo ngữ cảnh thoại tự nhiên, mỗi scene hợp với video ~${SCENE_DURATION_SEC}s.`;
  }
}

function stripDrawingHandFromPrompt(text: string): string {
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

function resolveArtStyle(form: SourceToVideoFormLike): string {
  if (form.artStyle?.trim()) {
    return stripDrawingHandFromPrompt(form.artStyle.trim());
  }
  return DEFAULT_AUDIO_IMAGE_ART_STYLE;
}

function hasCustomArtStyle(form: SourceToVideoFormLike): boolean {
  return !!(form.artStyle?.trim() || form.artStyleId?.trim());
}

export const TRANSCRIBE_SYSTEM_INSTRUCTION =
  "You are an expert transcription assistant. Extract all spoken or visible text from the provided source. Return plain text only.";

export function buildAudioTranscribePrompt(form: SourceToVideoFormLike): string {
  const language = form.language || "Vietnamese";
  return `Transcribe the attached audio file completely and accurately.

Requirements:
- Language: ${language}
- Include all spoken words, narration, and dialogue
- Preserve natural paragraph breaks if helpful
- Do NOT summarize or skip content
- Do NOT add commentary

Output: return ONLY the full transcript as plain text. No JSON, no markdown, no explanation.`;
}

export function buildImageExtractTextPrompt(form: SourceToVideoFormLike): string {
  const language = form.language || "Vietnamese";
  return `Analyze the attached image(s) and extract all readable text plus the visual narrative content needed for video scripting.

Requirements:
- Language for output: ${language}
- Include any visible text (OCR)
- Describe key visual story elements that would accompany narration
- Do NOT create scene breakdown yet

Output: plain text only, no JSON, no markdown.`;
}

export function buildAudioImageAnalyzeSystemInstruction(form: SourceToVideoFormLike): string {
  if (form.showDrawingHand !== false) {
    return (
      "You are an expert 2D flat whiteboard animation director. Split source text into timed scenes for 8-second videos. " +
      "Every visualPrompt MUST start with '2D flat illustration:' and describe a completed static 2D flat slide for IMAGE generation — NO hand, NO marker, NO drawing-in-progress. " +
      "Every visualPrompt must tightly match that scene's dialogue. " +
      "Every motionPrompt MUST start with '2D whiteboard drawing animation:' and describe a hand with marker progressively drawing that slide (video only)."
    );
  }

  return (
    "You are an expert 2D flat explainer animation director. Split source text into timed scenes for 8-second videos. " +
    "Every visualPrompt MUST start with '2D flat illustration:' and describe a completed static 2D flat slide — no hand, no marker, no drawing-in-progress. " +
    "Never 3D, photorealistic, or live-action. Every visualPrompt must tightly match that scene's dialogue. " +
    "Every motionPrompt MUST start with '2D flat slide animation:' and describe subtle motion on the finished illustration only (fade, slide, scale, Ken Burns) — no hand drawing."
  );
}

function buildVisualMotionBlocks(form: SourceToVideoFormLike): {
  styleIntro: string;
  visualBlock: string;
  motionBlock: string;
} {
  const showDrawingHand = form.showDrawingHand !== false;

  const visualBlock = `- visualPrompt: mô tả hình ảnh tĩnh để GENERATE IMAGE bằng tiếng Anh. BẮT ĐẦU bằng cụm "2D flat illustration:" rồi mô tả chi tiết. Yêu cầu:
  + Bám sát 1:1 với dialogue của scene: mọi đối tượng / hành động / khái niệm chính trong lời thoại phải hiện rõ trong hình
  + Không dùng visual chung chung nếu dialogue đang nói về chủ đề cụ thể
  + Nếu dialogue nhắc số liệu, tên, so sánh, ví dụ → minh họa đúng các yếu tố đó
  + STRICT 2D ONLY: flat vector cartoon / doodle / explainer style — no 3D, no photorealistic, no live-action
  + Plain white / light paper background, slide đã hoàn thiện (finished illustration)
  + Simple bold outlines, flat color fills, minimal shading
  + KHÔNG có bàn tay, KHÔNG có bút marker, KHÔNG mô tả đang vẽ / viết lên bảng (ảnh tĩnh không có hand)
  + Composition like a presentation slide: main idea centered
  + Enough detail to generate a still image`;

  if (showDrawingHand) {
    return {
      styleIntro:
        "- visualPrompt (GENERATE ẢNH) = slide 2D tĩnh hoàn chỉnh, KHÔNG bàn tay. motionPrompt (VIDEO) = bàn tay cầm bút marker đang vẽ slide đó.",
      visualBlock,
      motionBlock: `- motionPrompt: mô tả chuyển động WHITEBOARD 2D HAND-DRAWING bằng tiếng Anh (chỉ dùng cho VIDEO). BẮT ĐẦU bằng "2D whiteboard drawing animation:". Yêu cầu:
  + A realistic or stylized hand holding a marker progressively draws/reveals the flat illustration matching this scene's dialogue
  + Smooth drawing strokes, flat elements appear as they are drawn
  + Soft camera hold or very subtle Ken Burns only
  + Suitable for an ${SCENE_DURATION_SEC}s video clip`,
    };
  }

  return {
    styleIntro:
      "- Toàn bộ visual + motion theo phong cách 2D FLAT SLIDE: slide tĩnh hoàn chỉnh, KHÔNG bàn tay, KHÔNG bút marker.",
    visualBlock,
    motionBlock: `- motionPrompt: mô tả chuyển động 2D SLIDE bằng tiếng Anh. BẮT ĐẦU bằng "2D flat slide animation:". Yêu cầu:
  + Subtle motion on the finished flat illustration only: gentle fade-in, slide-in, scale, or Ken Burns
  + KHÔNG mô tả bàn tay, bút marker, nét vẽ xuất hiện dần, drawing strokes
  + Soft camera hold or very subtle Ken Burns only
  + Suitable for an ${SCENE_DURATION_SEC}s video clip`,
  };
}

export function buildAudioImageAnalyzePrompt(
  form: SourceToVideoFormLike,
  sourceText: string
): string {
  const language = form.language || "Vietnamese";
  const customArtStyle = hasCustomArtStyle(form);
  const artStyle = resolveArtStyle(form);
  const artStyleNote = customArtStyle
    ? ""
    : `\n(Lưu ý: người dùng chưa chọn phong cách riêng — dùng PHONG CÁCH MẶC ĐỊNH whiteboard explainer như mô tả trên, bám layout: icon line-art đen trên nền trắng, ý chính giữa, so sánh trái/phải với dấu X đỏ / tick xanh khi phù hợp nội dung dialogue. Ảnh tĩnh KHÔNG có bàn tay.)`;
  const source =
    form.sourceTab === "audio" ? "AUDIO" : form.sourceTab === "image" ? "ẢNH" : "VĂN BẢN";
  const textBlock = sourceText.trim()
    ? `\nNỘI DUNG NGUỒN (đã trích xuất ở bước trước):\n${sourceText.trim()}`
    : "";
  const { styleIntro, visualBlock, motionBlock } = buildVisualMotionBlocks(form);
  const showDrawingHand = form.showDrawingHand !== false;
  const directorRole = showDrawingHand
    ? "2D WHITEBOARD (ảnh tĩnh không tay; video có tay vẽ)"
    : "2D FLAT EXPLAINER SLIDE (không bàn tay)";

  return `Bạn là đạo diễn kịch bản AI Video dạng ${directorRole}. Phân tích toàn bộ nội dung nguồn ${source} và tách thành các phân cảnh.

MỤC TIÊU:
- Mỗi scene tương ứng khoảng ${SCENE_DURATION_SEC} giây video.
- Số lượng scene bám sát từng ngữ cảnh / nhịp ý nghĩa trong lời thoại.
- Tiếp tục tách scene cho đến khi hết nội dung đoạn nguồn đã gửi.
- Không gộp nhiều ý thoại khác nhau vào một scene nếu vượt ~${SCENE_DURATION_SEC}s khi đọc tự nhiên.
- Không bịa thêm cốt truyện ngoài nguồn đã cho.
${styleIntro}
- Chỉ dùng nội dung đã cho ở NỘI DUNG NGUỒN; không transcribe lại audio, không bịa thêm.
- visualPrompt BẮT BUỘC bám sát đúng nội dung dialogue của scene đó.
- visualPrompt dùng để GENERATE IMAGE → tuyệt đối không có bàn tay / bút viết.

QUY TẮC PHONG CÁCH 2D (BẮT BUỘC cho mọi visualPrompt / motionPrompt):
- Chỉ dùng minh họa 2D phẳng: flat vector, cartoon, doodle, explainer animation
- KHÔNG được dùng: 3D render, CGI, photorealistic, live-action (trừ bàn tay trong motionPrompt khi được phép)
- Nhân vật / vật thể: silhouette phẳng, nét vẽ đơn giản, màu block
- Bối cảnh: như slide presentation trên nền trắng

THÔNG TIN:
- Ngôn ngữ lời thoại: ${language}
- Nhịp ảnh: ${rhythmLabel(form.rhythm || "")} — ${rhythmRule(
    form.rhythm || "",
    form.imageCount || 0
  )}
- Tỉ lệ khung hình: ${form.aspectRatio || "9:16"}
- Phong cách hình ảnh (generate ảnh): ${artStyle}${artStyleNote}
- Bàn tay đang vẽ: ${
    showDrawingHand
      ? "CHỈ trong motionPrompt (video) — visualPrompt / generate ảnh KHÔNG có bàn tay"
      : "KHÔNG — cấm bàn tay ở cả visualPrompt và motionPrompt"
  }
- BẮT BUỘC phản ánh phong cách hình ảnh ở trên, luôn giữ dạng 2D flat (không chuyển sang 3D/realistic).
${STYLE_CONSISTENCY_PROMPT_BLOCK}
${textBlock}

CHO MỖI SCENE, trả về:
- sceneNumber: số thứ tự bắt đầu từ 1
- dialogue: lời thoại/narration bằng ${language}, đúng đoạn nội dung của scene đó
${visualBlock}
${motionBlock}

OUTPUT: chỉ JSON object { "scenes": [...] }, không markdown, không giải thích.`;
}
