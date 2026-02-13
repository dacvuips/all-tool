import { gql } from "apollo-server-express";
import { CustomerResetPassowrdCommand, customerResetPasswordUsecase } from "../../../libs/usecases";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      customerResetPassword(input: CustomerResetPasswordInput!): Mixed
    }
    input CustomerResetPasswordInput {
      "Firebase Token"
      firebaseToken: String!
      "Mật khẩu mới"
      newPassword: String!
    }
  `,
  resolver: {
    Mutation: {
      customerResetPassword: async (root: any, args: any, context: Context) => {
        const { firebaseToken, newPassword } = args.input;
        return await customerResetPasswordUsecase.execute(
          CustomerResetPassowrdCommand.create({
            firebaseToken: firebaseToken,
            password: newPassword,
          })
        );
      },
    },
  },
};
