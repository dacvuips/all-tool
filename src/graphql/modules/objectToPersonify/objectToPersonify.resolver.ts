import { TOKEN_ROLES } from "../../../constants/role.const";
import { objectToPersonifyService } from "../../../libs/dal/objectToPersonify";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllObjectToPersonify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return objectToPersonifyService.fetch(args.q);
  },
  getOneObjectToPersonify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await objectToPersonifyService.findOne({ _id: id });
  },
  getActiveObjectToPersonifyList: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const items = await objectToPersonifyService.findAll({
      filter: { isActive: true },
      limit: 200,
    });
    // Strip prompt field for customer-facing response
    return (items || []).map((item: any) => {
      const doc = item._doc || item;
      return {
        id: doc._id,
        name: doc.name,
        imageUrl: doc.imageUrl,
        code: doc.code,
        isActive: doc.isActive,
      };
    });
  },
};

const Mutation = {
  createObjectToPersonify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await objectToPersonifyService.create(data);
  },
  updateObjectToPersonify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await objectToPersonifyService.updateOne(id, data);
  },
  deleteOneObjectToPersonify: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await objectToPersonifyService.deleteOne(id);
  },
};

const ObjectToPersonify = {};

export default {
  Query,
  Mutation,
  ObjectToPersonify,
};
