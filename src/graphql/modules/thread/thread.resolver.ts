import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { CustomerLoader } from "../../../libs/dal/customer";
import { ThreadModel, threadService } from "../../../libs/dal/thread";
import { UserLoader } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";
import { GraphqlResolver } from "../../graphqlResolver";

const Query = {
  getAllThread: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TG-1-1"]]);
    return threadService.fetch(args.q);
  },
  getOneThread: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;

    if (context.isCustomer) {
      return await ThreadModel.findOneAndUpdate(
        { _id: id },
        { $set: { seenCustomer: true } },
        { caches: false, timestamps: false }
      );
    }
    if (context.isShop && !!id) {
      return await ThreadModel.findOneAndUpdate(
        { _id: id },
        { $set: { seenShop: true } },
        { caches: false, timestamps: false }
      );
    }
    if ((context.isStaff || context.isPartner || context.isAdmin) && !!id) {
      return await ThreadModel.findOneAndUpdate(
        { _id: id },
        { $set: { seenStaff: true } },
        { caches: false, timestamps: false }
      );
    }
  },
};

const Mutation = {
  createThread: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await threadService.create(data);
  },
  // updateThread: async (root: any, args: any, context: Context) => {
  // await context.auth(TOKEN_ROLES.ADMIN_STAFF);
  //   const { id, data } = args;
  //   return await threadService.updateOne(id, data);
  // },
  deleteOneThread: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await threadService.deleteOne(id);
  },
};

const Thread = {
  customer: GraphqlResolver.loadById(CustomerLoader, "customerId"),
  staff: GraphqlResolver.loadById(UserLoader, "staffId"),
  // message: GraphqlResolver.loadById(ThreadMessageLoader, "messageId"),
};

export default {
  Query,
  Mutation,
  Thread,
};
