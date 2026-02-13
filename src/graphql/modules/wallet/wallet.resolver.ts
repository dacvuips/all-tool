import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { walletService } from "../../../libs/dal/wallet";
import { UserLoader } from "../../../libs/dal/user";
import { CustomerLoader } from "../../../libs/dal/customer";
import { Scope } from "../../../libs/dal/authority";

const Query = {
  getAllWallet: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-11-1"]]);
    return walletService.fetch(args.q);
  },
  getOneWallet: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-11-1"]]);
    const { id } = args;
    return await walletService.findOne({ _id: id });
  },
};

const Wallet = {
  owner: async (root: any, args: any, context: Context) => {
    const { ownerId } = root;

    try {
      const customer = await CustomerLoader.load(ownerId);
      const user = await UserLoader.load(ownerId);
      // Do something with customer and user here
      if (customer) {
        return {
          name: customer.name,
          role: "CUSTOMER",
        };
      } else {
        return user;
      }
    } catch (error) {
      // Handle error here
    }
    return;
  },
};

export default {
  Query,
  Wallet,
};
