import { gql } from "apollo-server-express";
import { AiProviderModel } from "../../../libs/dal/aiProvider";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Query {
      getAiProviderSelect: Mixed
    }
  `,
  resolver: {
    Query: {
      getAiProviderSelect: async (root: any, args: any, context: Context) => {
        return await AiProviderModel.find({ active: true }).select("name id imgUrl").lean();
      },
    },
  },
};
