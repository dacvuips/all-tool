import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { GetThreadSeenUsecase } from "../../../libs/usecases/thread/get-thread-seen.usecase";

export default {
  schema: gql`
    extend type Query {
      getThreadSeen(role: String!): Mixed
    }
  `,
  resolver: {
    Query: {
      getThreadSeen: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const command = GetThreadSeenUsecase.Command.create({
          role: args.role,
          roleId: context.id,
        });
        const result = await GetThreadSeenUsecase.usecase.execute(command);
        return result;
      },
    },
  },
};
