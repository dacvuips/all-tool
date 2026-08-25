import type { AudioImageToVideoFormState } from "./audio-image-types";
import { AUDIO_IMAGE_RHYTHM_OPTIONS } from "./audio-image-types";
import type { AudioChunk } from "./split-audio-chunks";

const SCENE_DURATION_SEC = 8;

function rhythmLabel(value: string) {
  return AUDIO_IMAGE_RHYTHM_OPTIONS.find((item) => item.value === value)?.label || value;
}

function rhythmRule(value: string, imageCount: number): string {
  switch (value) {
    case "exact_images":
      return `Số scene bám số ảnh đã gửi (${imageCount || "N"}). Vẫn chia thoại theo đoạn ~${SCENE_DURATION_SEC}s nếu thoại dài hơn.`;
    case "single_image":
      return `Một visual xuyên suốt. Vẫn tách nhiều scene theo thoại, mỗi scene ~${SCENE_DURATION_SEC}s, visualPrompt nhất quán.`;
    case "full_analysis":
      return `Phân tích đầy đủ: mỗi nhịp ý nghĩa trong thoại = 1 scene / 1 slide bút vẽ. Mỗi scene ~${SCENE_DURATION_SEC}s video.`;
    case "balanced":
      return `Cân bằng: visual đổi chậm (khoảng 1-3 phút nội dung/ảnh), nhưng vẫn cắt scene video ~${SCENE_DURATION_SEC}s.`;
    case "chapter":
      return `Theo chương: visual đổi chậm hơn (khoảng 3-8 phút nội dung/ảnh), vẫn cắt scene video ~${SCENE_DURATION_SEC}s.`;
    default:
      return `Auto theo nội dung: chia scene theo ngữ cảnh thoại tự nhiên, mỗi scene hợp với video ~${SCENE_DURATION_SEC}s.`;
  }
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildAudioImageAnalyzePrompt(
  form: AudioImageToVideoFormState,
  chunk?: Pick<AudioChunk, "chunkIndex" | "chunkCount" | "startSec" | "endSec">
): string {
  const language = form.language || "Vietnamese";
  const artStyle = form.artStyle?.trim() || "(không chỉ định)";
  const source =
    form.sourceTab === "audio" ? "AUDIO" : form.sourceTab === "image" ? "ẢNH" : "VĂN BẢN";
  const textBlock =
    form.sourceTab === "text" && form.textContent?.trim()
      ? `\nNỘI DUNG VĂN BẢN:\n${form.textContent.trim()}`
      : "";

  const chunkBlock =
    chunk && chunk.chunkCount > 1
      ? `\nĐOẠN AUDIO HIỆN TẠI:
- Đây là đoạn ${chunk.chunkIndex + 1}/${chunk.chunkCount} của audio gốc (khoảng ${formatClock(
          chunk.startSec
        )} → ${formatClock(chunk.endSec)}).
- Chỉ phân tích lời thoại trong đoạn audio này.
- sceneNumber trong JSON bắt đầu từ 1 cho đoạn này (hệ thống sẽ đánh số lại toàn cục).`
      : "";

  return `Bạn là đạo diễn kịch bản AI Video dạng WHITEBOARD ANIMATION / SLIDE BÚT VẼ (hand-drawing presentation). Phân tích nguồn ${source} và tách thành các phân cảnh.

MỤC TIÊU:
- Mỗi scene tương ứng khoảng ${SCENE_DURATION_SEC} giây video.
- Số lượng scene bám sát từng ngữ cảnh / nhịp ý nghĩa trong lời thoại.
- Tiếp tục tách scene cho đến khi hết nội dung đoạn nguồn đã gửi.
- Không gộp nhiều ý thoại khác nhau vào một scene nếu vượt ~${SCENE_DURATION_SEC}s khi đọc tự nhiên.
- Không bịa thêm cốt truyện ngoài nguồn đã cho.
- Toàn bộ visual theo phong cách WHITEBOARD DRAWING SLIDESHOW: nền trắng như bảng, minh họa 2D flat được một bàn tay cầm bút marker vẽ trực tiếp lên bảng (như ảnh whiteboard animation / doodle video).
${chunkBlock}

THÔNG TIN:
- Ngôn ngữ lời thoại: ${language}
- Nhịp ảnh: ${rhythmLabel(form.rhythm)} — ${rhythmRule(form.rhythm, form.imageRefs?.length || 0)}
- Tỉ lệ khung hình: ${form.aspectRatio || "9:16"}
- Phong cách hình ảnh: ${artStyle}
- BẮT BUỘC phản ánh đúng phong cách hình ảnh ở trên trong mọi visualPrompt và motionPrompt (kết hợp với whiteboard drawing).
${textBlock}

CHO MỖI SCENE, trả về:
- sceneNumber: số thứ tự bắt đầu từ 1
- dialogue: lời thoại/narration bằng ${language}, đúng đoạn nội dung của scene đó
- visualPrompt: mô tả hình ảnh tĩnh bằng tiếng Anh theo dạng WHITEBOARD SLIDE BÚT VẼ. Yêu cầu:
  + Plain white whiteboard / paper background
  + Clean flat 2D vector cartoon illustration matching the dialogue meaning
  + Composition like a presentation slide: main idea centered, easy to understand while listening to podcast narration
  + Include a realistic human hand holding a grey marker near the drawing (as if currently drawing the slide)
  + Minimal clutter, modern explainer / doodle-video look — NOT cinematic live-action
  + Enough detail to generate a still image
- motionPrompt: mô tả chuyển động WHITEBOARD ANIMATION bằng tiếng Anh. Yêu cầu:
  + The hand with marker progressively draws/reveals the illustration on the whiteboard
  + Smooth drawing strokes, elements appear as they are drawn
  + Soft camera hold or very subtle Ken Burns only; no cinematic action
  + Suitable for an ${SCENE_DURATION_SEC}s video clip

OUTPUT: chỉ JSON object { "scenes": [...] }, không markdown, không giải thích.`;
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
