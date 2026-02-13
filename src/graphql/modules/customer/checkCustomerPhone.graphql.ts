import { gql } from "apollo-server-express";
import { CheckCustomerPhone } from "../../../libs/usecases";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Query {
      checkCustomerPhone(phone: String!): Mixed
    }
  `,
  resolver: {
    Query: {
      checkCustomerPhone: async (root: any, args: any, context: Context) => {
        const command = CheckCustomerPhone.Command.create({
          phoneNumber: args.phone,
        });
        return await CheckCustomerPhone.usecase.execute(command);
      },
    },
  },
};
