import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { CustomerRegistCommand, customerRegistUsecase } from "../../../libs/usecases";

export default {
  schema: gql`
    extend type Mutation {
      customerRegister(input: CustomerRegisterInput!): Mixed
    }
    input CustomerRegisterInput {
      "Token của firebase"
      firebaseToken: String!
      "Tên khách hàng"
      name: String!
      "Email của khách hàng"
      email: String!
      "Mật khẩu của khách hàng"
      password: String!
      "Mã người giới thiệu"
      introduceCode: String
      "Tên shop"
      shopName: String!
    }
  `,
  resolver: {
    Mutation: {
      customerRegister: async (root: any, args: any, context: Context) => {
        return await customerRegistUsecase.execute(
          CustomerRegistCommand.create({
            ...args.input,
          })
        );
      },
    },
  },
};
