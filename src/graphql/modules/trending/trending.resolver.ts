import { TOKEN_ROLES } from "../../../constants/role.const";
import { trendingService } from "../../../libs/dal/trending";
import { TrendingTypeEnum } from "../../../libs/dal/trending/trending.interface";
import { Context } from "../../../libs/graphql";

const preparePromptShort = (data: Record<string, any>) => {
  if (data.prompt) {
    data.promptShort = data.prompt.substring(0, 150);
  }
};

const verifyCustomerOwnership = async (id: string, customerId: string) => {
  const item = await trendingService.findOne({ _id: id });
  if (!item) throw new Error("Không tìm thấy trending");
  const doc = (item as any)._doc || item;
  if (doc.customerId?.toString() !== customerId?.toString()) {
    throw new Error("Không có quyền thao tác item này");
  }
  return doc;
};

const verifyCustomerType = (doc: any, type: TrendingTypeEnum, label: string) => {
  if (doc.type && doc.type !== type) {
    throw new Error(`Không có quyền thao tác ${label} này`);
  }
};

const fetchCustomerListByType = async (args: any, context: Context, type: TrendingTypeEnum) => {
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  const customerId = context.id;
  const q = args.q || {};
  const filter = { ...(q.filter || {}), customerId, type };
  return trendingService.fetch({ ...q, filter });
};

const createCustomerItem = async (args: any, context: Context, type: TrendingTypeEnum) => {
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  const customerId = context.id;
  const { data } = args;
  preparePromptShort(data);
  return await trendingService.create({
    ...data,
    customerId,
    type,
  });
};

const updateCustomerItem = async (
  args: any,
  context: Context,
  type: TrendingTypeEnum,
  label: string
) => {
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  const customerId = context.id;
  const { id, data } = args;
  const doc = await verifyCustomerOwnership(id, customerId);
  verifyCustomerType(doc, type, label);
  if (data.prompt !== undefined) {
    data.promptShort = data.prompt ? data.prompt.substring(0, 150) : "";
  }
  if (data.isPublish === false) {
    data.isActive = false;
  }
  return await trendingService.updateOne(id, data);
};

const deleteCustomerItem = async (
  args: any,
  context: Context,
  type: TrendingTypeEnum,
  label: string
) => {
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  const customerId = context.id;
  const { id } = args;
  const doc = await verifyCustomerOwnership(id, customerId);
  verifyCustomerType(doc, type, label);
  return await trendingService.deleteOne(id);
};

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
    return fetchCustomerListByType(args, context, TrendingTypeEnum.PROMPT);
  },
  getCustomerChatbotList: async (root: any, args: any, context: Context) => {
    return fetchCustomerListByType(args, context, TrendingTypeEnum.CHATBOT);
  },
};

const Mutation = {
  createTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    preparePromptShort(data);
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
    return createCustomerItem(args, context, TrendingTypeEnum.PROMPT);
  },
  updateCustomerTrending: async (root: any, args: any, context: Context) => {
    return updateCustomerItem(args, context, TrendingTypeEnum.PROMPT, "trending");
  },
  deleteCustomerTrending: async (root: any, args: any, context: Context) => {
    return deleteCustomerItem(args, context, TrendingTypeEnum.PROMPT, "trending");
  },
  createCustomerChatbot: async (root: any, args: any, context: Context) => {
    return createCustomerItem(args, context, TrendingTypeEnum.CHATBOT);
  },
  updateCustomerChatbot: async (root: any, args: any, context: Context) => {
    return updateCustomerItem(args, context, TrendingTypeEnum.CHATBOT, "chatbot");
  },
  deleteCustomerChatbot: async (root: any, args: any, context: Context) => {
    return deleteCustomerItem(args, context, TrendingTypeEnum.CHATBOT, "chatbot");
  },
};

const Trending = {};

export default {
  Query,
  Mutation,
  Trending,
};
