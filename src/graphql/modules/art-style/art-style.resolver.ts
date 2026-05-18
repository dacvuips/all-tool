import { TOKEN_ROLES } from "../../../constants/role.const";
import { artStyleService } from "../../../libs/dal/art-style";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllArtStyle: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return artStyleService.fetch(args.q);
  },
  getOneArtStyle: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await artStyleService.findOne({ _id: id });
  },
  getArtStylePromptById: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    const artStyle = await artStyleService.findOne({ _id: id });
    if (!artStyle) return null;
    return { id: artStyle._id, prompt: artStyle.prompt };
  },
  getCustomerArtStyleList: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    // Inject customerId filter vào query
    const q = args.q || {};
    const filter = { ...(q.filter || {}), customerId };
    return artStyleService.fetch({ ...q, filter });
  },
};

const Mutation = {
  createArtStyle: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    if (data.prompt) {
      data.promptShort = data.prompt.substring(0, 150);
    }
    return await artStyleService.create(data);
  },
  updateArtStyle: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    if (data.prompt !== undefined) {
      data.promptShort = data.prompt ? data.prompt.substring(0, 150) : "";
    }
    return await artStyleService.updateOne(id, data);
  },
  deleteOneArtStyle: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await artStyleService.deleteOne(id);
  },
  createCustomerArtStyle: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { data } = args;
    if (data.prompt) {
      data.promptShort = data.prompt.substring(0, 150);
    }
    return await artStyleService.create({
      ...data,
      customerId,
    });
  },
  updateCustomerArtStyle: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { id, data } = args;
    // Verify ownership
    const item = await artStyleService.findOne({ _id: id });
    if (!item) throw new Error("Không tìm thấy art style");
    const doc = (item as any)._doc || item;
    if (doc.customerId?.toString() !== customerId?.toString()) {
      throw new Error("Không có quyền sửa art style này");
    }
    if (data.prompt !== undefined) {
      data.promptShort = data.prompt ? data.prompt.substring(0, 150) : "";
    }
    if (data.isPublish === false) {
      data.isActive = false;
    }
    return await artStyleService.updateOne(id, data);
  },
  deleteCustomerArtStyle: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { id } = args;
    // Verify ownership
    const item = await artStyleService.findOne({ _id: id });
    if (!item) throw new Error("Không tìm thấy art style");
    const doc = (item as any)._doc || item;
    if (doc.customerId?.toString() !== customerId?.toString()) {
      throw new Error("Không có quyền xoá art style này");
    }
    return await artStyleService.deleteOne(id);
  },
};

const ArtStyle = {};

export default {
  Query,
  Mutation,
  ArtStyle,
};
