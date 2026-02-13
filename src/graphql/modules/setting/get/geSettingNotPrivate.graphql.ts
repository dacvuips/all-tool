import { gql } from "apollo-server-express";
import { Context } from "../../../../libs/graphql";
import { GetSettingNotPrivate } from "../../../../libs/usecases/setting/getNotPrivate.usecase";

export default {
  schema: gql`
    extend type Query {
      getSettingNotPrivate: [Mixed]
    }
  `,
  resolver: {
    Query: {
      getSettingNotPrivate: async (root: any, args: any, context: Context) => {
        return await GetSettingNotPrivate.usecase.execute();
      },
    },
  },
};
