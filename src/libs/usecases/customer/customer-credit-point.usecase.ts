import { ForbiddenError } from "apollo-server-core";
import { IsNotEmpty } from "class-validator";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { CustomerModel, ICustomer } from "../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../dal/notification";

export namespace CustomerCreditPoint {
  export class Command extends BaseCommand {
    @IsNotEmpty()
    @IsObjectId()
    customerId: string;
    @IsNotEmpty()
    action: "add" | "sub";

    @IsNotEmpty()
    point: number;
    @IsNotEmpty()
    updaterId: string;
  }
  class CustomerCreditPointUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { customerId, action, point } = cmd;
      const customer = await CustomerModel.findById(customerId).orFail(
        new ForbiddenError(t("Không tìm thấy khách hàng"))
      );
      const calculate = this.calculatePoint({ customer, action, point });
      const customerNotify = new NotificationBuilder(
        "Cập nhật điểm uy tín khách hàng",
        `Bạn đã cập nhật điểm uy tín khách hàng thành công, giá trị cũ:[ ${
          customer.creditBalance
        } ] | giá trị đổi: [${action === "add" ? "+" : "-"} ${point} ] [=${calculate}]`
      )
        .sendTo(NotificationTarget.CUSTOMER, cmd.updaterId)
        .account()
        .build();
      InsertNotification([customerNotify]);
      if (action === "add") {
        customer.creditBalance += point;
        if (customer.creditBalance > 100) {
          customer.creditBalance = 100;
        }
      } else {
        customer.creditBalance -= point;
        if (customer.creditBalance < 0) {
          customer.creditBalance = 0;
        }
      }

      await customer.save();
      return { success: true };
    }
    calculatePoint({
      action,
      customer,
      point,
    }: {
      action: string;
      customer: ICustomer;
      point: number;
    }) {
      let creditPoint = customer.creditBalance;
      if (action === "add") {
        creditPoint += point;
        if (creditPoint > 100) {
          creditPoint = 100;
        }
      } else {
        creditPoint -= point;
        if (creditPoint < 0) {
          creditPoint = 0;
        }
      }
      return creditPoint;
    }
  }
  export const usecase = new CustomerCreditPointUsecase();
}
