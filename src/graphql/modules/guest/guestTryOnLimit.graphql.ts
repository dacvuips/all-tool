import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { decreaseGuestTryOnLimit, getGuestTryOnLimit } from "./guest.helper";

export default {
  schema: gql`
    extend type Query {
      getGuestTryOnLimit: Int
    }

    extend type Mutation {
      decreaseGuestTryOnLimit: Int
    }
  `,
  resolver: {
    Query: {
      getGuestTryOnLimit: async (root: any, args: any, context: Context) => {
        return await getGuestTryOnLimit(context.req, context.customerId);
      },
    },
    Mutation: {
      decreaseGuestTryOnLimit: async (root: any, args: any, context: Context) => {
        return await decreaseGuestTryOnLimit(context.req, context.customerId);
      },
    },
  },
};
