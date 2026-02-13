import { set } from "lodash";

import { TOKEN_ROLES } from "../../../constants/role.const";
import { SettingModel } from "../../../libs/dal/setting";
import { settingGroupService } from "../../../libs/dal/settingGroup";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllSettingGroup: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    set(args, "q.order", { sort: 1 });
    return settingGroupService.fetch(args.q);
  },
};

const SettingGroup = {
  settings: async (root: any, args: any, context: Context) => {
    return await SettingModel.find({ groupId: root["id"] });
  },
};

export default {
  Query,
  SettingGroup,
};
