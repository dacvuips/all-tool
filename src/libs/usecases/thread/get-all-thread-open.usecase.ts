import { IsIn, IsNotEmpty, ValidateIf } from "class-validator";
import _ from "lodash";
import { BaseCommand, BaseUsecase } from "../../core";
import { IQueryInput } from "../../../base/crudService";
import { IsObjectId } from "../../../packages/class-validator";
import { ThreadStatus, threadService } from "../../dal/thread";

export namespace GetAllThreadOpenUsecase {
  export class Command extends BaseCommand {
    @IsIn(["customer", "staff", "shop", "game-order"])
    @IsNotEmpty()
    resource: "customer" | "staff" | "shop" | "game-order";
    query: IQueryInput;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "staff")
    staffId?: string;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "customer")
    customerId?: string;

    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "shop")
    shopId?: string;
    @IsObjectId()
    @IsNotEmpty()
    @ValidateIf((o) => o.resource === "game-order")
    gameOrderId?: string;
  }

  class GetAllThreadOpenUsecase extends BaseUsecase {
    async execute(command: Command) {
      const { query, customerId, shopId, staffId, gameOrderId } = command;
      switch (command.resource) {
        case "customer":
          // only get pending game order

          _.set(query, "filter.customerId", customerId);

          break;
        case "shop":
          // only get pending game order

          _.set(query, "filter.shopId", shopId);

          break;
        case "staff":
          // only get pending game order

          _.set(query, "filter.staffId", staffId);

          break;
        case "game-order":
          // only get pending game order

          _.set(query, "filter.gameOrderId", gameOrderId);

          break;
      }
      _.set(query, "filter.$or", [
        { status: ThreadStatus.new },
        { status: ThreadStatus.opening },
        { status: command.resource === "game-order" ? ThreadStatus.closed : ThreadStatus.opening },
      ]);
      const fetchResult = await threadService.fetch(query);

      return {
        data: fetchResult,
      };
    }
  }

  export const usecase = new GetAllThreadOpenUsecase();
}
