import { IsNotEmpty, IsPhoneNumber } from "class-validator";

import { convertPhone } from "../../../helpers/functions/string";
import { BaseCommand, BaseUsecase } from "../../core";
import { CustomerModel } from "../../dal/customer";

export namespace CheckCustomerPhone {
  export class Command extends BaseCommand {
    @IsNotEmpty()
    @IsPhoneNumber("VN")
    phoneNumber: string;
  }
  class CheckCustomerPhoneUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { phoneNumber } = cmd;

      const parsedPhone = convertPhone(phoneNumber.trim(), "0");

      const customer = await CustomerModel.findOne({ phoneNumber: parsedPhone });

      if (customer) {
        return { isExist: true };
      } else {
        return { isExist: false };
      }
    }
  }
  export const usecase = new CheckCustomerPhoneUsecase();
}
