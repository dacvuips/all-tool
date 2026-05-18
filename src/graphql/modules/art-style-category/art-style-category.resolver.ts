import { TOKEN_ROLES } from "../../../constants/role.const";
import { artStyleService } from "../../../libs/dal/art-style";
import { artStyleCategoryService } from "../../../libs/dal/art-style-category";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllArtStyleCategory: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    return artStyleCategoryService.fetch(args.q);
  },
  getOneArtStyleCategory: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    return await artStyleCategoryService.findOne({ _id: id });
  },
  getActiveArtStyleCategoryList: async (root: any, args: any, context: Context) => {
    // Lấy danh sách danh mục đang active, sắp xếp theo priority (chỉ metadata, không kèm items)
    const categories = await artStyleCategoryService.findAll({
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
  getArtStylesByCategoryId: async (root: any, args: any, context: Context) => {
    return artStyleService.fetch(args.q);
  },
};

const Mutation = {
  createArtStyleCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await artStyleCategoryService.create(data);
  },
  updateArtStyleCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await artStyleCategoryService.updateOne(id, data);
  },
  deleteOneArtStyleCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await artStyleCategoryService.deleteOne(id);
  },
};

const ArtStyleCategory = {};

export default {
  Query,
  Mutation,
  ArtStyleCategory,
};
