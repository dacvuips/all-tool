import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { GetWalletTransactions } from "../../../libs/usecases/wallet";

export default {
  schema: gql`
    extend type Query {
      getWalletTransactions(q: QueryGetListInput): WalletTransactionPageData
    }
  `,
  resolver: {
    Query: {
      getWalletTransactions: async (root: any, args: any, context: Context) => {
        await context.auth([...TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP, TOKEN_ROLES.SHOP_STAFF]);

        const command = GetWalletTransactions.Command.create({
          ownerId: context.isShop ? context.shopOwnerId : context.id,
          query: args.q,
        });
        const result = await GetWalletTransactions.usecase.execute(command);
        return result.data;
      },
    },
  },
};
