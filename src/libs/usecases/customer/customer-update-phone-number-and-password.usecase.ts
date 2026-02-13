import { IsNotEmpty } from "class-validator";
import passwordHash from "password-hash";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import Firebase from "../../../helpers/firebase";
import { convertPhone, t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand, ForbiddenError } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
export class CustomerUpdatePhoneNumberAndPasswordCommand extends CustomerCommand {
  @IsNotEmpty()
  phoneNumber: string;
  @IsNotEmpty()
  password: string;
}

type CustomerUpdatePhoneNumberAndPasswordResponse = {
  phoneNumber: string;
};

class CustomerUpdatePhoneNumberAndPasswordUsecase extends BaseUsecase {
  async execute(
    cmd: CustomerUpdatePhoneNumberAndPasswordCommand
  ): Promise<CustomerUpdatePhoneNumberAndPasswordResponse> {
    let { customerId, phoneNumber, password } = cmd;

    // get customer by phone number and email to check exist customer
    const customerExit = await CustomerModel.findOne({
      $or: [{ phoneNumber: convertPhone(phoneNumber, "") }],
    });

    if (customerExit) {
      throw new ForbiddenError(t("Số điện thoại đã tồn tại, vui lòng chọn số khác"));
    }

    // find customer
    const customer = await CustomerModel.findByIdAndUpdate(customerId, {
      $set: {
        phoneNumber: convertPhone(phoneNumber, ""),
        passwordHash: passwordHash.generate(password),
      },
    });

    if (!customer) throw new ForbiddenError(t("Tài khoản không tồn tại"));
    await Firebase.auth.updateUser(customer.uid, { password });

    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      "Cập nhật tài khoản",
      `Bạn đã cập nhật số điện thoại thành công `
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return {
      phoneNumber,
    };
  }
}

export const customerUpdatePhoneNumberAndPasswordUsecase =
  new CustomerUpdatePhoneNumberAndPasswordUsecase();
