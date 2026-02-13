import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerModel } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      customerIntroOrder: Boolean
      customerIntroCard: Boolean
    }
  `,
  resolver: {
    Mutation: {
      customerIntroOrder: async (root: any, args: any, context: Context) => {
      await context.auth([TOKEN_ROLES.CUSTOMER]);
        await CustomerModel.findByIdAndUpdate(context.id, {
          $set: {
            "intro.order": true,
          },
        });
        return true;
      },
      customerIntroCard: async (root: any, args: any, context: Context) => {
      await context.auth([TOKEN_ROLES.CUSTOMER]);
        await CustomerModel.findByIdAndUpdate(context.id, {
          $set: {
            "intro.card": true,
          },
        });
        return true;
      },
    },
  },
};
