import { PostModel, PostStatus, RoleGroup } from "../../../dal/post";

import { IsIn, IsNotEmpty } from "class-validator";
import { BaseCommand, BaseUsecase } from "../../../core";
import _ from "lodash";

export namespace GetPostPopupUsecase {
  export class Command extends BaseCommand {
    @IsIn(["customer", "shop"])
    @IsNotEmpty()
    resource: "customer" | "shop";
  }

  class GetPostPopupResourceUsecase extends BaseUsecase {
    async execute(command: Command) {
      const query = {};
      switch (command.resource) {
        case "customer":
          _.set(query, "roleGroup", RoleGroup.POPUP);
          _.set(query, "status", PostStatus.PUBLIC);
          break;
        case "shop":
          _.set(query, "roleGroup", RoleGroup.SHOP);
          _.set(query, "status", PostStatus.PUBLIC);
          break;
      }

      const posts = await PostModel.find(query).select("slug title excerpt featureImage");
      const post = posts[Math.floor(Math.random() * posts.length)];
      return post;
    }
  }

  export const usecase = new GetPostPopupResourceUsecase();
}
