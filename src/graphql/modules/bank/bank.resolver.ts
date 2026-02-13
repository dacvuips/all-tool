import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { bankService } from "../../../libs/dal/bank";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllBank: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    console.log("args", args);
    return bankService.fetch(args.q);
  },
  getOneBank: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    return await bankService.findOne({ _id: id });
  },
};

const Mutation = {
  createBank: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TH-3-2"]]);
    const { data } = args;
    return await bankService.create(data);
  },
  updateBank: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TH-3-3"]]);
    const { id, data } = args;
    return await bankService.updateOne(id, data);
  },
  deleteOneBank: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TH-3-4"]]);
    const { id } = args;
    return await bankService.deleteOne(id);
  },
};

const Bank = {};

export default {
  Query,
  Mutation,
  Bank,
};
