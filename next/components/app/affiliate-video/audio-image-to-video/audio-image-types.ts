import type { AspectRatio, ElementFormAudio, ElementFormImage } from "../constants";

export type SourceTab = "audio" | "image" | "text";

export type AudioImageToVideoFormState = {
  sourceTab: SourceTab;
  aspectRatio: AspectRatio;
  language: string;
  artStyle: string;
  artStyleId: string;
  rhythm: string;
  /** Bật: có bàn tay đang vẽ trên bảng. Tắt: slide 2D tĩnh, không bàn tay / không hành động viết. */
  showDrawingHand: boolean;
  /** Ảnh nền video (component). Upload tùy chọn — trống thì dùng bg-audio.jpg. */
  startFrameImages?: ElementFormImage[];
  textContent: string;
  imageRefs?: ElementFormImage[];
  audioRefs?: ElementFormAudio[];
};

/** Một đoạn transcript có thời gian (Lấy text từ audio). */
export type TimedTranscriptSegment = {
  text: string;
  startTime: number;
  endTime: number;
};

export type AudioImageScene = {
  sceneNumber: number;
  dialogue: string;
  visualPrompt: string;
  motionPrompt: string;
  /** Giây bắt đầu đoạn thoại trên nguồn */
  startTime?: number;
  /** Giây kết thúc đoạn thoại trên nguồn */
  endTime?: number;
};

export const AUDIO_IMAGE_RHYTHM_OPTIONS = [
  { value: "auto_content", label: "Auto theo nội dung" },
  { value: "exact_images", label: "Dùng số ảnh chỉ định" },
  { value: "single_image", label: "Một ảnh xuyên suốt" },
  { value: "full_analysis", label: "Phân tích đầy đủ — mỗi nhịp ý nghĩa/ảnh" },
  { value: "balanced", label: "Cân bằng — khoảng 1-3 phút/ảnh" },
  { value: "chapter", label: "Theo chương — khoảng 3-8 phút/ảnh" },
] as const;

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
