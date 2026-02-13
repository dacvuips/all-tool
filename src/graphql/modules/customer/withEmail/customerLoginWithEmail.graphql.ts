import { gql } from "apollo-server-express";
import { Context } from "../../../../libs/graphql";
import {
  CustomerLoginWithEmailCommand,
  customerLoginWithEmailUsecase,
} from "../../../../libs/usecases/customer/with-email/customer-login-with-email.usecase";

export default {
  schema: gql`
    extend type Mutation {
      customerLoginWithEmail(input: CustomerLoginWithEmailInput!): Mixed
    }
    input CustomerLoginWithEmailInput {
      "Token của firebase"
      accessToken: String!
      "pw"
      pw: String!
    }
  `,
  resolver: {
    Mutation: {
      customerLoginWithEmail: async (root: any, args: any, context: Context) => {
        const result = await customerLoginWithEmailUsecase.execute(
          CustomerLoginWithEmailCommand.create({
            ...args.input,
          }),
          context
        );
        context.setAccessToken(result.accessToken);

        return result;
      },
    },
  },
};
