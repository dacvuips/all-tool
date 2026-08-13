import { t } from "../../../../helpers/functions/string";
import { SettingResource } from "../../../../libs/shared/interfaces/settingResource";
import {
  TERMS_OF_SERVICE_SAMPLE_HTML,
  TERMS_OF_SERVICE_SETTING_KEY,
} from "../samples/terms-of-service.sample";

const Type = SettingResource.Type;

/** Admin Settings → nhóm "Cấu hình sàn", ngay dưới pa-b-page */
export default {
  slug: "page",
  name: t("Cấu hình sàn"),
  settings: [
    {
      key: TERMS_OF_SERVICE_SETTING_KEY,
      name: t("Điều khoản sử dụng dịch vụ"),
      desc: t("Nội dung điều khoản, chính sách hiển thị cho khách hàng"),
      type: Type.html,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      sort: 1,
      value: TERMS_OF_SERVICE_SAMPLE_HTML,
    },
  ],
} as SettingResource.ConfigSchema;
