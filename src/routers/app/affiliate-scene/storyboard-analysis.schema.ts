import { Type } from "@google/genai";

/**
 * Schema chuẩn cho kết quả AI phân tích ảnh storyboard.
 * Tọa độ cropRegion dùng giá trị chuẩn hoá 0–1 (tỷ lệ so với kích thước ảnh gốc).
 * `scenes` đặt đầu schema để AI ưu tiên sinh phân cảnh trước metadata giọng đọc.
 */
export const StoryboardCropRegionSchema = {
  type: Type.OBJECT,
  properties: {
    x: {
      type: Type.NUMBER,
      description: "Cạnh trái vùng cắt, chuẩn hoá 0–1 theo chiều rộng ảnh.",
    },
    y: {
      type: Type.NUMBER,
      description: "Cạnh trên vùng cắt, chuẩn hoá 0–1 theo chiều cao ảnh.",
    },
    width: {
      type: Type.NUMBER,
      description: "Chiều rộng vùng cắt, chuẩn hoá 0–1.",
    },
    height: {
      type: Type.NUMBER,
      description: "Chiều cao vùng cắt, chuẩn hoá 0–1.",
    },
  },
  required: ["x", "y", "width", "height"],
};

const StoryboardSceneItemSchema = {
  type: Type.OBJECT,
  properties: {
    sceneNumber: {
      type: Type.INTEGER,
      description: "Số thứ tự phân cảnh, bắt đầu từ 1.",
    },
    cropRegion: {
      ...StoryboardCropRegionSchema,
      description:
        "Vùng bounding box của panel storyboard tương ứng – dùng để cắt ảnh bằng canvas.",
    },
    camera: {
      type: Type.STRING,
      description: "Góc máy gợi ý (WIDE SHOT, CLOSE-UP, MEDIUM SHOT, ...).",
    },
    dialogue: {
      type: Type.STRING,
      description: "Lời thoại / narration của phân cảnh theo ngôn ngữ yêu cầu.",
    },
    motionPrompt: {
      type: Type.STRING,
      description: "Mô tả chuyển động camera và hành động trong cảnh, bằng tiếng Anh.",
    },
    audio: {
      type: Type.STRING,
      description:
        "Metadata giọng đọc riêng cho phân cảnh (gender, tone, pacing) theo ngôn ngữ yêu cầu.",
    },
    visualDescription: {
      type: Type.STRING,
      description:
        "Mô tả khung hình tĩnh của panel bằng tiếng Anh – dùng làm image generation prompt.",
    },
  },
  required: [
    "sceneNumber",
    "cropRegion",
    "dialogue",
    "motionPrompt",
    "audio",
    "visualDescription",
  ],
};

export const StoryboardAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      description:
        "BẮT BUỘC – danh sách phân cảnh phát hiện từ storyboard, theo thứ tự đọc từ trên xuống / trái sang phải.",
      items: StoryboardSceneItemSchema,
    },
    topicTitle: {
      type: Type.STRING,
      description: "Tiêu đề / chủ đề video ngắn gọn.",
    },
    voiceGender: {
      type: Type.STRING,
      description: "male hoặc female.",
      enum: ["male", "female"],
    },
    voiceTone: {
      type: Type.STRING,
      description: "Tính cách giọng đọc, tối đa ~50 ký tự.",
    },
    voiceStyle: {
      type: Type.STRING,
      description: "Phong cách đọc, tối đa ~50 ký tự.",
    },
    voicePacing: {
      type: Type.STRING,
      description: "fast, moderate hoặc slow.",
    },
    audioPrompt: {
      type: Type.STRING,
      description: "Prompt casting giọng đọc tiếng Anh, tối đa ~80 ký tự. Có thể để rỗng.",
    },
  },
  required: ["scenes", "topicTitle", "voiceGender", "voiceTone", "voiceStyle", "voicePacing"],
};
