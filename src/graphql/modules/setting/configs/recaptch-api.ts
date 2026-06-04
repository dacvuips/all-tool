import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "recaptcha-api",
  name: t("Cấu hình API recaptcha"),
  settings: [
    // Free
    {
      key: `recaptcha-api-secret-key`,
      name: t("Secret key"),
      type: Type.json,
      isPrivate: false,
      isSecret: true,
      isActive: true,
      value: {
        link: [
          {
            url: "https://viettheo.site",
            apiKey: "",
          },
        ],
      },
    },
  ],
} as SettingResource.ConfigSchema;
