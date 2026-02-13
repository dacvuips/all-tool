import { ForbiddenError } from "apollo-server-express";
import { IsEmail, IsNotEmpty, Length } from "class-validator";
import passwordHash from "password-hash";

import Firebase from "../../../helpers/firebase";
import { convertPhone, t } from "../../../helpers/functions/string";
import { startSession } from "../../../helpers/mongo";
import { BaseCommand, BaseUsecase } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { CheckCustomerPhone } from "./check-customer-phone.usecase";

export class CustomerRegistCommand extends BaseCommand {
  firebaseToken: string;
  @Length(6, 50)
  name: string;
  @IsEmail()
  email: string;
  @Length(32)
  password: string;

  introduceCode?: string;
  @IsNotEmpty()
  shopName: string;
}

type CustomerRegistResponse = {
  success: boolean;
};
class CustomerRegistUsercase extends BaseUsecase {
  async execute(cmd: CustomerRegistCommand): Promise<CustomerRegistResponse> {
    const { firebaseToken, name, email, password, shopName, introduceCode } = cmd;

    // decode firebase token
    const firebaseUser = await Firebase.instance.verifyIdToken(firebaseToken).catch((err) => {
      this.logger.error(`Firebase Token is invalid: ${err.message}`);
      throw new ForbiddenError(t("Firebase Token không hợp lệ"));
    });

    // required firebase token has phone_number provider
    if (!firebaseUser.phone_number) {
      this.logger.error(`Firebase Token is invalid: phone_number is required`);
      throw new ForbiddenError(t("Firebase Token không hợp lệ"));
    }

    // check phone number is exist
    const { isExist } = await CheckCustomerPhone.usecase.execute({
      phoneNumber: firebaseUser.phone_number,
    });

    if (isExist) {
      this.logger.error(`Phone number is exist: ${firebaseUser.phone_number}`);
      throw new ForbiddenError(t("Số điện thoại đã tồn tại, vui lòng chọn số khác"));
    }

    // check email is exist
    if (await CustomerModel.findOne({ email: email })) {
      this.logger.error(`Email is exist: ${email}`);
      throw new ForbiddenError(t("Email đã tồn tại"));
    }
    if (introduceCode) {
      const isExist = await CustomerModel.findOne({ code: introduceCode }).select("_id");
      if (!isExist) {
        this.logger.error(`Code is not exist: ${introduceCode}`);
        throw new ForbiddenError(t("Mã người giới thiệu không tồn tại"));
      }
    }

    // hash password
    const hashedPassword = passwordHash.generate(password);

    // generate customer code (random 12 characters)
    const customerCode =
      Math.random().toString(16).slice(2, 14).toUpperCase() + firebaseUser.phone_number.slice(-3);
    const session = await startSession();
    await session
      .withTransaction(async () => {
        // create customer
        const customer = await CustomerModel.findOneAndUpdate(
          { phoneNumber: firebaseUser.phone_number },
          {
            uid: firebaseUser.uid,
            name: name,
            email: email,
            passwordHash: hashedPassword,
            phoneNumber: convertPhone(firebaseUser.phone_number, "0"),
            code: customerCode,
          },
          { upsert: true, new: true, session }
        );
      })
      .finally(() => {
        session.endSession();
      });
    return {
      success: true,
    };
  }
}
export const customerRegistUsecase = new CustomerRegistUsercase();
