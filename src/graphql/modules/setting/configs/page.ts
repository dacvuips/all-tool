import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "page",
  name: t("Cấu hình sàn"),
  settings: [
    {
      key: "pa-b-page",
      name: t("Ngưng hoạt động sàn"),
      type: Type.html,
      isPrivate: false,
      isSecret: false,
      isActive: false,
      value: "Ngưng hoạt động",
    },
  ],
} as SettingResource.ConfigSchema;
