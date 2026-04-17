import { t } from "../../../../helpers/functions/string";
import { RecaptchaSubscriptionPlanEnum } from "../../../../libs/dal/recaptchaToken";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;
export default {
  slug: "recaptcha-package",
  name: t("Cấu hình gói recaptcha"),
  settings: [
    // Free
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.FREE}-request-quantity`,
      name: t("Free - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 1000,
    },
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.FREE}-price`,
      name: t("Free - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 0,
    },
    // Basic
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.BASIC}-request-quantity`,
      name: t("Basic - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 5000,
    },
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.BASIC}-price`,
      name: t("Basic - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 50000,
    },
    // Standard
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.STANDARD}-request-quantity`,
      name: t("Standard - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 10000,
    },
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.STANDARD}-price`,
      name: t("Standard - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 100000,
    },
    // Professional
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.PROFESSIONAL}-request-quantity`,
      name: t("Professional - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 20000,
    },
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.PROFESSIONAL}-price`,
      name: t("Professional - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 200000,
    },
    // Unlimited
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.UNLIMITED}-request-quantity`,
      name: t("Unlimited - Số lượng request"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: -1,
    },
    {
      key: `rpk-${RecaptchaSubscriptionPlanEnum.UNLIMITED}-price`,
      name: t("Unlimited - Giá (VNĐ)"),
      type: Type.number,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      value: 1000000000,
    },
  ],
} as SettingResource.ConfigSchema;
