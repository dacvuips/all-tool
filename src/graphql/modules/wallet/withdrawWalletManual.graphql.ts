import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { WithdrawWalletManual } from "../../../libs/usecases/wallet/income/withdraw-wallet-manual.usecase";
import { Scope } from "../../../libs/dal/authority";

export default {
  schema: gql`
    extend type Mutation {
      withdrawWalletManual(input: WithdrawWalletManualInput!): Mixed
    }

    input WithdrawWalletManualInput {
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
      withdrawWalletManual: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-11-6"]]);

        const { input } = args;
        const { walletId, amount, description } = input;
        const command = WithdrawWalletManual.Command.create({
          userId: context.id,
          walletId: walletId,
          amount: amount,
          description: description,
        });

        const result = await WithdrawWalletManual.usecase.execute(command);
        return result;
      },
    },
  },
};
