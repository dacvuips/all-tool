import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import { BlockUser } from "../../../libs/usecases/user/block-user.usecase";

export default {
  schema: gql`
    extend type Mutation {
      blockUser(userId: String): Mixed
    }
  `,
  resolver: {
    Mutation: {
      blockUser: async (root: any, args: any, context: Context) => {
        const { userId } = args;
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-3"]]);
        const command = BlockUser.Command.create({
          userId,
          updaterId: context.id,
        });

        const result = await BlockUser.usecase.execute(command);
        return result;
      },
    },
  },
};
