import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerLoader } from "../../../libs/dal/customer";
import { UserLoader } from "../../../libs/dal/user";
import {
  IWalletTransaction,
  WalletInfoKeyEnum,
  walletTransactionService,
} from "../../../libs/dal/walletTransaction";
import { Context } from "../../../libs/graphql";
import { GraphqlResolver } from "../../graphqlResolver";

const Query = {
  getAllWalletTransaction: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return walletTransactionService.fetch(args.q);
  },
  getOneWalletTransaction: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await walletTransactionService.findOne({ _id: id });
  },
};

const WalletTransaction = {
  tranferFromUser: async (root: IWalletTransaction, args: any, context: Context) => {
    const info = root.specificInfo.find((x) => WalletInfoKeyEnum.FROM_TRANSFER_USER_ID == x.key);
    if (info) {
      const user = await UserLoader.load(info.value);
      return user?.name;
    } else {
      return null;
    }
  },
  ownerCustomer: GraphqlResolver.loadById(CustomerLoader, "ownerId"),
  ownerUser: GraphqlResolver.loadById(UserLoader, "ownerId"),
};

export default {
  Query,
  WalletTransaction,
};
