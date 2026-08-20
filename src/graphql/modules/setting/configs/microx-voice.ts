import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;

/**
 * Admin Settings → nhóm "Viettheo Voice"
 * Key dùng cho tab Speech | Voice (proxy backend).
 */
export default {
  slug: "VietTheo Voice",
  name: t("VietTheo Voice"),
  desc: t("Cấu hình API VietTheo cho tab Voice (TTS, clone, conversion, STT)"),
  settings: [
    {
      key: "microx-voice-base-url",
      name: t("VietTheo Base URL"),
      type: Type.string,
      isPrivate: true,
      desc: t("Ví dụ https://www.microx.app/api/v1"),
      value: "https://www.microx.app/api/v1",
    },
    {
      key: "microx-voice-api-key",
      name: t("VietTheo API Key"),
      type: Type.string,
      isPrivate: true,
      isSecret: true,
      desc: t("Bearer API key (mx_live_...) — chỉ lưu trên server, không lộ ra client"),
      value: "",
    },
  ],
} as SettingResource.ConfigSchema;
