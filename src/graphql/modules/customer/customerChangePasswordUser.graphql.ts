import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";

import { Context } from "../../../libs/graphql";
import {
  CustomerChangePasswordUserCommand,
  customerChangePasswordUserUsecase,
} from "../../../libs/usecases/customer/customer-change-password-user.usecase";
import { Scope } from "../../../libs/dal/authority";

export default {
  schema: gql`
    extend type Mutation {
      customerChangePasswordByUser(input: CustomerChangePasswordByUserInput!): Mixed
    }

    input CustomerChangePasswordByUserInput {
      "Mật khẩu mới"
      newPassword: String!
      "Mã khách hàng"
      customerId: String!
    }
  `,
  resolver: {
    Mutation: {
      customerChangePasswordByUser: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-3-3"]]);
        const { newPassword, customerId } = args.input;
        return await customerChangePasswordUserUsecase.execute(
          CustomerChangePasswordUserCommand.create({
            customerId: customerId,
            newPassword: newPassword,
            userId: context.id,
          })
        );
      },
    },
  },
};
