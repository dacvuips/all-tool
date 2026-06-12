import { IsNotEmpty, Min } from "class-validator";

import { CONSTANTS } from "../../../../constants/constant.const";
import { increaseCustomerTryOnLimit } from "../../../../graphql/modules/guest/guest.helper";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import { MainConnection } from "../../../../helpers/mongo";
import { OrderCode } from "../../../../packages/order-code";
import { BaseCommand, BaseUsecase } from "../../../core";
import { ForbiddenError } from "../../../core/errors";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { OrderStatusEnum, OrderTypeEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { pubsub } from "../../../graphql/pub-sub";
import { paidNormalOrderUsecase } from "./paidNormalOrder.usecase";

export class PaidOrderBySepayCommand extends BaseCommand {
  @IsNotEmpty()
  id: number; // ID giao dịch trên SePay
  @IsNotEmpty()
  gateway: string; // Brand name của ngân hàng
  @IsNotEmpty()
  transactionDate: string; // Thời gian xảy ra giao dịch phía ngân hàng
  @IsNotEmpty()
  accountNumber: string; // Số tài khoản ngân hàng
  code?: string; // Mã code thanh toán
  @IsNotEmpty()
  content: string; // Nội dung chuyển khoản
  @IsNotEmpty()
  transferType: string; // Loại giao dịch (in/out)
  @Min(0)
  transferAmount: number; // Số tiền giao dịch
  accumulated?: number; // Số dư tài khoản (lũy kế)
  subAccount?: string; // Tài khoản ngân hàng phụ
  referenceCode?: string; // Mã tham chiếu của tin nhắn SMS
  description?: string; // Toàn bộ nội dung tin nhắn SMS
}

type PaidOrderBySepayResponse = {
  success: boolean;
};

class PaidOrderBySepayUsecase extends BaseUsecase {
  async execute(command: PaidOrderBySepayCommand): Promise<PaidOrderBySepayResponse> {
    // record transaction
    await MainConnection.collection("sepay_transactions").insertOne(command);

    const orderNumber = this.matchOrderCode(command.content);
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

    // check order amount and amount from Sepay
    if (command.transferAmount < order.totalAmount) {
      throw new ForbiddenError(t("Số tiền chuyển khoản không đúng với số tiền đơn hàng"));
    }

    if (order.type === OrderTypeEnum.NORMAL) {
      return paidNormalOrderUsecase.execute(order, {
        amount: command.transferAmount,
        transactionId: command.id.toString(),
        metaData: {
          id: command.id,
          gateway: command.gateway,
          transactionDate: command.transactionDate,
          accountNumber: command.accountNumber,
          code: command.code,
          content: command.content,
          transferType: command.transferType,
          transferAmount: command.transferAmount,
          accumulated: command.accumulated,
          subAccount: command.subAccount,
          referenceCode: command.referenceCode,
          description: command.description,
        },
      });
    }

    // update order status
    const orderUpdated = await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PAYMENT_UPDATED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          "paymentInfo.metaData": {
            id: command.id,
            gateway: command.gateway,
            transactionDate: command.transactionDate,
            accountNumber: command.accountNumber,
            code: command.code,
            content: command.content,
            transferType: command.transferType,
            transferAmount: command.transferAmount,
            accumulated: command.accumulated,
            subAccount: command.subAccount,
            referenceCode: command.referenceCode,
            description: command.description,
          },
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PAYMENT_CONFIRMED,
            des: "Đơn hàng đã được thanh toán",
            createdAt: new Date(),
          },
          paymentLogs: {
            status: PaymentStatus.PAYMENT_SUCCESS,
            des: "Thanh toán thành công",
            amount: command.transferAmount,
            transactionId: command.id.toString(),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
    // update order status processing
    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PROCESSING,
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PROCESSING,
            des: "Đơn hàng đang được xử lý",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!!order.customerId) {
      // Tạo thông báo thanh toán
      const customerNotify = new NotificationBuilder(
        "Đơn hàng đã được thanh toán",
        `Hệ thống đã nhận được thông tin chuyển khoản từ bạn và đang tiến hành xử lý cho đơn hàng ${order.orderNumber}`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();

      // Tạo thông báo đơn thành công
      const successNotify = new NotificationBuilder(
        "Nạp gói thành công",
        `Đơn hàng ${order.orderNumber} đã được xử lý thành công. Bạn đã được cộng ${order.totalAmount} credit vào tài khoản.`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();

      InsertNotification([customerNotify, successNotify]);
      await increaseCustomerTryOnLimit(order.customerId.toString(), 15);
    }

    // Bắn socket thông báo cập nhật đơn hàng nếu có
    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: orderUpdated?.paymentStatus },
    });

    return { success: true };
  }

  private matchOrderCode(description: string) {
    return OrderCode.getOrderCodeFromText(description);
  }
}

export const paidOrderBySepayUsecase = new PaidOrderBySepayUsecase();
