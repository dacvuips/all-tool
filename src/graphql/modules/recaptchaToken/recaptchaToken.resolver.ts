import crypto from "crypto";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  RecaptchaSubscriptionPlanEnum,
  recaptchaTokenService,
} from "../../../libs/dal/recaptchaToken";
import { settingService } from "../../../libs/dal/setting";
import { Context } from "../../../libs/graphql";
const Query = {
  getAllRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return recaptchaTokenService.fetch(args.q);
  },
  getOneRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await recaptchaTokenService.findOne({ _id: id });
  },
  getMyRecaptchaTokens: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const q = args.q || {};
    if (!q.filter) q.filter = {};
    q.filter.customerId = context.id;
    return recaptchaTokenService.fetch(q);
  },
};

const Mutation = {
  createRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await recaptchaTokenService.create(data);
  },
  updateRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await recaptchaTokenService.updateOne(id, data);
  },
  deleteOneRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await recaptchaTokenService.deleteOne(id);
  },
  createMyRecaptchaToken: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.id;

    // Check if customer already has tokens
    const existing = await recaptchaTokenService.fetch({
      limit: 1,
      filter: { customerId },
    });

    if (existing.data && existing.data.length > 0) {
      throw new Error("Bạn đã có reCAPTCHA token. Vui lòng mua thêm gói mới.");
    }

    // Lấy số lượng request từ setting gói Free
    const requestQuantitySetting = await settingService.findOne({
      key: `rpk-${RecaptchaSubscriptionPlanEnum.FREE}-request-quantity`,
    });
    const requestQuantity = requestQuantitySetting?.value ?? 1000;

    // Generate a unique key
    const key = crypto.randomBytes(32).toString("hex");
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30);

    return await recaptchaTokenService.create({
      key,
      requestQuantity,
      expiredDate,
      customerId,
      active: true,
      usedQuantity: 0,
      subscriptionPlan: RecaptchaSubscriptionPlanEnum.FREE,
    });
  },
  toggleMyRecaptchaTokenActive: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const customerId = context.id;

    // Verify ownership
    const token = await recaptchaTokenService.findOne({ _id: id, customerId });
    if (!token) {
      throw new Error("Token không tồn tại hoặc bạn không có quyền thực hiện thao tác này.");
    }

    return await recaptchaTokenService.updateOne(id, { active: !token.active });
  },
};

export default {
  Query,
  Mutation,
};
