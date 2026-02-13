import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { DepositWalletManual } from "../../../libs/usecases/wallet";
import { Scope } from "../../../libs/dal/authority";

export default {
  schema: gql`
    extend type Mutation {
      depositWalletManual(input: DepositWalletManualInput!): Mixed
    }

    input DepositWalletManualInput {
      "Mã mPoint"
      walletId: ID!
      "Số tiền"
      amount: Float!
      "Mô tả"
      description: String!
    }
  `,
  resolver: {
    Mutation: {
      depositWalletManual: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-11-5"]]);
        const { input } = args;
        const { walletId, amount, description } = input;
        const command = DepositWalletManual.Command.create({
          userId: context.id,
          walletId: walletId,
          amount: amount,
          description: description,
        });

        const result = await DepositWalletManual.usecase.execute(command);
        return result;
      },
    },
  },
};
