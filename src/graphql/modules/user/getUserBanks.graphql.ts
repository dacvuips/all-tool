import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { GetUserBanks } from "../../../libs/usecases/user/get-user-banks.usecase";

export default {
  schema: gql`
    extend type Query {
      getUserBanks(userId: ID!): Mixed
    }
  `,
  resolver: {
    Query: {
      getUserBanks: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);

        const { userId } = args;
        const command = GetUserBanks.Command.create({
          userId,
        });

        return await GetUserBanks.usecase.execute(command);
      },
    },
  },
};
