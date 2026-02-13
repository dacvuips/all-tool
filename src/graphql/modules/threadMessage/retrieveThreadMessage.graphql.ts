import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { RetrieveThreadMessage } from "../../../libs/usecases/threadMessage/retrieveThreadMessage.usecase";

export default {
  schema: gql`
    extend type Mutation {
      retrieveThreadMessage(threadMessageId: ID!): Mixed
    }
  `,
  resolver: {
    Mutation: {
      retrieveThreadMessage: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER).grant([Scope["TG-1-2"]]);
        const { threadMessageId } = args;
        const command = RetrieveThreadMessage.Command.create({
          threadMessageId,
          userId: context.id,
        });

        const result = await RetrieveThreadMessage.usecase.execute(command);
        return result;
      },
    },
  },
};
