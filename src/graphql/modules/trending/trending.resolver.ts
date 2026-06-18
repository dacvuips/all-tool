import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority/scope.enum";
import { trendingService } from "../../../libs/dal/trending";
import { TrendingTypeEnum } from "../../../libs/dal/trending/trending.interface";
import { TrendingModel } from "../../../libs/dal/trending/trending.model";
import { Context } from "../../../libs/graphql";
import { CheckTrendingAccess } from "../../../libs/usecases/trending-purchase-order/check-trending-access.usecase";
const APP_TRENDING_TYPES = new Set([
  TrendingTypeEnum.CHATBOT,
  TrendingTypeEnum.FLOW_APP,
  TrendingTypeEnum.AI_STUDIO_APP,
]);

const PROMPT_SHORT_RATIO = 0.2;

const getPromptShort = (prompt: string) => {
  const length = Math.ceil(prompt.length * PROMPT_SHORT_RATIO);
  if (length <= 1) return "";
  return prompt.substring(0, length);
};

const preparePromptShort = (data: Record<string, any>) => {
  if (data.prompt !== undefined) {
    data.promptShort = data.prompt ? getPromptShort(data.prompt) : "";
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
  preparePromptShort(data);
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
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TD-1-1"]]);
    return trendingService.fetch(args.q);
  },
  getOneTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TD-1-1"]]);
    const { id } = args;
    return await trendingService.findOne({ _id: id });
  },
  getTrendingPromptById: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    const customerId = context.id;

    // Bảo vệ server-side: chỉ trả prompt khi customer có quyền (owner / miễn phí / đã mua)
    await CheckTrendingAccess.requireAccess(customerId, id);

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
  getCustomerFlowAppList: async (root: any, args: any, context: Context) => {
    return fetchCustomerListByType(args, context, TrendingTypeEnum.FLOW_APP);
  },
  getCustomerAiStudioAppList: async (root: any, args: any, context: Context) => {
    return fetchCustomerListByType(args, context, TrendingTypeEnum.AI_STUDIO_APP);
  },
};

const Mutation = {
  createTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TD-1-2"]]);
    const { data } = args;
    preparePromptShort(data);
    return await trendingService.create(data);
  },
  updateTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TD-1-3"]]);
    const { id, data } = args;
    preparePromptShort(data);
    return await trendingService.updateOne(id, data);
  },
  deleteOneTrending: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TD-1-4"]]);
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
  createCustomerFlowApp: async (root: any, args: any, context: Context) => {
    return createCustomerItem(args, context, TrendingTypeEnum.FLOW_APP);
  },
  updateCustomerFlowApp: async (root: any, args: any, context: Context) => {
    return updateCustomerItem(args, context, TrendingTypeEnum.FLOW_APP, "flow app");
  },
  deleteCustomerFlowApp: async (root: any, args: any, context: Context) => {
    return deleteCustomerItem(args, context, TrendingTypeEnum.FLOW_APP, "flow app");
  },
  createCustomerAiStudioApp: async (root: any, args: any, context: Context) => {
    return createCustomerItem(args, context, TrendingTypeEnum.AI_STUDIO_APP);
  },
  updateCustomerAiStudioApp: async (root: any, args: any, context: Context) => {
    return updateCustomerItem(args, context, TrendingTypeEnum.AI_STUDIO_APP, "AI studio app");
  },
  deleteCustomerAiStudioApp: async (root: any, args: any, context: Context) => {
    return deleteCustomerItem(args, context, TrendingTypeEnum.AI_STUDIO_APP, "AI studio app");
  },
  recordAppTrendingUse: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    const trending = await trendingService.findOne({ _id: id });
    if (!trending) throw new Error("Không tìm thấy app");
    const doc = (trending as any)._doc || trending;
    if (!APP_TRENDING_TYPES.has(doc.type)) {
      throw new Error("Chỉ áp dụng cho ChatBot, Flow App và AI Studio App");
    }
    const updated = await TrendingModel.findByIdAndUpdate(
      id,
      { $inc: { count: 1, monthlyCount: 1 } },
      { new: true }
    );
    if (!updated) throw new Error("Không tìm thấy app");
    return updated;
  },
};

const Trending = {};

export default {
  Query,
  Mutation,
  Trending,
};
