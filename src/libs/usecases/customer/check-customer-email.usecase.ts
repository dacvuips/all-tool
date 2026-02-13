import { IsEmail, IsNotEmpty } from "class-validator";

import { BaseCommand, BaseUsecase } from "../../core";
import { CustomerModel } from "../../dal/customer";

export namespace CheckCustomerEmail {
  export class Command extends BaseCommand {
    @IsNotEmpty()
    @IsEmail()
    email: string;
  }
  class CheckCustomerEmailUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { email } = cmd;

      const customer = await CustomerModel.findOne({ email });
      return !!customer;
    }
  }
  export const usecase = new CheckCustomerEmailUsecase();
}
