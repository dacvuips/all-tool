import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerModel } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Query {
      customerGetEmail: String
    }
  `,
  resolver: {
    Query: {
      customerGetEmail: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        return (await CustomerModel.findById(context.id).select("email").lean()).email;
      },
    },
  },
};
