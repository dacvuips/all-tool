import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { GetPostPopupUsecase } from "../../../libs/usecases/post/get/get-post-popup.usecase";

export default {
  schema: gql`
    extend type Query {
      getPostPopup: Mixed
      getPostPopupShop: Mixed
    }
  `,
  resolver: {
    Query: {
      getPostPopup: async (root: any, args: any, context: Context) => {
        const command: GetPostPopupUsecase.Command = GetPostPopupUsecase.Command.create({
          resource: "customer",
        });

        return await GetPostPopupUsecase.usecase.execute(command);
      },
      getPostPopupShop: async (root: any, args: any, context: Context) => {
        const command: GetPostPopupUsecase.Command = GetPostPopupUsecase.Command.create({
          resource: "shop",
        });

        return await GetPostPopupUsecase.usecase.execute(command);
      },
    },
  },
};
