import { IsIn, IsNotEmpty } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { threadService } from "../../dal/thread";

export namespace GetThreadSeenUsecase {
  export class Command extends BaseCommand {
    @IsIn(["CUSTOMER", "SHOP", "STAFF"])
    @IsNotEmpty()
    role: "CUSTOMER" | "SHOP" | "STAFF";

    @IsObjectId()
    @IsNotEmpty()
    roleId?: string;
  }

  class GetThreadSeenUsecase extends BaseUsecase {
    async execute(command: Command) {
      const { roleId } = command;
      if (command.role == "CUSTOMER") {
        return await threadService.getThreadSeenCustomer(roleId);
      }
      if (command.role == "SHOP") {
        return await threadService.getThreadSeenShop(roleId);
      }
      if (command.role == "STAFF") {
        return await threadService.getThreadSeenStaff(roleId);
      }
    }
  }

  export const usecase = new GetThreadSeenUsecase();
}
