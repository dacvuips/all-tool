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
  getCustomerTrendingList: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    // Inject customerId filter vào query
    const q = args.q || {};
    const filter = { ...(q.filter || {}), customerId };
    return trendingService.fetch({ ...q, filter });
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
  createCustomerTrending: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { data } = args;
    if (data.prompt) {
      data.promptShort = data.prompt.substring(0, 150);
    }
    return await trendingService.create({
      ...data,
      customerId,
      isActive: true,
    });
  },
  updateCustomerTrending: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { id, data } = args;
    // Verify ownership
    const item = await trendingService.findOne({ _id: id });
    if (!item) throw new Error("Không tìm thấy trending");
    const doc = (item as any)._doc || item;
    if (doc.customerId?.toString() !== customerId?.toString()) {
      throw new Error("Không có quyền sửa trending này");
    }
    if (data.prompt !== undefined) {
      data.promptShort = data.prompt ? data.prompt.substring(0, 150) : "";
    }
    return await trendingService.updateOne(id, data);
  },
  deleteCustomerTrending: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { id } = args;
    // Verify ownership
    const item = await trendingService.findOne({ _id: id });
    if (!item) throw new Error("Không tìm thấy trending");
    const doc = (item as any)._doc || item;
    if (doc.customerId?.toString() !== customerId?.toString()) {
      throw new Error("Không có quyền xoá trending này");
    }
    return await trendingService.deleteOne(id);
  },
};

const Trending = {};

export default {
  Query,
  Mutation,
  Trending,
};
