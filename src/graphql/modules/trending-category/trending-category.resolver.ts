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

    // Lấy danh sách danh mục đang active, sắp xếp theo priority
    const categories = await trendingCategoryService.findAll({
      filter: { isActive: true },
      order: { priority: -1 },
      limit: 100,
    });

    // Resolve trending items cho từng category
    const result = await Promise.all(
      (categories || []).map(async (cat: any) => {
        const doc = cat._doc || cat;
        let trendingItems: any[] = [];

        if (doc.trendingIds?.length) {
          // Lấy các trending active theo IDs
          const items = await trendingService.findAll({
            filter: {
              trendingCategoryIds: { $in: [doc.id] },
              isActive: true,
            },
            limit: 200,
          });
          trendingItems = (items || []).map((item: any) => {
            const t = item._doc || item;
            return {
              id: t._id,
              name: t.name,
              imageUrls: t.imageUrls || [],
              prompt: t.prompt,
              count: t.count || 0,
            };
          });
        }

        return {
          id: doc._id,
          name: doc.name,
          isHot: doc.isHot,
          priority: doc.priority,
          trendingItems,
        };
      })
    );

    return result;
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
