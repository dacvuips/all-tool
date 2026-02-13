import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import {
  CustomerUpdatePhoneNumberAndPasswordCommand,
  customerUpdatePhoneNumberAndPasswordUsecase,
} from "../../../libs/usecases/customer/customer-update-phone-number-and-password.usecase";

export default {
  schema: gql`
    extend type Mutation {
      customerUpdatePhoneNumberAndPassword(input: CustomerUpdatePhoneNumberAndPasswordInput!): Mixed
    }

    input CustomerUpdatePhoneNumberAndPasswordInput {
      "Số điện thoại"
      phoneNumber: String!
      "Mật khẩu"
      password: String!
    }
  `,
  resolver: {
    Mutation: {
      customerUpdatePhoneNumberAndPassword: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        return await customerUpdatePhoneNumberAndPasswordUsecase.execute(
          CustomerUpdatePhoneNumberAndPasswordCommand.create({
            customerId: context.id,
            ...args.input,
          })
        );
      },
    },
  },
};
