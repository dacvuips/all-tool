import { TOKEN_ROLES } from "../../../constants/role.const";
import { trendingService } from "../../../libs/dal/trending";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return trendingService.fetch(args.q);
  },
  getOneTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await trendingService.findOne({ _id: id });
  },
};

const Mutation = {
  createTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await trendingService.create(data);
  },
  updateTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await trendingService.updateOne(id, data);
  },
  deleteOneTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await trendingService.deleteOne(id);
  },
};

const Trending = {};

export default {
  Query,
  Mutation,
  Trending,
};
