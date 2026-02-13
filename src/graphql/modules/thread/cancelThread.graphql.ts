import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { CancelThread } from "../../../libs/usecases/thread/cancelThread.usecase";

export default {
  schema: gql`
    extend type Mutation {
      cancelThread(threadId: ID!): Mixed
    }
  `,
  resolver: {
    Mutation: {
      cancelThread: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_CUSTOMER);
        const { threadId } = args;
        const command = CancelThread.Command.create({
          threadId,
          userId: context.id,
        });

        const result = await CancelThread.usecase.execute(command);
        return result;
      },
    },
  },
};
