import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "advanced",
  name: t("Nâng cao"),
  settings: [
    {
      key: "ad-script",
      name: t("Javascript Tuỳ chỉnh"),
      type: Type.richText,
      isPrivate: true,
      value: "",
    },
    { key: "ad-css", name: t("CSS Tuỳ Chỉnh"), type: Type.richText, isPrivate: true, value: "" },
    {
      key: "ad-color-primary",
      name: t("Theme Màu Primary"),
      type: Type.string,
      isPrivate: true,
      value: "#0D57EF",
    },
    {
      key: "ad-color-accent",
      name: t("Theme Màu Accent"),
      type: Type.string,
      isPrivate: true,
      value: "38D0FF",
    },
  ],
} as SettingResource.ConfigSchema;
