import { IsNotEmpty } from "class-validator";

import { CONSTANTS } from "../../../../constants/constant.const";
import { increaseCustomerTryOnLimit } from "../../../../graphql/modules/guest/guest.helper";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import { MainConnection } from "../../../../helpers/mongo";
import { BaseCommand, BaseUsecase } from "../../../core";
import { ForbiddenError } from "../../../core/errors";
import { CreditTransactionTypeEnum, creditTransactionService } from "../../../dal/creditTransaction";
import { CustomerModel } from "../../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { OrderStatusEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { pubsub } from "../../../graphql/pub-sub";
import { SePayPGIPNPayload } from "../../../../services/sepayPG/sepayPG.service";

/**
 * Command chứa payload IPN từ SePay PG
 */
export class PaidOrderBySePayPGCommand extends BaseCommand {
  @IsNotEmpty()
  timestamp: number; // Unix timestamp khi SePay gửi thông báo

  @IsNotEmpty()
  notification_type: string; // Loại thông báo: ORDER_PAID | TRANSACTION_VOID

  @IsNotEmpty()
  order: SePayPGIPNPayload["order"]; // Thông tin đơn hàng từ SePay

  @IsNotEmpty()
  transaction: SePayPGIPNPayload["transaction"]; // Thông tin giao dịch từ SePay

  customer: SePayPGIPNPayload["customer"]; // Thông tin khách hàng (có thể null)
}

type PaidOrderBySePayPGResponse = {
  success: boolean;
};

/**
 * UseCase xử lý IPN (Instant Payment Notification) từ SePay Payment Gateway
 * Được gọi khi SePay gửi thông báo giao dịch thành công về server
 */
class PaidOrderBySePayPGUsecase extends BaseUsecase {
  async execute(command: PaidOrderBySePayPGCommand): Promise<PaidOrderBySePayPGResponse> {
    // Lưu bản ghi IPN vào database để audit
    await MainConnection.collection("sepay_pg_transactions").insertOne({
      ...command,
      processedAt: new Date(),
    });

    // Chỉ xử lý thông báo thanh toán thành công
    if (command.notification_type !== "ORDER_PAID") {
      return { success: true };
    }

    const { order_invoice_number, order_amount, order_status } = command.order;

    // Kiểm tra trạng thái đơn từ SePay phải là CAPTURED (đã thanh toán)
    if (order_status !== "CAPTURED") {
      throw new ForbiddenError(t("Đơn hàng chưa được thanh toán trên SePay PG"));
    }

    // Tìm đơn hàng trong hệ thống theo orderNumber (chính là order_invoice_number)
    const order = await OrderModel.findOne({ orderNumber: order_invoice_number }).orFail(
      new ForbiddenError(t("Không tìm thấy đơn hàng"))
    );

    // Kiểm tra trạng thái thanh toán đơn hàng phải đang ở PAYMENT_PENDING
    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new ForbiddenError(t("Đơn hàng không ở trạng thái chờ thanh toán"));
    }

    // Kiểm tra số tiền thanh toán phải >= tổng đơn hàng
    const sePayAmount = Number(command.transaction.transaction_amount);
    if (sePayAmount < order.totalAmount) {
      throw new ForbiddenError(t("Số tiền thanh toán không đủ so với đơn hàng"));
    }

    // Cập nhật trạng thái đơn hàng: thanh toán thành công
    const orderUpdated = await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PAYMENT_UPDATED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          paidAt: new Date(),
          // Lưu metadata giao dịch từ SePay PG để tra cứu sau
          "paymentInfo.metaData": {
            sePayOrderId: command.order.order_id,
            orderInvoiceNumber: order_invoice_number,
            orderStatus: order_status,
            transactionId: command.transaction.transaction_id,
            transactionDate: command.transaction.transaction_date,
            transactionStatus: command.transaction.transaction_status,
            transactionAmount: command.transaction.transaction_amount,
            paymentMethod: command.transaction.payment_method,
            cardNumber: command.transaction.card_number,
            cardHolderName: command.transaction.card_holder_name,
            cardBrand: command.transaction.card_brand,
            ipnTimestamp: command.timestamp,
          },
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PAYMENT_CONFIRMED,
            des: "Đơn hàng đã được thanh toán qua SePay PG",
            createdAt: new Date(),
          } as any,
          paymentLogs: {
            status: PaymentStatus.PAYMENT_SUCCESS,
            des: `Thanh toán thành công qua SePay PG - ${command.transaction.payment_method}`,
            amount: sePayAmount,
            transactionId: command.transaction.transaction_id,
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // Chuyển trạng thái đơn sang PROCESSING (đang xử lý)
    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: { status: OrderStatusEnum.PROCESSING },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PROCESSING,
            des: "Đơn hàng đang được xử lý",
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // Nếu đơn có credit, cộng credit cho khách hàng
    if (!!order.customerId && order.creditAmount > 0) {
      const customer = await CustomerModel.findByIdAndUpdate(
        order.customerId,
        { $inc: { creditBalance: order.creditAmount } },
        { new: true }
      );

      if (!customer) {
        throw new ForbiddenError(t("Không tìm thấy khách hàng để cộng credit"));
      }

      const balanceAfter = (customer as any).creditBalance ?? 0;
      await creditTransactionService.create({
        customerId: order.customerId.toString(),
        type: CreditTransactionTypeEnum.ORDER_TOPUP,
        amount: order.creditAmount,
        balanceAfter,
        orderId: order._id.toString(),
        description: `Cộng ${order.creditAmount} credit từ đơn hàng ${order.orderNumber} qua SePay PG`,
      });
    }

    // Gửi thông báo đến khách hàng nếu có
    if (!!order.customerId) {
      const customerNotify = new NotificationBuilder(
        "Thanh toán thành công",
        `Hệ thống đã nhận được thanh toán qua SePay PG cho đơn hàng ${order.orderNumber}`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();
      InsertNotification([customerNotify]);
      await increaseCustomerTryOnLimit(order.customerId.toString(), 15);
    }

    // Phát sự kiện socket để frontend cập nhật real-time
    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: orderUpdated?.paymentStatus },
    });

    return { success: true };
  }
}

export const paidOrderBySePayPGUsecase = new PaidOrderBySePayPGUsecase();
