import { IsNotEmpty } from "class-validator";
import passwordHash from "password-hash";

import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, ForbiddenError, UserCommand } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import { UserModel, UserStatus } from "../../dal/user";
import { UserRoleEnum } from "../../shared";

export class CustomerChangePasswordUserCommand extends UserCommand {
  @IsNotEmpty()
  newPassword: string;
  @IsNotEmpty()
  customerId: string;
}

type CustomerChangePasswordUserResponse = {
  customerId: string;
};

class CustomerChangePasswordUserUsecase extends BaseUsecase {
  async execute(
    cmd: CustomerChangePasswordUserCommand
  ): Promise<CustomerChangePasswordUserResponse> {
    const { userId, customerId, newPassword } = cmd;

    const user = await UserModel.findById(userId).orFail(
      new ForbiddenError(t("Tài khoản không tồn tại"))
    );
    if (user.status != UserStatus.ACTIVE) {
      throw new ForbiddenError(t("Tài khoản của bạn chưa kích hoạt hoặc đang bị khóa"));
    }
    const customer = await CustomerModel.findById(customerId).orFail(
      new ForbiddenError(t("Khách hàng không tồn tại"))
    );
    //update file base
    await Firebase.auth.updateUser(customer.uid, { password: newPassword });
    // update password
    const hashedPassword = passwordHash.generate(newPassword);

    await customer.updateOne({
      $set: { passwordHash: hashedPassword, "times.passwordChangedAt": new Date() },
      $push: {
        logs: {
          createdAt: new Date(),
          message: "Đổi mật khẩu cho khách khách hàng",
          meta: {
            userId: user.id,
            role: UserRoleEnum.STAFF,
            userName: user.name,
          },
        },
      },
    });
    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      "Cập nhật mật khẩu khách hàng",
      `Bạn đã cập mật khẩu khách hàng thành công, Tên khách hàng [ ${customer.name} ] `
    )
      .sendTo(NotificationTarget.CUSTOMER, cmd.userId)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return {
      customerId,
    };
  }
}

export const customerChangePasswordUserUsecase = new CustomerChangePasswordUserUsecase();
