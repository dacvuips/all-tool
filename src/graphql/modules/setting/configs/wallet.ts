import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "wallet",
  name: t("Nạp mPoint tự động"),
  settings: [
    {
      key: "wa-customer-deposit",
      name: t("Cho phép khách hàng nạp mPoint"),
      type: Type.boolean,
      isPrivate: true,
      isSecret: false,
      isActive: false,
      value: false,
    },
    {
      key: "wa-mpoint-change-credit-balance",
      name: t("Số mPoint tương đương 1 điểm tín dụng"),
      type: Type.number,
      isPrivate: true,
      isSecret: false,
      isActive: false,
      value: 0,
    },
  ],
} as SettingResource.ConfigSchema;
