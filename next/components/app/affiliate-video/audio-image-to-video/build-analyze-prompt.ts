import type { AudioImageToVideoFormState } from "./audio-image-types";
import { AUDIO_IMAGE_RHYTHM_OPTIONS } from "./audio-image-types";

const SCENE_DURATION_SEC = 8;

function rhythmLabel(value: string) {
  return AUDIO_IMAGE_RHYTHM_OPTIONS.find((item) => item.value === value)?.label || value;
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

export function buildAudioImageAnalyzeSystemInstruction(form: AudioImageToVideoFormState): string {
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

function buildVisualMotionBlocks(form: AudioImageToVideoFormState): {
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

/** Prompt phân tích: dialogue + visual + motion (+ thời gian nếu nguồn có timestamp). */
export function buildAudioImageAnalyzePrompt(
  form: AudioImageToVideoFormState,
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
- Nhịp cắt scene: ${rhythmLabel(form.rhythm)} — ${rhythmRule(
    form.rhythm,
    form.imageRefs?.length || 0
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

export function validateAudioImageAnalyzeForm(form: AudioImageToVideoFormState): string | null {
  if (form.sourceTab === "text" && !form.textContent?.trim()) {
    return "Vui lòng nhập nội dung văn bản";
  }
  if (form.sourceTab === "image" && !form.imageRefs?.some((img) => img.imageBytes || img.fifeUrl)) {
    return "Vui lòng upload ít nhất 1 ảnh";
  }
  if (form.sourceTab === "audio" && !form.audioRefs?.some((aud) => aud.audioBytes || aud.fifeUrl)) {
    return "Vui lòng upload file audio";
  }
  return null;
}
