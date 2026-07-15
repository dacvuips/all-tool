import {
  AI_SCENE_SETTING_KEY,
  DEFAULT_CHATGPT_GATEWAY_BASE_URL,
  DEFAULT_CHATGPT_MODELS,
  type AiSceneMoreSetting,
} from "./_ai-scene.constants";

export { AI_SCENE_SETTING_KEY, DEFAULT_CHATGPT_GATEWAY_BASE_URL, DEFAULT_CHATGPT_MODELS, type AiSceneMoreSetting };
export { DEFAULT_CHATGPT_MODELS as CHATGPT_MODELS } from "./_ai-scene.constants";

/** Model ChatGPT Flow2 mặc định khi route không truyền `model`. */
export const DEFAULT_CHATGPT_MODEL = DEFAULT_CHATGPT_MODELS.SCENE;

export const CHATGPT_GATEWAY_SYSTEM_MESSAGE = [
  "CRITICAL OUTPUT RULES:",
  "1. Your entire reply MUST be a single valid JSON object or array.",
  "2. Do NOT write any prose, greeting, apology, markdown, code fences, or commentary before/after the JSON.",
  "3. Do NOT wrap JSON in ```json or ```.",
  "4. First character must be { or [, last character must be } or ].",
].join("\n");

export const CHATGPT_JSON_SCHEMA_NAME = "affiliate_video_response";

/** Storyboard có nhiều panel + mô tả dài — giữ để tương thích caller (Flow2 v1 không nhận max_tokens). */
export const CHATGPT_STORYBOARD_MAX_OUTPUT_TOKENS = 16384;

export type ChatGPTGatewayImage = {
  imageBytes: string;
  mimeType: string;
  /** Tên file gửi Flow2 (`file_name`) — ví dụ `photo.jpg`. */
  fileName?: string;
};
export type ChatGPTGatewayVideo = { imageBytes: string; mimeType: string };

/** JSON Schema gợi ý trong prompt Flow2 ChatGPT (`/api/v1/chatgpt/chat`). */
export const AffiliateVideoOpenAIJsonSchema = {
  type: "object",
  properties: {
    topicTitle: { type: "string" },
    artStyle: { type: "string" },
    environment: { type: "string" },
    characterName: { type: "string" },
    characterBaseDescription: { type: "string" },
    voiceGender: { type: "string" },
    voiceTone: { type: "string" },
    voiceStyle: { type: "string" },
    audioPrompt: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          camera: { type: "string" },
          motionPrompt: { type: "string" },
          audio: { type: "string" },
          dialogue: { type: "string" },
          visualEffects: { type: "string" },
        },
        required: ["sceneNumber", "motionPrompt", "dialogue", "visualEffects"],
      },
    },
  },
  required: ["topicTitle", "characterBaseDescription", "scenes"],
};

export const ReviewOpenAIJsonSchema = {
  type: "object",
  properties: {
    artStyle: { type: "string" },
    environment: { type: "string" },
    voiceGender: { type: "string" },
    voiceTone: { type: "string" },
    voiceStyle: { type: "string" },
    audioPrompt: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicTitle: { type: "string" },
          sceneNumber: { type: "integer" },
          camera: { type: "string" },
          motionPrompt: { type: "string" },
          audio: { type: "string" },
          dialogue: { type: "string" },
          visualEffects: { type: "string" },
          visualPrompt: { type: "string" },
        },
        required: [
          "sceneNumber",
          "motionPrompt",
          "dialogue",
          "visualEffects",
          "topicTitle",
          "visualPrompt",
        ],
      },
    },
  },
  required: ["scenes"],
};

export const CopyVideoAnalysisOpenAIJsonSchema = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    props: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          scene_type: { type: "string", enum: ["CHARACTER", "OBJECT"] },
          visual_prompt: { type: "string" },
          motion_description: { type: "string" },
          audio_description: { type: "string" },
          original_content: { type: "string" },
          translated_content: { type: ["string", "null"] },
        },
        required: [
          "timestamp",
          "scene_type",
          "visual_prompt",
          "motion_description",
          "audio_description",
          "original_content",
        ],
      },
    },
  },
  required: ["characters", "props", "scenes"],
};

export const GenerationStyleTextOpenAIJsonSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
};

export const SuggestConfigOpenAIJsonSchema = {
  type: "object",
  properties: {
    objectToPersonify: { type: "string" },
    tipContent: { type: "string" },
  },
  required: ["objectToPersonify", "tipContent"],
};

export const StoryboardAnalysisOpenAIJsonSchema = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          cropRegion: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["x", "y", "width", "height"],
          },
          camera: { type: "string" },
          dialogue: { type: "string" },
          motionPrompt: { type: "string" },
          audio: { type: "string" },
          visualDescription: { type: "string" },
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
    topicTitle: { type: "string" },
    voiceGender: { type: "string", enum: ["male", "female"] },
    voiceTone: { type: "string" },
    voiceStyle: { type: "string" },
    voicePacing: { type: "string" },
    audioPrompt: { type: "string" },
  },
  required: ["scenes", "topicTitle", "voiceGender", "voiceTone", "voiceStyle", "voicePacing"],
};
