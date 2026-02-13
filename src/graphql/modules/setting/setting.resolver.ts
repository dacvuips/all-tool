import { set } from "lodash";

import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { settingService } from "../../../libs/dal/setting";
import { SettingGroupLoader } from "../../../libs/dal/settingGroup";
import { Context } from "../../../libs/graphql";
import { UpdateSetting } from "../../../libs/usecases/setting";
import { GraphqlResolver } from "../../graphqlResolver";

const Query = {
  getAllSetting: async (root: any, args: any, context: Context) => {
    if (!context.isAdmin) {
      set(args, "q.filter.isPrivate", false);
      set(args, "q.filter.isSecret", false);
    }
    set(args, "q.order", { sort: -1 });
    return settingService.fetch(args.q);
  },
  getOneSettingByKey: async (root: any, args: any, context: Context) => {
    const { key } = args;

    return await settingService.findOne({ key: key });
  },
};

const Mutation = {
  updateSetting: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-9-2"]]);
    const { id, data } = args;
    const cmd = UpdateSetting.Command.create({
      userId: context.id,
      settingId: id,
      data,
    });
    return await UpdateSetting.usecase.execute(cmd);
  },
};

const Setting = {
  group: GraphqlResolver.loadById(SettingGroupLoader, "groupId"),
};

export default {
  Query,
  Mutation,
  Setting,
};
