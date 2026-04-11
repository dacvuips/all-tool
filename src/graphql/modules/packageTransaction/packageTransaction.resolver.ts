import { set } from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { packageTransactionService } from "../../../libs/dal/packageTransaction";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllPackageTransaction: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_CUSTOMER);
    // Customer chỉ xem được giao dịch của chính mình
    if (context.isCustomer) {
      console.log(context.customerId);
      set(args, "q.filter.customerId", context.customerId);
    }
    return packageTransactionService.fetch(args.q);
  },
  getOnePackageTransaction: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await packageTransactionService.findOne({ _id: id });
  },
};

export default {
  Query,
};
