import { TOKEN_ROLES } from "../../../constants/role.const";
import { trendingService } from "../../../libs/dal/trending";
import { trendingCategoryService } from "../../../libs/dal/trending-category";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllTrendingCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return trendingCategoryService.fetch(args.q);
  },
  getOneTrendingCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await trendingCategoryService.findOne({ _id: id });
  },
  getActiveTrendingCategoryList: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

    // Lấy danh sách danh mục đang active, sắp xếp theo priority (chỉ metadata, không kèm items)
    const categories = await trendingCategoryService.findAll({
      filter: { isActive: true },
      order: { priority: -1 },
      limit: 50,
    });

    return (categories || []).map((cat: any) => {
      const doc = cat._doc || cat;
      return {
        id: doc._id,
        name: doc.name,
        isHot: doc.isHot,
        priority: doc.priority,
      };
    });
  },
  getTrendingsByCategoryId: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    return trendingService.fetch(args.q);
  },
};

const Mutation = {
  createTrendingCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await trendingCategoryService.create(data);
  },
  updateTrendingCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await trendingCategoryService.updateOne(id, data);
  },
  deleteOneTrendingCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await trendingCategoryService.deleteOne(id);
  },
};

const TrendingCategory = {};

export default {
  Query,
  Mutation,
  TrendingCategory,
};
