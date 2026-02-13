import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { DepositWalletByCasso } from "../../../libs/usecases/wallet";

export default {
  schema: gql`
    extend type Mutation {
      depositWalletByCasso(amount: Int!): WalletTransaction
    }
  `,
  resolver: {
    Mutation: {
      depositWalletByCasso: async (root: any, args: any, context: Context) => {
        await context.auth([...TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP, TOKEN_ROLES.SHOP_STAFF]);

        const command = DepositWalletByCasso.Command.create({
          ownerId: context.isShop ? context.shopOwnerId : context.id,
          amount: args.amount,
          isShop: context.isShop ? true : false,
        });

        const result = await DepositWalletByCasso.usecase.execute(command);
        return result;
      },
    },
  },
};
