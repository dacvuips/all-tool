import { gql } from "apollo-server-express";
import { CustomerLoginCommand, customerLoginUsecase } from "../../../libs/usecases";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      customerLogin(phone: String!, password: String!): CustomerLoginData
    }
  `,
  resolver: {
    Mutation: {
      customerLogin: async (root: any, args: any, context: Context) => {
        const result = await customerLoginUsecase.execute(
          CustomerLoginCommand.create({
            phone: args.phone,
            password: args.password,
          })
        );

        context.setAccessToken(result.accessToken);

        return result;
      },
    },
  },
};
