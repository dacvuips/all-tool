import { gql } from "apollo-server-core";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { authorityService } from "../../../libs/dal/authority";
import { customerService } from "../../../libs/dal/customer";

import { userService } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Query {
      getAllSelectAuthority(q: QueryGetListInput): AuthorityPageData
      getAllSelectUser(q: QueryGetListInput): UserPageData
      getAllSelectCustomer(q: QueryGetListInput): CustomerPageData
    }
  `,
  resolver: {
    Query: {
      getAllSelectAuthority: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
        return authorityService.fetch(args.q);
      },
      getAllSelectUser: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
        return userService.fetch(args.q);
      },
      getAllSelectCustomer: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
        return customerService.fetch(args.q);
      },
    },
  },
};
