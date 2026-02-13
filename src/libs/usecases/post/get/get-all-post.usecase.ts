import { IsIn, IsNotEmpty } from "class-validator";
import _ from "lodash";

import { IQueryInput } from "../../../../base/crudService";

import { RoleGroup, postService } from "../../../dal/post";
import { BaseCommand, BaseUsecase } from "../../../core";

export namespace GetAllPostUsecase {
  export class Command extends BaseCommand {
    @IsIn(["customer", "partner", "shop", "staff", "admin", "all"])
    @IsNotEmpty()
    resource: "customer" | "partner" | "shop" | "staff" | "admin" | "all";
    query: IQueryInput;
  }

  class GetAllPostDetailUsecase extends BaseUsecase {
    async execute(command: Command) {
      const { query } = command;
      switch (command.resource) {
        case "customer":
          // Lấy những bài gắn thẻ khách hàng
          _.set(query, "filter.roleGroup", RoleGroup.CUSTOMER);

          break;
        case "partner":
          // Lấy những bài gắn thẻ khách hàng
          _.set(query, "filter.roleGroup", RoleGroup.PARTNER);

          break;
        case "shop":
          // Lấy những bài gắn thẻ khách hàng
          _.set(query, "filter.roleGroup", RoleGroup.SHOP);

          break;
        case "staff":
          // Lấy những bài gắn thẻ khách hàng
          // RoleGroup.STAFF and RoleGroup.ADMIN
          _.set(query, "filter.roleGroup", { $in: [RoleGroup.STAFF, RoleGroup.ADMIN] });

          break;

        case "all":
          // Lấy những bài gắn thẻ khách hàng
          _.set(query, "filter.roleGroup", RoleGroup.ALL);

          break;
      }

      const fetchResult = await postService.fetch(query);

      return {
        data: fetchResult,
      };
    }
  }

  export const usecase = new GetAllPostDetailUsecase();
}
