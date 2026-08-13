import { SettingModel } from "../../../libs/dal/setting";
import { SettingGroupModel } from "../../../libs/dal/settingGroup";
import { SettingResource } from "../../../libs/shared/interfaces/settingResource";
import {
  TERMS_OF_SERVICE_SAMPLE_HTML,
  TERMS_OF_SERVICE_SETTING_KEY,
} from "./samples/terms-of-service.sample";

export default {
  name: "2026-08-13-add-pa-terms-of-service",
  handler: async () => {
    const existed = await SettingModel.findOne({ key: TERMS_OF_SERVICE_SETTING_KEY });
    if (existed) return;

    const pageGroup = await SettingGroupModel.findOne({ slug: "page" });
    if (!pageGroup) {
      throw new Error('Không tìm thấy nhóm cấu hình slug "page" (Cấu hình sàn)');
    }

    await SettingModel.create({
      key: TERMS_OF_SERVICE_SETTING_KEY,
      name: "Điều khoản sử dụng dịch vụ",
      desc: "Nội dung điều khoản, chính sách hiển thị cho khách hàng",
      type: SettingResource.Type.html,
      isPrivate: false,
      isSecret: false,
      isActive: true,
      sort: 1,
      value: TERMS_OF_SERVICE_SAMPLE_HTML,
      groupId: pageGroup._id.toString(),
    });
  },
};
