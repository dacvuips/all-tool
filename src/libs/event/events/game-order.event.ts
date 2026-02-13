import { IsNotEmpty } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand } from "../../core";

export class GameOrderEvent extends BaseCommand {
  @IsObjectId()
  @IsNotEmpty()
  orderId: string;

  @IsNotEmpty()
  orderCode: string;
}
