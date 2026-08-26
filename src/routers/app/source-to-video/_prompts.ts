/**
 * Prompt builders cho POST /api/app/{audio|image|text}-to-video/
 * Phân tích: chỉ dialogue + visualPrompt + motionPrompt theo scene ~8s — không gắn art style.
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
          startTime: { type: "number" },
          endTime: { type: "number" },
        },
        required: [
          "sceneNumber",
          "dialogue",
          "visualPrompt",
          "motionPrompt",
          "startTime",
          "endTime",
        ],
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
      return `Một visual xuyên suốt theo nội dung. Vẫn tách nhiều scene theo thoại, mỗi scene ~${SCENE_DURATION_SEC}s.`;
    case "full_analysis":
      return `Phân tích đầy đủ: mỗi nhịp ý nghĩa trong thoại = 1 scene. Mỗi scene ~${SCENE_DURATION_SEC}s video.`;
    case "balanced":
      return `Cân bằng: cắt scene video ~${SCENE_DURATION_SEC}s theo nhịp thoại.`;
    case "chapter":
      return `Theo chương: cắt scene video ~${SCENE_DURATION_SEC}s theo đoạn nội dung.`;
    default:
      return `Auto theo nội dung: chia scene theo ngữ cảnh thoại, mỗi scene ~${SCENE_DURATION_SEC}s.`;
  }
}

export const TRANSCRIBE_SYSTEM_INSTRUCTION =
  "You are an expert transcription assistant with precise audio timing. Return structured JSON only.";

/** Schema: transcript có timestamp từng đoạn. */
export const AUDIO_TIMED_TRANSCRIPT_JSON_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          startTime: { type: "number" },
          endTime: { type: "number" },
        },
        required: ["text", "startTime", "endTime"],
      },
    },
  },
  required: ["segments"],
};

export function buildAudioTranscribePrompt(form: SourceToVideoFormLike): string {
  const language = form.language || "Vietnamese";
  return `Transcribe the attached audio file completely and accurately WITH precise timing.

Requirements:
- Language: ${language}
- Include all spoken words, narration, and dialogue
- Split into natural phrase/sentence segments (not one giant blob)
- For EACH segment provide:
  - text: the spoken words
  - startTime: start time in seconds from the beginning of the audio (number, e.g. 0, 1.2, 12.5)
  - endTime: end time in seconds (number, must be > startTime)
- Timestamps must be accurate and non-overlapping (or only slightly overlapping), covering the full audio in order
- Do NOT summarize or skip content
- Do NOT add commentary

Output: ONLY valid JSON matching this shape (no markdown fences):
{
  "segments": [
    { "text": "Lời thoại đoạn 1", "startTime": 0, "endTime": 3.5 },
    { "text": "Lời thoại đoạn 2", "startTime": 3.5, "endTime": 8.0 }
  ]
}`;
}

export function buildImageExtractTextPrompt(form: SourceToVideoFormLike): string {
  const language = form.language || "Vietnamese";
  return `Extract ALL readable text that appears inside the attached image(s).

Requirements:
- Output language: ${language}
- OCR every visible text: titles, captions, body paragraphs, labels, speech bubbles, UI strings, watermarks if readable
- Preserve reading order (top→bottom, left→right) and natural paragraph breaks
- If multiple images: separate each image with a blank line and a short header like "[Image 1]"
- If an image has little/no text, briefly note that — do NOT invent a story
- Do NOT create scene breakdown, visual prompts, or JSON
- Do NOT summarize away wording — keep the original wording as much as possible

Output: plain text only (the extracted content). No markdown fences, no commentary.`;
}

export function buildAudioImageAnalyzeSystemInstruction(form: SourceToVideoFormLike): string {
  const showDrawingHand = form.showDrawingHand !== false;
  const visualRule =
    "visualPrompt MUST be grounded in THAT scene's dialogue: extract and depict the setting/environment, objects/phenomena, actions, and characters (or people/roles) mentioned or clearly implied — as close to the spoken lines as possible. Do not use generic filler icons unrelated to the dialogue.";
  const timingRule =
    "Always return startTime and endTime (seconds) for every scene. If source has timestamps, preserve them; otherwise estimate from natural speaking pace (~8s/scene), contiguous, non-overlapping.";

  if (showDrawingHand) {
    return (
      "You split source text into ~8-second scenes. " +
      timingRule +
      " For each scene return dialogue, visualPrompt, motionPrompt, startTime, endTime that match that scene's dialogue only. " +
      visualRule +
      " visualPrompt: completed static illustration — no hand, no marker, no text/numbers/logos. " +
      "motionPrompt: hand with marker drawing that same illustration for video. " +
      "Do NOT invent story beyond the source text. Do NOT apply any art-style brand brief."
    );
  }

  return (
    "You split source text into ~8-second scenes. " +
    timingRule +
    " For each scene return dialogue, visualPrompt, motionPrompt, startTime, endTime that match that scene's dialogue only. " +
    visualRule +
    " visualPrompt: completed static illustration — no hand, no marker, no text/numbers/logos. " +
    "motionPrompt: content appearing/revealing on screen for video — no hand drawing. " +
    "Do NOT invent story beyond the source text. Do NOT apply any art-style brand brief."
  );
}

function buildVisualMotionBlocks(form: SourceToVideoFormLike): {
  visualBlock: string;
  motionBlock: string;
} {
  const showDrawingHand = form.showDrawingHand !== false;

  const visualBlock = `- visualPrompt (tiếng Anh): mô tả hình ảnh tĩnh BÁM SÁT NHẤT dialogue của scene này.
  + Đọc kỹ dialogue trước, rồi chuyển thành hình: bối cảnh / không gian, sự vật / hiện tượng, hành động, nhân vật (hoặc người/vai trò) — chỉ những gì thoại nhắc hoặc rõ ràng hàm ý
  + Ưu tiên chi tiết cụ thể trong lời thoại (ai, làm gì, ở đâu, với vật gì, chuyện gì đang xảy ra) thay vì icon chung chung
  + Mỗi scene chủ thể/bố cục khác nhau theo đúng đoạn thoại đó
  + Không bịa thêm nhân vật/cảnh/vật ngoài thoại
  + Không chữ, số, logo, caption
  + Không bàn tay / bút / đang vẽ
  + Đủ chi tiết cụ thể để generate ảnh sau`;

  if (showDrawingHand) {
    return {
      visualBlock,
      motionBlock: `- motionPrompt (tiếng Anh): chuyển động video ~${SCENE_DURATION_SEC}s — bàn tay cầm marker vẽ dần đúng illustration đã mô tả trong visualPrompt (khớp dialogue).
  + Bắt đầu từ nền trống nội dung, rồi vẽ dần
  + Khớp đúng nội dung dialogue của scene`,
    };
  }

  return {
    visualBlock,
    motionBlock: `- motionPrompt (tiếng Anh): chuyển động video ~${SCENE_DURATION_SEC}s — reveal đúng illustration đã mô tả trong visualPrompt (khớp dialogue).
  + Không bàn tay / bút vẽ
  + Khớp đúng nội dung dialogue của scene`,
  };
}

/** Phân tích: dialogue + visual + motion (+ thời gian nếu nguồn có timestamp). */
export function buildAudioImageAnalyzePrompt(
  form: SourceToVideoFormLike,
  sourceText: string
): string {
  const language = form.language || "Vietnamese";
  const source =
    form.sourceTab === "audio" ? "AUDIO" : form.sourceTab === "image" ? "ẢNH" : "VĂN BẢN";
  const trimmed = sourceText.trim();
  const looksTimed =
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    /"startTime"\s*:/.test(trimmed) ||
    /"endTime"\s*:/.test(trimmed);
  const textBlock = trimmed
    ? looksTimed
      ? `\nNỘI DUNG NGUỒN (các đoạn đã có thời gian — dùng đúng startTime/endTime, không bịa lại):\n${trimmed}`
      : `\nNỘI DUNG NGUỒN:\n${trimmed}`
    : "";
  const { visualBlock, motionBlock } = buildVisualMotionBlocks(form);
  const showDrawingHand = form.showDrawingHand !== false;

  const timingRules = looksTimed
    ? `
THỜI GIAN (BẮT BUỘC — nguồn đã có startTime/endTime từ audio):
- Mỗi scene lấy dialogue từ một hoặc vài segment liên tiếp trong nguồn timed.
- startTime / endTime của scene = giây bắt đầu / kết thúc thật của đoạn thoại đó trên audio (số thập phân OK).
- Không để scene chồng thời gian; nối tiếp theo thứ tự audio.
- Độ dài scene (endTime - startTime) nên khoảng ${SCENE_DURATION_SEC}s khi tách, nhưng ƯU TIÊN đúng timestamp nguồn hơn là ép đúng ${SCENE_DURATION_SEC}s.`
    : `
THỜI GIAN (BẮT BUỘC — nguồn Image/Text hoặc text chưa có timestamp):
- AI PHẢI ước lượng startTime / endTime hợp lý cho mỗi scene dựa trên độ dài dialogue (nhịp đọc/nói tự nhiên).
- Scene đầu: startTime ≈ 0; các scene sau nối tiếp (startTime = endTime scene trước).
- Mỗi scene khoảng ${SCENE_DURATION_SEC}s (± vài giây nếu thoại ngắn/dài hơn); thoại ngắn có thể < ${SCENE_DURATION_SEC}s, thoại dài có thể > ${SCENE_DURATION_SEC}s nhưng đừng gộp nhiều ý.
- endTime luôn > startTime; không chồng thời gian giữa các scene.`;

  return `Phân tích nội dung nguồn ${source} và tách thành các phân cảnh video.

MỤC TIÊU:
- Mỗi scene ≈ ${SCENE_DURATION_SEC} giây video (đọc thoại tự nhiên), trừ khi nguồn đã có timestamp chi tiết.
- Tách theo nhịp ý nghĩa / ngữ cảnh lời thoại đến hết nguồn.
- Không gộp nhiều ý khác nhau vào 1 scene nếu vượt ~${SCENE_DURATION_SEC}s (trừ khi timestamp nguồn bắt buộc).
- Không bịa thêm ngoài NỘI DUNG NGUỒN.
- visualPrompt phải suy ra từ dialogue: bối cảnh, sự vật/hiện tượng, hành động, nhân vật — sát lời thoại nhất có thể.
- Không gắn / không nhắc art style, brand look, palette cố định, template layout (lightbulb, X/tick…).
${timingRules}

THÔNG TIN:
- Ngôn ngữ lời thoại: ${language}
- Nhịp cắt scene: ${rhythmLabel(form.rhythm || "")} — ${rhythmRule(
    form.rhythm || "",
    form.imageCount || 0
  )}
- Tỉ lệ khung hình: ${form.aspectRatio || "9:16"}
- Bàn tay trong motion: ${showDrawingHand ? "có (chỉ motionPrompt)" : "không"}
${textBlock}

CHO MỖI SCENE trả về:
- sceneNumber: số thứ tự từ 1
- dialogue: lời thoại/narration bằng ${language}, đúng đoạn của scene
- startTime: giây bắt đầu (number) — bắt buộc
- endTime: giây kết thúc (number, > startTime) — bắt buộc
${visualBlock}
${motionBlock}

OUTPUT: chỉ JSON { "scenes": [...] }, không markdown, không giải thích.`;
}
