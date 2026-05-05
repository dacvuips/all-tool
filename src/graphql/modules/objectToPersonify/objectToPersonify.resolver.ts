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
      filter: { isActive: true, customerId: { $exists: false } },
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
  getCustomerObjectToPersonifyList: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const items = await objectToPersonifyService.findAll({
      filter: { customerId, isActive: true },
      limit: 200,
    });
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
  createCustomerObjectToPersonify: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { data } = args;
    const code = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await objectToPersonifyService.create({
      ...data,
      code,
      customerId,
      isActive: true,
    });
    const doc = (created as any)._doc || created;
    return {
      id: doc._id,
      name: doc.name,
      imageUrl: doc.imageUrl,
      code: doc.code,
      isActive: doc.isActive,
    };
  },
  deleteCustomerObjectToPersonify: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { id } = args;
    // Verify ownership
    const item = await objectToPersonifyService.findOne({ _id: id });
    if (!item) throw new Error("Không tìm thấy nhân vật");
    const doc = (item as any)._doc || item;
    if (doc.customerId?.toString() !== customerId?.toString()) {
      throw new Error("Không có quyền xoá nhân vật này");
    }
    await objectToPersonifyService.deleteOne(id);
    return {
      id: doc._id,
      name: doc.name,
      imageUrl: doc.imageUrl,
      code: doc.code,
      isActive: doc.isActive,
    };
  },
};

const ObjectToPersonify = {};

export default {
  Query,
  Mutation,
  ObjectToPersonify,
};

