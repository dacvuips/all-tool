import { t } from "../../../../helpers/functions/string";
import { DEFAULT_AI_SCENE_MORE_SETTING } from "../../../../routers/app/affiliate-scene/_ai-scene.constants";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "AI Scene ",
  name: t("Cấu hình AI Scene Gemini và ChatGPT Gateway"),
  settings: [
    {
      key: "ai-scene-more",
      name: t("Model AI Scene More"),
      type: Type.json,
      isPrivate: true,
      desc: t(
        "Cấu hình provider (geminiActive/chatgptActive), endpoint Flow2 ChatGPT (/api/v1/chatgpt) và model AI theo từng route (chỉ 1 provider được phép 'true')"
      ),
      value: DEFAULT_AI_SCENE_MORE_SETTING,
    },
  ],
} as SettingResource.ConfigSchema;
