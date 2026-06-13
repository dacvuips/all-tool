/** Setting key trong admin — xem `graphql/modules/setting/configs/ai-scene.ts`. */
export const AI_SCENE_SETTING_KEY = "ai-scene-more";

export const DEFAULT_CHATGPT_GATEWAY_BASE_URL = "https://api.agent-gateway.site/v1";

export interface AiSceneMoreSetting {
  geminiActive?: boolean;
  chatgptActive?: boolean;
  chatgptEndpoint?: string;
}

/** Model AI OpenAI mặc định khi route không truyền `model`. */
export const DEFAULT_CHATGPT_MODEL = "gpt-4o";

/** Model AI OpenAI theo từng route — chỉnh trực tiếp tại đây (ví dụ `"gpt-4o"`, `"gpt-4o-mini"`). */
export const CHATGPT_MODELS = {
  SCENE: "gpt-4o",
  TRENDING: "gpt-4o",
  REVIEW_SCENE: "gpt-4o",
  COPY_VIDEO: "gpt-4o",
  STYLE_TEXT: "gpt-4o",
  SUGGEST_CONFIG: "gpt-4o-mini",
  STORYBOARD: "gpt-4o",
} as const;

export const CHATGPT_GATEWAY_SYSTEM_MESSAGE =
  "You must respond with valid JSON only. No markdown, no explanation.";

export const CHATGPT_JSON_SCHEMA_NAME = "affiliate_video_response";

export type ChatGPTGatewayImage = { imageBytes: string; mimeType: string };
export type ChatGPTGatewayVideo = { imageBytes: string; mimeType: string };

/** JSON Schema chuẩn OpenAI cho ChatGPT gateway. */
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
        required: ["sceneNumber", "motionPrompt", "dialogue", "visualEffects", "topicTitle", "visualPrompt"],
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
    topicTitle: { type: "string" },
    voiceGender: { type: "string", enum: ["male", "female"] },
    voiceTone: { type: "string" },
    voiceStyle: { type: "string" },
    voicePacing: { type: "string" },
    audioPrompt: { type: "string" },
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
        required: ["sceneNumber", "cropRegion", "dialogue", "motionPrompt", "audio", "visualDescription"],
      },
    },
  },
  required: ["topicTitle", "voiceGender", "voiceTone", "voiceStyle", "voicePacing", "audioPrompt", "scenes"],
};
