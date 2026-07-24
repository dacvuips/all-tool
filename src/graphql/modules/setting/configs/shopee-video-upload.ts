import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";

const Type = SettingResource.Type;

/**
 * Admin Settings → nhóm "Shopee Video Upload"
 * Seeding tự tạo khi chạy setting seed.
 */
export default {
  slug: "Shopee Video Upload",
  name: t("Shopee Video Upload"),
  desc: t("Cấu hình Credit / Signer để đăng video Shopee (token CDN, ký request)"),
  settings: [
    {
      key: "shopee-signer-base-url",
      name: t("Signer Base URL (sign)"),
      type: Type.string,
      isPrivate: true,
      desc: t(
        "URL máy sign — ví dụ http://178.105.110.35:47832/sign hoặc .../api/sign"
      ),
      value: "http://178.105.110.35:47832/sign",
    },
    {
      key: "shopee-signer-me-base-url",
      name: t("Credit Me URL (check số dư) — tùy chọn"),
      type: Type.string,
      isPrivate: true,
      desc: t(
        "Để trống = gọi /api/me trên cùng host Signer Base URL (MLS). Chỉ điền nếu /api/me ở host khác (vd https://credit.toolshopee.vn) và API key đúng host đó."
      ),
      value: "",
    },
    {
      key: "shopee-signer-api-key",
      name: t("Signer API Key"),
      type: Type.string,
      isPrivate: true,
      isSecret: true,
      desc: t("API key (X-API-Key) — dùng cho sign và check số dư"),
      value: "",
    },
  ],
} as SettingResource.ConfigSchema;
