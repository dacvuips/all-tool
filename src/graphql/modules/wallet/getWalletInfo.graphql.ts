import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";

import { Context } from "../../../libs/graphql";
import { GetWalletInfo } from "../../../libs/usecases/wallet/get-wallet-info.usecase";

export default {
  schema: gql`
    extend type Query {
      getWalletInfo: Wallet
    }
    extend type User {
      wallet: Wallet
    }

    extend type Customer {
      wallet: Wallet
    }
  `,
  resolver: {
    Query: {
      getWalletInfo: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const command = GetWalletInfo.Command.create({
          ownerId: context.isShop ? context.shopOwnerId : context.id,
        });

        return await GetWalletInfo.usecase.execute(command);
      },
    },
    User: {
      wallet: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const command = GetWalletInfo.Command.create({
          ownerId: root.id,
        });
        return await GetWalletInfo.usecase.execute(command);
      },
    },
    Customer: {
      wallet: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const command = GetWalletInfo.Command.create({
          ownerId: root.id,
        });
        return await GetWalletInfo.usecase.execute(command);
      },
    },
  },
};
