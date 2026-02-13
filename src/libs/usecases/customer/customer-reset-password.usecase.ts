import { Length } from "class-validator";
import passwordHash from "password-hash";

import Firebase from "../../../helpers/firebase";
import { convertPhone, t } from "../../../helpers/functions/string";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { CustomerModel } from "../../dal/customer";

export class CustomerResetPassowrdCommand extends BaseCommand {
  firebaseToken: string;
  @Length(32)
  password: string;
}

type CustomerResetPasswordResponse = {
  success: boolean;
};

class CustomerResetPasswordUsecase extends BaseUsecase {
  async execute(cmd: CustomerResetPassowrdCommand): Promise<CustomerResetPasswordResponse> {
    const { firebaseToken, password } = cmd;

    // verify firebase token
    const firebaseUser = await Firebase.instance.verifyIdToken(firebaseToken).catch((err) => {
      this.logger.error(`Firebase Token is invalid: ${err.message}`);
      throw new ForbiddenError(t("Token không hợp lệ"));
    });

    // required firebase token has phone_number provider
    if (!firebaseUser.phone_number) {
      throw new ForbiddenError(t("Token không hợp lệ"));
    }

    // find customer
    const customer = await CustomerModel.findOne({
      phoneNumber: convertPhone(firebaseUser.phone_number, "0"),
    }).orFail(new ForbiddenError(t("Tài khoản không tồn tại")));

    // update password
    const hashedPassword = passwordHash.generate(password);

    await customer.updateOne({
      $set: {
        passwordHash: hashedPassword,
        "times.passwordChangedAt": new Date(),
      },
    });

    return {
      success: true,
    };
  }
}

export const customerResetPasswordUsecase = new CustomerResetPasswordUsecase();
