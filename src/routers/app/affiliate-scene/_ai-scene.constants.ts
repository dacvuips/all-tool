/** Setting key trong admin — xem `graphql/modules/setting/configs/ai-scene.ts`. */
export const AI_SCENE_SETTING_KEY = "ai-scene-more";

export const DEFAULT_CHATGPT_GATEWAY_BASE_URL = "https://api.agent-gateway.site/v1";

/** Model Gemini mặc định (fallback khi setting chưa cấu hình). */
export const DEFAULT_GEMINI_MODELS = {
  SCENE: "gemini-3.5-flash",
  TRENDING: "gemini-3-flash-preview",
  STORYBOARD: "gemini-3.5-flash",
  REVIEW_SCENE: "gemini-2.5-flash",
  COPY_VIDEO: "gemini-3.5-flash",
  STYLE_TEXT: "gemini-3-flash-preview",
  SUGGEST_CONFIG: "gemini-3-flash-preview",
  CHAT_BOT: "gemini-3.5-flash",
  INSERT_SCENE: "gemini-3-flash-preview",
  AUDIO_TTS: "gemini-3.1-flash-tts-preview",
} as const;

/** Model ChatGPT mặc định (fallback khi setting chưa cấu hình). */
export const DEFAULT_CHATGPT_MODELS = {
  SCENE: "gpt-5.5",
  TRENDING: "gpt-5.5",
  REVIEW_SCENE: "gpt-5.5-high",
  COPY_VIDEO: "gpt-5.5-high",
  STYLE_TEXT: "gpt-5.5",
  SUGGEST_CONFIG: "gpt-4o-mini",
  STORYBOARD: "gpt-5.5-high",
} as const;

export type AiSceneGeminiModelKey = keyof typeof DEFAULT_GEMINI_MODELS;
export type AiSceneChatGPTModelKey = keyof typeof DEFAULT_CHATGPT_MODELS;

export type AiSceneGeminiModelsConfig = Partial<Record<AiSceneGeminiModelKey, string>>;
export type AiSceneChatGPTModelsConfig = Partial<Record<AiSceneChatGPTModelKey, string>>;

export interface AiSceneMoreSetting {
  geminiActive?: boolean;
  chatgptActive?: boolean;
  chatgptEndpoint?: string;
  geminiModels?: AiSceneGeminiModelsConfig;
  chatgptModels?: AiSceneChatGPTModelsConfig;
}

/** Giá trị mặc định seed setting `ai-scene-more` — đồng bộ với `ai-scene.ts`. */
export const DEFAULT_AI_SCENE_MORE_SETTING: AiSceneMoreSetting = {
  geminiActive: false,
  chatgptActive: true,
  chatgptEndpoint: DEFAULT_CHATGPT_GATEWAY_BASE_URL,
  geminiModels: { ...DEFAULT_GEMINI_MODELS },
  chatgptModels: { ...DEFAULT_CHATGPT_MODELS },
};
