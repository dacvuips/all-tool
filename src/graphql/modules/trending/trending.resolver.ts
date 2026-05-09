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
  getTrendingPromptById: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    const trending = await trendingService.findOne({ _id: id });
    if (!trending) return null;
    return { id: trending._id, prompt: trending.prompt };
  },
};

const Mutation = {
  createTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    if (data.prompt) {
      data.promptShort = data.prompt.substring(0, 150);
    }
    return await trendingService.create(data);
  },
  updateTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    if (data.prompt !== undefined) {
      data.promptShort = data.prompt ? data.prompt.substring(0, 150) : "";
    }
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
