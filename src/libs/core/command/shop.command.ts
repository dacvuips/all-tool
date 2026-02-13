import { IsNotEmpty } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand } from "./base.command";

export class ShopCommand extends BaseCommand {
  @IsNotEmpty()
  @IsObjectId()
  shopId: string;

  @IsNotEmpty()
  @IsObjectId()
  ownerId: string;
}
