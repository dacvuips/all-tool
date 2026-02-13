import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "general",
  name: t("Cấu hình chung"),
  settings: [
    {
      key: "ge-title",
      name: t("Tiêu đề ứng dụng"),
      type: Type.string,
      value: "",
      isPrivate: false,
    },
    { key: "ge-logo", name: t("Logo ứng dụng"), type: Type.image, value: "", isPrivate: false },
    { key: "ge-desc", name: t("Mô tả ứng dụng"), type: Type.string, value: "", isPrivate: false },
    { key: "ge-cover", name: t("Hình ảnh cover"), type: Type.string, value: "", isPrivate: false },
    { key: "ge-hotline", name: t("Số Hotline"), type: Type.string, value: "", isPrivate: false },
  ],
} as SettingResource.ConfigSchema;
