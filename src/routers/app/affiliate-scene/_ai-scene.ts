import { SettingHelper } from "../../../packages/setting-helper";
import {
  AI_SCENE_SETTING_KEY,
  AiSceneChatGPTModelKey,
  AiSceneGeminiModelKey,
  AiSceneMoreSetting,
  DEFAULT_CHATGPT_MODELS,
  DEFAULT_GEMINI_MODELS,
} from "./_ai-scene.constants";

export type AiSceneProvider = "gemini" | "chatgpt";

export type {
  AiSceneChatGPTModelKey,
  AiSceneChatGPTModelsConfig,
  AiSceneGeminiModelKey,
  AiSceneGeminiModelsConfig,
  AiSceneMoreSetting,
} from "./_ai-scene.constants";

function parseAiSceneMoreSetting(raw: unknown): AiSceneMoreSetting | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AiSceneMoreSetting;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === "object") return raw as AiSceneMoreSetting;
  return undefined;
}

/** Đọc setting `ai-scene-more` từ admin. */
export async function getAiSceneMoreSetting(): Promise<AiSceneMoreSetting | undefined> {
  try {
    const raw = await SettingHelper.load(AI_SCENE_SETTING_KEY, { secure: false });
    return parseAiSceneMoreSetting(raw);
  } catch {
    return undefined;
  }
}

/** Lấy tên model Gemini theo route key từ setting (fallback DEFAULT_GEMINI_MODELS). */
export async function getGeminiSceneModel(key: AiSceneGeminiModelKey): Promise<string> {
  const setting = await getAiSceneMoreSetting();
  const fromSetting = setting?.geminiModels?.[key]?.trim();
  return fromSetting || DEFAULT_GEMINI_MODELS[key];
}

/** Lấy tên model ChatGPT theo route key từ setting (fallback DEFAULT_CHATGPT_MODELS). */
export async function getChatGPTSceneModel(key: AiSceneChatGPTModelKey): Promise<string> {
  const setting = await getAiSceneMoreSetting();
  const fromSetting = setting?.chatgptModels?.[key]?.trim();
  return fromSetting || DEFAULT_CHATGPT_MODELS[key];
}

/** Xác định provider AI scene theo geminiActive / chatgptActive trong setting. */
export async function resolveAiSceneProvider(): Promise<AiSceneProvider> {
  const setting = await getAiSceneMoreSetting();
  const geminiActive = setting?.geminiActive === true;
  const chatgptActive = setting?.chatgptActive === true;

  if (geminiActive && chatgptActive) {
    const err: any = new Error("Cấu hình AI Scene không hợp lệ: chỉ được bật Gemini hoặc ChatGPT");
    err.statusCode = 500;
    throw err;
  }
  if (geminiActive) return "gemini";
  if (chatgptActive) return "chatgpt";

  const err: any = new Error(
    "Chưa cấu hình AI Scene: bật geminiActive hoặc chatgptActive trong setting"
  );
  err.statusCode = 500;
  throw err;
}
