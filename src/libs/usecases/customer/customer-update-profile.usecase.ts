import { IsOptional, IsString, IsUrl, Length } from "class-validator";

import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand, ForbiddenError } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../dal/notification";

export class CustomerUpdateProfileCommand extends CustomerCommand {
  @IsOptional()
  @Length(6, 50)
  name?: string;
  address?: string;
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
  @IsString()
  @IsOptional()
  province?: string;
  @IsString()
  @IsOptional()
  district?: string;
  @IsString()
  @IsOptional()
  ward?: string;
}

type CustomerUpdateProfileResponse = {
  name: string;
  address: string;
  avatarUrl: string;
  province?: string;
  district?: string;
  ward?: string;
};

class CustomerUpdateProfileUsecase extends BaseUsecase {
  async execute(cmd: CustomerUpdateProfileCommand): Promise<CustomerUpdateProfileResponse> {
    let { customerId, name, address, avatarUrl, province, district, ward } = cmd;

    // find customer
    const customer = await CustomerModel.findById(customerId);
    if (!customer) throw new ForbiddenError(t("Tài khoản không tồn tại"));

    // update customer
    await customer.updateOne({
      $set: { name, address, avatarUrl, province, district, ward },
    });
    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      "Cập nhật tài khoản",
      `Bạn đã cập nhật tài khoản thành công `
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return {
      name,
      address,
      avatarUrl,
    };
  }
}

export const customerUpdateProfileUsecase = new CustomerUpdateProfileUsecase();
