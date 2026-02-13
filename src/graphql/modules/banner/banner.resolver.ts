import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { bannerService } from "../../../libs/dal/banner";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllBanner: async (root: any, args: any, context: Context) => {
    // context.auth(TOKEN_ROLES.ADMIN_STAFF_CUSTOMER);
    return bannerService.fetch(args.q);
  },
  getOneBanner: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-6-1"]]);

    const { id } = args;
    return await bannerService.findOne({ _id: id });
  },
};

const Mutation = {
  createBanner: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-6-2"]]);

    const { data } = args;
    return await bannerService.create(data);
  },
  updateBanner: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-6-3"]]);

    const { id, data } = args;
    return await bannerService.updateOne(id, data);
  },
  deleteOneBanner: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-6-4"]]);

    const { id } = args;
    return await bannerService.deleteOne(id);
  },
};

const Banner = {};

export default {
  Query,
  Mutation,
  Banner,
};
