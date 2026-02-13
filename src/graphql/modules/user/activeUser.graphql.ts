import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import { ActiveUser } from "../../../libs/usecases/user/active-user.usecase";

export default {
  schema: gql`
    extend type Mutation {
      activeUser(userId: String!): Mixed
    }
  `,
  resolver: {
    Mutation: {
      activeUser: async (root: any, args: any, context: Context) => {
        const { userId } = args;
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-3"]]);
        const command = ActiveUser.Command.create({
          userId,
          updaterId: context.id,
        });

        const result = await ActiveUser.usecase.execute(command);

        return result;
      },
    },
  },
};
