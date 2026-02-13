import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { CustomerCreditPoint } from "../../../libs/usecases/customer/customer-credit-point.usecase";

export default {
  schema: gql`
    extend type Query {
      customerCreditPoint(action: String!, customerId: ID!, point: Float): Mixed
    }
  `,
  resolver: {
    Query: {
      customerCreditPoint: async (root: any, args: any, context: Context) => {
        const command = CustomerCreditPoint.Command.create({
          customerId: args.customerId,
          action: args.action,
          point: args.point,
          updaterId: context.id,
        });
        return await CustomerCreditPoint.usecase.execute(command);
      },
    },
  },
};
