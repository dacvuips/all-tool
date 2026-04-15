import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../../libs/core";
import { CustomerModel } from "../../../libs/dal/customer";
import { introduceService } from "../../../libs/dal/introduce";
import { IntroduceModel } from "../../../libs/dal/introduce/introduce.model";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return introduceService.fetch(args.q);
  },
  getOneIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await introduceService.findOne({ _id: id });
  },
  getMyIntroduces: async (root: any, args: any, context: Context) => {
    const tokenData = await context.auth([TOKEN_ROLES.CUSTOMER]);
    const q = args.q || {};
    if (!q.filter) q.filter = {};
    q.filter.referrerId = context.id;
    return introduceService.fetch(q);
  },
  getMyReferrer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    return await IntroduceModel.findOne({ refereeId: context.id });
  },
};

const Mutation = {
  createIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await introduceService.create(data);
  },
  updateIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await introduceService.updateOne(id, data);
  },
  deleteOneIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await introduceService.deleteOne(id);
  },
  updateMyReferrer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { introduceCode } = args;

    // Kiểm tra mình đã giới thiệu ai chưa
    const existing = await IntroduceModel.findOne({ refereeId: context.id });
    if (existing) {
      throw new ForbiddenError(t("Bạn đã giới thiệu người khác rồi"));
    }

    // Tìm người giới thiệu theo mã
    const referrer = await CustomerModel.findOne({ code: introduceCode });
    if (!referrer) {
      throw new ForbiddenError(t("Mã giới thiệu không tồn tại"));
    }

    // Không cho phép tự giới thiệu chính mình
    if (referrer._id.toString() === context.id) {
      throw new ForbiddenError(t("Không thể tự giới thiệu chính mình"));
    }

    return await IntroduceModel.create({
      referrerId: referrer._id,
      refereeId: context.id,
    });
  },
};

const Introduce = {
  referrer: async (root: any) =>
    root.referrerId ? CustomerModel.findById(root.referrerId).select("name code").lean() : null,
  referee: async (root: any) =>
    root.refereeId ? CustomerModel.findById(root.refereeId).select("name code").lean() : null,
};

export default {
  Query,
  Mutation,
  Introduce,
};
