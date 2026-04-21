import { t } from "../../../../helpers/functions/string";
import { ApiMediaSubscriptionPlanEnum } from "../../../../libs/dal/apiMediaToken";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "api-media-package",
  name: t("Cấu hình gói API Media"),
  settings: [
    // Free
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-request-quantity`,
      name: t("Free - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 1000,
    },
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-price`,
      name: t("Free - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 0,
    },
    // Basic
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.BASIC}-request-quantity`,
      name: t("Basic - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 5000,
    },
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.BASIC}-price`,
      name: t("Basic - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 50000,
    },
    // Standard
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.STANDARD}-request-quantity`,
      name: t("Standard - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 10000,
    },
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.STANDARD}-price`,
      name: t("Standard - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 100000,
    },
    // Professional
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.PROFESSIONAL}-request-quantity`,
      name: t("Professional - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 20000,
    },
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.PROFESSIONAL}-price`,
      name: t("Professional - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 200000,
    },
    // Unlimited
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.UNLIMITED}-request-quantity`,
      name: t("Unlimited - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: -1,
    },
    {
      key: `ampk-${ApiMediaSubscriptionPlanEnum.UNLIMITED}-price`,
      name: t("Unlimited - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 1000000000,
    },
  ],
} as SettingResource.ConfigSchema;
