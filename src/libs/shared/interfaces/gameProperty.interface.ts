import { IsNotEmpty } from "class-validator";

export class GameProperty {
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: string;

  @IsNotEmpty()
  displayValue: string;
}
