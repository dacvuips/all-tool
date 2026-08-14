import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;

/**
 * Admin Settings → nhóm "MicroX Voice"
 * Key dùng cho tab Speech | Voice (proxy backend).
 */
export default {
  slug: "MicroX Voice",
  name: t("MicroX Voice"),
  desc: t("Cấu hình API MicroX cho tab Voice (TTS, clone, conversion, STT)"),
  settings: [
    {
      key: "microx-voice-base-url",
      name: t("MicroX Base URL"),
      type: Type.string,
      isPrivate: true,
      desc: t("Ví dụ https://www.microx.app/api/v1"),
      value: "https://www.microx.app/api/v1",
    },
    {
      key: "microx-voice-api-key",
      name: t("MicroX API Key"),
      type: Type.string,
      isPrivate: true,
      isSecret: true,
      desc: t("Bearer API key (mx_live_...) — chỉ lưu trên server, không lộ ra client"),
      value: "",
    },
  ],
} as SettingResource.ConfigSchema;
