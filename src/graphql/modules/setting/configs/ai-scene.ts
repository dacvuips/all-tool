import { t } from "../../../../helpers/functions/string";
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
      desc: t("Cấu hình chọn AI nào được call ở trên tool (chỉ 1 AI được phép 'true')"),
      value: {
        geminiActive: false,
        chatgptActive: true,
        chatgptEndpoint: "https://api.agent-gateway.site/v1",
      },
    },
  ],
} as SettingResource.ConfigSchema;
