import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  ApiMediaSubscriptionPlanEnum,
  apiMediaTokenService,
} from "../../../libs/dal/apiMediaToken";
import { settingService } from "../../../libs/dal/setting";
import { Context } from "../../../libs/graphql";
import {
  createApiMediaTokenCredentials,
  generateApiMediaKeyPair,
  hashApiMediaKey,
} from "../../../routers/api-media/api-media-key";

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
    const { plainKey, keyHash, keyPrefix } = data.key
      ? {
          plainKey: data.key.trim(),
          keyHash: hashApiMediaKey(data.key),
          keyPrefix: data.key.trim().slice(0, 12) + "...",
        }
      : generateApiMediaKeyPair();

    const doc = await apiMediaTokenService.create({
      ...data,
      key: undefined,
      keyHash,
      keyPrefix,
    });
    return { ...(doc as any).toObject?.() ?? doc, key: plainKey };
  },
  updateApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    const patch = { ...data };
    if (patch.key) {
      patch.keyHash = hashApiMediaKey(patch.key);
      patch.keyPrefix = patch.key.slice(0, 12) + "...";
      delete patch.key;
    }
    return await apiMediaTokenService.updateOne(id, patch);
  },
  deleteOneApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await apiMediaTokenService.deleteOne(id);
  },
  createMyApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.id;

    const existing = await apiMediaTokenService.fetch({
      limit: 1,
      filter: { customerId },
    });

    if (existing.data && existing.data.length > 0) {
      throw new Error("Bạn đã có API Media token. Vui lòng mua thêm gói mới.");
    }

    const requestQuantitySetting = await settingService.findOne({
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-request-quantity`,
    });
    const requestQuantity = requestQuantitySetting?.value ?? 100;

    const streamCountSetting = await settingService.findOne({
      key: `ampk-${ApiMediaSubscriptionPlanEnum.FREE}-stream-count`,
    });
    const streamCount = streamCountSetting?.value ?? 1;

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30);

    const { plainKey, doc } = await createApiMediaTokenCredentials({
      requestQuantity: Number(requestQuantity),
      streamCount: Number(streamCount),
      expiredDate,
      customerId,
      active: true,
      usedQuantity: 0,
      subscriptionPlan: ApiMediaSubscriptionPlanEnum.FREE,
    });

    const json = (doc as any).toObject?.() ?? doc;
    return { ...json, key: plainKey };
  },
  rotateMyApiMediaToken: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const customerId = context.id;

    const token = await apiMediaTokenService.findOne({ _id: id, customerId });
    if (!token) {
      throw new Error("Token không tồn tại hoặc bạn không có quyền thực hiện thao tác này.");
    }

    const { plainKey, keyHash, keyPrefix } = generateApiMediaKeyPair();
    const updated = await apiMediaTokenService.updateOne(id, {
      keyHash,
      keyPrefix,
      key: null,
    });

    const json = (updated as any)?.toObject?.() ?? updated ?? token;
    return {
      plainKey,
      token: { ...json, key: plainKey, keyPrefix },
    };
  },
  toggleMyApiMediaTokenActive: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const customerId = context.id;

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
