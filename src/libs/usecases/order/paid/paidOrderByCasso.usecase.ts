import { IsNotEmpty, Min } from "class-validator";

import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../../helpers/functions/string";
import { MainConnection } from "../../../../helpers/mongo";
import { OrderCode } from "../../../../packages/order-code";
import { BaseCommand, BaseUsecase } from "../../../core";
import { ForbiddenError } from "../../../core/errors";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { OrderStatusEnum, OrderTypeEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { paidNormalOrderUsecase } from "./paidNormalOrder.usecase";

export class PaidOrderByCassoCommand extends BaseCommand {
  @IsNotEmpty()
  cassoId: string; // Mã giao dịch casso
  @IsNotEmpty()
  bankId: string; // Mã ngân hàng
  @IsNotEmpty()
  bankTransId: string; // Mã giao dịch ngân hàng
  @IsNotEmpty()
  description: string; // Nội dung chuyển khoản
  @Min(0)
  amount: number; // Số tiền chuyển khoản
  corresponsiveName?: string; // Tên người nhận
  corresponsiveAccount?: string; // Số tài khoản người nhận
  corresponsiveBankId?: string; // Mã ngân hàng người nhận
  corresponsiveBankName?: string; // Tên ngân hàng người nhận
  bankName?: string; // Tên ngân hàng
  subAccId?: string; // Mã tài khoản con
}

type PaidOrderByCassoResponse = {
  success: boolean;
};

class PaidOrderByCassoUsecase extends BaseUsecase {
  async execute(command: PaidOrderByCassoCommand): Promise<PaidOrderByCassoResponse> {
    // record transaction
    await MainConnection.collection("casso_transactions").insertOne(command);

    const orderNumber = this.matchOrderCode(command.description);
    // filter is paid for order transaction by description
    if (!orderNumber) {
      throw new ForbiddenError(t("Không tìm thấy mã đơn hàng"));
    }

    // find order
    const order = await OrderModel.findOne({ orderNumber }).orFail(
      new ForbiddenError(t("Không tìm thấy đơn hàng"))
    );

    // check order status is created
    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new ForbiddenError(t("Đơn hàng không ở trạng thái chờ thanh toán"));
    }

    // check order amount and amount from casso
    if (command.amount < order.totalAmount) {
      throw new ForbiddenError(t("Số tiền chuyển khoản không đúng với số tiền đơn hàng"));
    }

    if (order.type === OrderTypeEnum.NORMAL) {
      return paidNormalOrderUsecase.execute(order, {
        amount: command.amount,
        transactionId: command.cassoId,
        metaData: {
          cassoId: command.cassoId,
          bankId: command.bankId,
          bankTransId: command.bankTransId,
          description: command.description,
          amount: command.amount,
          corresponsiveName: command.corresponsiveName,
          corresponsiveAccount: command.corresponsiveAccount,
          corresponsiveBankId: command.corresponsiveBankId,
          corresponsiveBankName: command.corresponsiveBankName,
          bankName: command.bankName,
          subAccId: command.subAccId,
        },
      });
    }

    // update order status
    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PAYMENT_UPDATED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          "paymentInfo.metaData": {
            cassoId: command.cassoId,
            bankId: command.bankId,
            bankTransId: command.bankTransId,
            description: command.description,
            amount: command.amount,
            corresponsiveName: command.corresponsiveName,
            corresponsiveAccount: command.corresponsiveAccount,
            corresponsiveBankId: command.corresponsiveBankId,
            corresponsiveBankName: command.corresponsiveBankName,
            bankName: command.bankName,
            subAccId: command.subAccId,
          },
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PAYMENT_UPDATED,
            des: "Đơn hàng đã được cập nhật thanh toán",
            createdAt: new Date(),
          },
          paymentLogs: {
            status: PaymentStatus.PAYMENT_SUCCESS,
            des: "Thanh toán thành công",
            amount: command.amount,
            transactionId: command.cassoId,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!!order.customerId) {
      // Tạo thông báo
      const customerNotify = new NotificationBuilder(
        "Đang xử lý xuất thẻ",
        `Hệ thống đã nhận được thông tin chuyển khoản từ bạn và đang tiến hành xử lý xuất thẻ cho bạn`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();
      InsertNotification([customerNotify]);
    }

    return { success: true };
  }

  private matchOrderCode(description: string) {
    return OrderCode.getOrderCodeFromText(description);
  }
}

export const paidOrderByCassoUsecase = new PaidOrderByCassoUsecase();
