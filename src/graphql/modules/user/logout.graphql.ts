import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";

import { TOKEN_ROLES } from "../../../constants/role.const";
import cache from "../../../helpers/cache";

export default {
  schema: gql`
    extend type Mutation {
      logout: Mixed
    }
  `,
  resolver: {
    Mutation: {
      logout: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER);
        // clear token
        if (context.isCustomer) {
          await cache.del("token-session:customer:" + context.id);
        } else {
          await cache.del("token-session:user:" + context.id);
        }

        // unset cookie
        context.unsetCookie("x-token");

        return true;
      },
    },
  },
};
