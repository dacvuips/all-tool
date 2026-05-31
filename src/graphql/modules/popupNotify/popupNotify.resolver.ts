import _ from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { popupNotifyService } from "../../../libs/dal/popupNotify";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllPopupNotify: async (root: any, args: any, context: Context) => {
    if (!context.isAdmin && !context.isStaff) {
      _.set(args, "q.filters.status", "ACTIVE");
      _.set(args, "q.filters.startDate", { $lte: new Date() });
      _.set(args, "q.filters.endDate", { $gte: new Date() });
    }
    return popupNotifyService.fetch(args.q);
  },
  getOnePopupNotify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-8-1"]]);
    const { id } = args;
    return await popupNotifyService.findOne({ _id: id });
  },
};

const Mutation = {
  createPopupNotify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-8-2"]]);
    const { data } = args;
    return await popupNotifyService.create(data);
  },
  updatePopupNotify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-8-3"]]);
    const { id, data } = args;
    return await popupNotifyService.updateOne(id, data);
  },
  deleteOnePopupNotify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-8-4"]]);
    const { id } = args;
    return await popupNotifyService.deleteOne(id);
  },
};

const PopupNotify = {};

export default {
  Query,
  Mutation,
  PopupNotify,
};
