/** Setting key trong admin — xem `graphql/modules/setting/configs/ai-scene.ts`. */
export const AI_SCENE_SETTING_KEY = "ai-scene-more";

export const DEFAULT_CHATGPT_GATEWAY_BASE_URL = "https://api.vietapi.tech/v1";

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

/** Model Claude qua VietAPI (fallback khi setting chưa cấu hình). */
export const DEFAULT_CHATGPT_MODELS = {
  SCENE: "claude-opus-4-6",
  TRENDING: "claude-opus-4-6",
  REVIEW_SCENE: "claude-opus-4-6",
  COPY_VIDEO: "claude-opus-4-6",
  STYLE_TEXT: "claude-opus-4-6",
  SUGGEST_CONFIG: "claude-opus-4-6",
  STORYBOARD: "claude-opus-4-6",
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
