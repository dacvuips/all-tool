import { Length } from "class-validator";
import passwordHash from "password-hash";

import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand, ForbiddenError } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../dal/notification";

export class CustomerChangePasswordCommand extends CustomerCommand {
  @Length(32)
  oldPassword: string;
  @Length(32)
  newPassword: string;
}

type CustomerChangePasswordResponse = {
  customerId: string;
};

class CustomerChangePasswordUsecase extends BaseUsecase {
  async execute(cmd: CustomerChangePasswordCommand): Promise<CustomerChangePasswordResponse> {
    const { customerId, oldPassword, newPassword } = cmd;

    const customer = await CustomerModel.findById(customerId).orFail(
      new ForbiddenError(t("Tài khoản không tồn tại"))
    );

    // check old password
    if (!passwordHash.verify(oldPassword, customer.passwordHash)) {
      throw new ForbiddenError(t("Mật khẩu cũ không đúng"));
    }

    // update password
    const hashedPassword = passwordHash.generate(newPassword);
    await customer.updateOne({
      $set: { passwordHash: hashedPassword, "times.passwordChangedAt": new Date() },
    });

    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      "Đổi mật khẩu",
      "Quý khách đã đổi mật khẩu thành công"
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .account()
      .build();

    InsertNotification([customerNotify]);
    return {
      customerId,
    };
  }
}

export const customerChangePasswordUsecase = new CustomerChangePasswordUsecase();
