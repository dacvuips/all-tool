import crypto from "crypto";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  ApiMediaSubscriptionPlanEnum,
  apiMediaTokenService,
} from "../../../libs/dal/apiMediaToken";
import { settingService } from "../../../libs/dal/setting";
import { Context } from "../../../libs/graphql";
const Query = {
  getAllApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return apiMediaTokenService.fetch(args.q);
  },
  getOneApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await apiMediaTokenService.findOne({ _id: id });
  },
  getMyApiMediaTokens: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const q = args.q || {};
    if (!q.filter) q.filter = {};
    q.filter.customerId = context.id;
    return apiMediaTokenService.fetch(q);
  },
};

const Mutation = {
  createApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await apiMediaTokenService.create(data);
  },
  updateApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await apiMediaTokenService.updateOne(id, data);
  },
  deleteOneApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await apiMediaTokenService.deleteOne(id);
  },
  createMyApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.id;

    // Check if customer already has tokens
    const existing = await apiMediaTokenService.fetch({
      limit: 1,
      filter: { customerId },
    });

    if (existing.data && existing.data.length > 0) {
      throw new Error("Bạn đã có API Media token. Vui lòng mua thêm gói mới.");
    }

    // Lấy số lượng request từ setting gói Free
    const requestQuantitySetting = await settingService.findOne({
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-request-quantity`,
    });
    const requestQuantity = requestQuantitySetting?.value ?? 100;

    const streamCountSetting = await settingService.findOne({
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-stream-count`,
    });
    const streamCount = streamCountSetting?.value ?? 1;

    // Generate a unique key
    const key = crypto.randomBytes(32).toString("hex");
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30);

    return await apiMediaTokenService.create({
      key,
      requestQuantity,
      streamCount: Number(streamCount),
      expiredDate,
      customerId,
      active: true,
      usedQuantity: 0,
      subscriptionPlan: ApiMediaSubscriptionPlanEnum.FREE,
    });
  },
  toggleMyApiMediaTokenActive: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const customerId = context.id;

    // Verify ownership
    const token = await apiMediaTokenService.findOne({ _id: id, customerId });
    if (!token) {
      throw new Error("Token không tồn tại hoặc bạn không có quyền thực hiện thao tác này.");
    }

    return await apiMediaTokenService.updateOne(id, { active: !token.active });
  },
};

export default {
  Query,
  Mutation,
};
