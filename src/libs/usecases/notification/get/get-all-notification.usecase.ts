import { IsIn, IsNotEmpty, ValidateIf } from "class-validator";
import _ from "lodash";

import { IQueryInput } from "../../../../base/crudService";
import { IsObjectId } from "../../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../../core";

import { notificationService } from "../../../dal/notification";

export namespace GetAllNotificationUsecase {
  export class Command extends BaseCommand {
    @IsIn(["user", "customer", "shop"])
    @IsNotEmpty()
    resource: "user" | "customer" | "shop";
    query: IQueryInput;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "user")
    userId?: string;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "customer")
    customerId?: string;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "shop")
    shopId?: string;
  }

  class GetAllNotificationUsecase extends BaseUsecase {
    async execute(command: Command) {
      const { query } = command;
      switch (command.resource) {
        case "user":
          // only get notification with user
          _.set(query, "filter.userId", command.userId);
          break;

        case "shop":
          // only get notification with shop
          _.set(query, "filter.shopId", command.shopId);

          break;
        case "customer":
          // only get notification with shop
          _.set(query, "filter.customerId", command.customerId);
          break;
      }

      // sort by _id
      _.set(query, "order", { _id: -1 });

      const fetchResult = await notificationService.fetch(query);

      return {
        data: fetchResult,
      };
    }
  }

  export const usecase = new GetAllNotificationUsecase();
}
