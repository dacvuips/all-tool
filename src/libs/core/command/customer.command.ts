import { IsNotEmpty } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand } from "./base.command";

export class CustomerCommand extends BaseCommand {
  @IsNotEmpty()
  @IsObjectId()
  customerId: string;
}
