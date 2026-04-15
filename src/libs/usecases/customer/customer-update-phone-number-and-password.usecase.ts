import { IsNotEmpty, IsOptional } from "class-validator";
import passwordHash from "password-hash";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand, ForbiddenError } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { IntroduceModel } from "../../dal/introduce/introduce.model";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
export class CustomerUpdatePhoneNumberAndPasswordCommand extends CustomerCommand {
  @IsNotEmpty()
  password: string;
  @IsOptional()
  introduceCode?: string;
}

type CustomerUpdatePhoneNumberAndPasswordResponse = {
  success: boolean;
};

class CustomerUpdatePhoneNumberAndPasswordUsecase extends BaseUsecase {
  async execute(
    cmd: CustomerUpdatePhoneNumberAndPasswordCommand
  ): Promise<CustomerUpdatePhoneNumberAndPasswordResponse> {
    let { customerId, password, introduceCode } = cmd;

    // find customer
    const customer = await CustomerModel.findByIdAndUpdate(customerId, {
      $set: {
        passwordHash: passwordHash.generate(password),
      },
    });

    if (!customer) throw new ForbiddenError(t("Tài khoản không tồn tại"));
    await Firebase.auth.updateUser(customer.uid, { password });

    // Xử lý mã giới thiệu nếu có
    if (introduceCode) {
      const referrer = await CustomerModel.findOne({ code: introduceCode });
      if (!referrer) {
        throw new ForbiddenError(t("Mã giới thiệu không tồn tại, vui lòng kiểm tra lại"));
      }
      // Chỉ tạo introduce nếu chưa có bản ghi nào
      const existingIntroduce = await IntroduceModel.findOne({ refereeId: customerId });
      if (!existingIntroduce) {
        await IntroduceModel.create({
          referrerId: referrer._id,
          refereeId: customerId,
        });
      }
    }

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
      success: true,
    };
  }
}

export const customerUpdatePhoneNumberAndPasswordUsecase =
  new CustomerUpdatePhoneNumberAndPasswordUsecase();
