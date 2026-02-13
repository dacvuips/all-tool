import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { CheckCustomerEmail } from "../../../libs/usecases/customer/check-customer-email.usecase";

export default {
  schema: gql`
    extend type Query {
      checkCustomerEmail(email: String!): Mixed
    }
  `,
  resolver: {
    Query: {
      checkCustomerEmail: async (root: any, args: any, context: Context) => {
        const command = CheckCustomerEmail.Command.create({
          email: args.email,
        });
        return await CheckCustomerEmail.usecase.execute(command);
      },
    },
  },
};
