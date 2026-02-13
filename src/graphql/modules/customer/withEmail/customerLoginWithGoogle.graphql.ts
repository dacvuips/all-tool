import { gql } from "apollo-server-express";
import { Context } from "../../../../libs/graphql";
import {
  CustomerLoginWithGoogleCommand,
  customerLoginWithGoogleUsecase,
} from "../../../../libs/usecases/customer/with-email/customer-login-with-google.usecase";

export default {
  schema: gql`
    extend type Mutation {
      customerLoginWithGoogle(accessToken: String!): CustomerLoginData
    }
  `,
  resolver: {
    Mutation: {
      customerLoginWithGoogle: async (root: any, args: any, context: Context) => {
        const result = await customerLoginWithGoogleUsecase.execute(
          CustomerLoginWithGoogleCommand.create({
            accessToken: args.accessToken,
          })
        );

        context.setAccessToken(result.accessToken);

        return result.customer;
      },
    },
  },
};
