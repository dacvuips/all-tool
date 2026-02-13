import { gql } from "apollo-server-express";
import { Context } from "../../../../libs/graphql";
import {
  CustomerRegistWithEmailCommand,
  customerRegistWithEmailUsecase,
} from "../../../../libs/usecases/customer/with-email/customer-regist-with-email.usecase";

export default {
  schema: gql`
    extend type Mutation {
      customerRegisterWithEmail(input: CustomerRegisterWithEmailInput!): Mixed
    }
    input CustomerRegisterWithEmailInput {
      "Tên khách hàng"
      name: String!
      "Số điện thoại của khách hàng"
      phoneNumber: String!
      "Email của khách hàng"
      email: String!
      "Mật khẩu của khách hàng"
      password: String!
    }
  `,
  resolver: {
    Mutation: {
      customerRegisterWithEmail: async (root: any, args: any, context: Context) => {
        return await customerRegistWithEmailUsecase.execute(
          CustomerRegistWithEmailCommand.create({
            ...args.input,
          })
        );
      },
    },
  },
};
