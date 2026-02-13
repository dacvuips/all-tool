import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import { CloseThread } from "../../../libs/usecases/thread/closeThread.usecase";

export default {
  schema: gql`
    extend type Mutation {
      closeThread(threadId: ID!, status: String): Mixed
    }
  `,
  resolver: {
    Mutation: {
      closeThread: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TG-1-3"]]);
        const { threadId, status } = args;
        const command = CloseThread.Command.create({
          threadId,
          status,
          userId: context.id,
        });

        const result = await CloseThread.usecase.execute(command);
        return result;
      },
    },
  },
};
