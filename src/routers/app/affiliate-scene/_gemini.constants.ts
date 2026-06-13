import { Type } from "@google/genai";

export const REDIS_KEY_GEMINI_DAILY_QUOTA_EXHAUSTED = "gemini:daily_quota_exhausted";

export const GEMINI_MAX_KEY_RETRIES = 30;
export const GEMINI_RETRY_DELAY_MS_MIN = 2000;
export const GEMINI_RETRY_DELAY_MS_MAX = 3000;

/** Model mặc định theo từng route affiliate-scene. */
export const GEMINI_MODELS = {
  SCENE: "gemini-3.5-flash",
  TRENDING: "gemini-3-flash-preview",
  STORYBOARD: "gemini-3.5-flash",
  REVIEW_SCENE: "gemini-2.5-flash",
  COPY_VIDEO: "gemini-2.5-flash",
  STYLE_TEXT: "gemini-3-flash-preview",
  SUGGEST_CONFIG: "gemini-3-flash-preview",
  CHAT_BOT: "gemini-3.5-flash",
  INSERT_SCENE: "gemini-3-flash-preview",
  AUDIO_TTS: "gemini-3.1-flash-tts-preview",
} as const;

/** JSON Schema response cho Gemini generateContent. */
export const AffiliateVideoResponseSchema = {
  type: Type.OBJECT,
  properties: {
    topicTitle: { type: Type.STRING },
    artStyle: { type: Type.STRING },
    environment: { type: Type.STRING },
    cast: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
        },
        required: ["tag"],
      },
    },
    characterName: { type: Type.STRING },
    characterBaseDescription: { type: Type.STRING },
    voiceGender: { type: Type.STRING },
    voiceTone: { type: Type.STRING },
    voiceStyle: { type: Type.STRING },
    audioPrompt: { type: Type.STRING },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.INTEGER },
          camera: { type: Type.STRING },
          motionPrompt: { type: Type.STRING },
          audio: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          visualEffects: { type: Type.STRING },
        },
        required: ["sceneNumber", "motionPrompt", "dialogue", "visualEffects"],
      },
    },
  },
  required: ["topicTitle", "characterBaseDescription", "scenes"],
};
