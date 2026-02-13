import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import { UpdatePaymentStatus } from "../../../libs/usecases/order/update-payment-status.usecase";

export default {
  schema: gql`
    extend type Mutation {
      updatePaymentStatus(orderId: ID!, status: String!, reason: String): Order
    }
  `,

  resolver: {
    Mutation: {
      updatePaymentStatus: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-3"]]) ; // Authorize

        const { orderId, status, reason } = args;
        const command = UpdatePaymentStatus.Command.create({
          orderId,
          status,
          reason,
          creatorId: context.id,
        });

        return await UpdatePaymentStatus.usecase.execute(command);
      },
    },
  },
};
