import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { SetUserBanks } from "../../../libs/usecases/user/set-user-banks.usecase";

export default {
  schema: gql`
    extend type Mutation {
      setUserBanks(userId: ID!, banks: [UserBanksInput]!): Mixed
    }
    input UserBanksInput {
      bankAccount: String
      bankNumber: String
      bankName: String
    }
  `,
  resolver: {
    Mutation: {
      setUserBanks: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);

        const { userId, banks } = args;

        const command = SetUserBanks.Command.create({
          userId: userId,
          updaterId: context.id,
          banks,
        });

        return await SetUserBanks.usecase.execute(command);
      },
    },
  },
};
