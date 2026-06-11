import { Type } from "@google/genai";

/**
 * Schema chuẩn cho kết quả AI phân tích ảnh storyboard.
 * Tọa độ cropRegion dùng giá trị chuẩn hoá 0–1 (tỷ lệ so với kích thước ảnh gốc).
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

export const StoryboardAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    topicTitle: {
      type: Type.STRING,
      description: "Tiêu đề / chủ đề video suy ra từ storyboard.",
    },
    voiceGender: {
      type: Type.STRING,
      description: "Giới tính giọng đọc toàn video: male hoặc female.",
      enum: ["male", "female"],
    },
    voiceTone: {
      type: Type.STRING,
      description: "Tính cách / cảm xúc giọng đọc (ví dụ: energetic, calm, friendly).",
    },
    voiceStyle: {
      type: Type.STRING,
      description: "Phong cách đọc (ví dụ: conversational, formal, storytelling).",
    },
    voicePacing: {
      type: Type.STRING,
      description: "Nhịp điệu đọc (ví dụ: fast, moderate, slow).",
    },
    audioPrompt: {
      type: Type.STRING,
      description:
        "Prompt casting giọng đọc đầy đủ bằng tiếng Anh: gender, tone, style, pacing, emotion.",
    },
    scenes: {
      type: Type.ARRAY,
      description:
        "Danh sách phân cảnh phát hiện từ storyboard, theo thứ tự đọc từ trên xuống / trái sang phải.",
      items: {
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
            description:
              "Mô tả chuyển động camera và hành động trong cảnh, bằng tiếng Anh.",
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
      },
    },
  },
  required: [
    "topicTitle",
    "voiceGender",
    "voiceTone",
    "voiceStyle",
    "voicePacing",
    "audioPrompt",
    "scenes",
  ],
};
