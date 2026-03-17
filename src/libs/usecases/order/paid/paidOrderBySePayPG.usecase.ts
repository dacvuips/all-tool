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
import {
  SePayPGIPNPayload,
  SePayPGNotificationType,
  SePayPGOrderStatus,
} from "../../../../services/sepayPG/sepayPG.service";

/**
 * Command chứa payload IPN từ SePay PG
 */
export class PaidOrderBySePayPGCommand extends BaseCommand {
  @IsNotEmpty()
  timestamp: number; // Unix timestamp khi SePay gửi thông báo

  @IsNotEmpty()
  notification_type: SePayPGNotificationType;

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
 * UseCase xử lý IPN (Instant Payment Notification) từ SePay Payment Gateway.
 *
 * Hỗ trợ 2 loại thông báo:
 *  - ORDER_PAID       : Thanh toán thành công → cập nhật đơn + cộng credit
 *  - TRANSACTION_VOID : Huỷ giao dịch        → cập nhật đơn + thu hồi credit nếu đã cộng
 */
class PaidOrderBySePayPGUsecase extends BaseUsecase {
  async execute(command: PaidOrderBySePayPGCommand): Promise<PaidOrderBySePayPGResponse> {
    // ── Audit log ────────────────────────────────────────────────────────
    await MainConnection.collection("sepay_pg_transactions").insertOne({
      ...command,
      processedAt: new Date(),
    });

    const { notification_type } = command;

    if (notification_type === SePayPGNotificationType.ORDER_PAID) {
      return this._handleOrderPaid(command);
    }

    if (notification_type === SePayPGNotificationType.TRANSACTION_VOID) {
      return this._handleTransactionVoid(command);
    }

    // Loại thông báo không xử lý → bỏ qua, trả về 200 để SePay không retry
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER_PAID: Thanh toán thành công
  // ─────────────────────────────────────────────────────────────────────────
  private async _handleOrderPaid(command: PaidOrderBySePayPGCommand): Promise<PaidOrderBySePayPGResponse> {
    const { order_invoice_number, order_status } = command.order;
    const { transaction_id, transaction_amount, payment_method } = command.transaction;

    // Validate: SePay phải báo trạng thái CAPTURED
    if (order_status !== SePayPGOrderStatus.CAPTURED) {
      throw new ForbiddenError(t(`ORDER_PAID nhưng order_status không phải CAPTURED: ${order_status}`));
    }

    // Tìm đơn hàng theo orderNumber (= order_invoice_number)
    const order = await OrderModel.findOne({ orderNumber: order_invoice_number }).orFail(
      new ForbiddenError(t(`Không tìm thấy đơn hàng với invoice number: ${order_invoice_number}`))
    );

    // Idempotency: đã thanh toán thành công trước đó → bỏ qua, không xử lý lại
    if (order.paymentStatus === PaymentStatus.PAYMENT_SUCCESS) {
      return { success: true };
    }

    // Validate: đơn phải đang ở trạng thái chờ thanh toán
    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new ForbiddenError(
        t(`Đơn hàng không ở trạng thái PAYMENT_PENDING (hiện tại: ${order.paymentStatus})`)
      );
    }

    // Validate: số tiền thanh toán phải >= tổng đơn hàng
    const sePayAmount = Number(transaction_amount);
    if (sePayAmount < order.totalAmount) {
      throw new ForbiddenError(
        t(`Số tiền thanh toán (${sePayAmount}) không đủ so với đơn hàng (${order.totalAmount})`)
      );
    }

    // ── Cập nhật đơn hàng: thanh toán thành công ─────────────────────────
    const orderUpdated = await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PAYMENT_UPDATED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          paidAt: new Date(),
          "paymentInfo.metaData": {
            sePayOrderId: command.order.order_id,
            orderInvoiceNumber: order_invoice_number,
            orderStatus: order_status,
            transactionId: transaction_id,
            transactionDate: command.transaction.transaction_date,
            transactionStatus: command.transaction.transaction_status,
            transactionAmount: transaction_amount,
            paymentMethod: payment_method,
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
            des: `Thanh toán thành công qua SePay PG - ${payment_method}`,
            amount: sePayAmount,
            transactionId: transaction_id,
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // Chuyển trạng thái đơn sang PROCESSING
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

    // ── Cộng credit cho khách hàng ────────────────────────────────────────
    if (order.customerId && order.creditAmount > 0) {
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

    // ── Thông báo & real-time event ───────────────────────────────────────
    if (order.customerId) {
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

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: orderUpdated?.paymentStatus },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSACTION_VOID: Huỷ giao dịch
  // ─────────────────────────────────────────────────────────────────────────
  private async _handleTransactionVoid(command: PaidOrderBySePayPGCommand): Promise<PaidOrderBySePayPGResponse> {
    const { order_invoice_number } = command.order;
    const { transaction_id } = command.transaction;

    // Tìm đơn hàng
    const order = await OrderModel.findOne({ orderNumber: order_invoice_number });
    if (!order) {
      // Không tìm thấy đơn → bỏ qua (có thể đơn chưa sync hoặc đã xoá)
      return { success: true };
    }

    // Idempotency: đơn đã bị huỷ trước đó → bỏ qua
    if (
      order.paymentStatus === PaymentStatus.PAYMENT_CANCELLED ||
      order.status === OrderStatusEnum.CANCELLED
    ) {
      return { success: true };
    }

    // Ghi nhớ xem đơn đã được thanh toán thành công chưa (để thu hồi credit)
    const wasAlreadyPaid = order.paymentStatus === PaymentStatus.PAYMENT_SUCCESS;

    // ── Cập nhật đơn hàng: huỷ giao dịch ────────────────────────────────
    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.CANCELLED,
          paymentStatus: PaymentStatus.PAYMENT_CANCELLED,
          cancelledAt: new Date(),
          "paymentInfo.metaData.voidTransactionId": transaction_id,
          "paymentInfo.metaData.voidedAt": new Date(),
          "paymentInfo.metaData.voidIpnTimestamp": command.timestamp,
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.CANCELLED,
            des: "Giao dịch SePay PG bị huỷ (TRANSACTION_VOID)",
            meta: { transactionId: transaction_id },
            createdAt: new Date(),
          } as any,
          paymentLogs: {
            status: PaymentStatus.PAYMENT_CANCELLED,
            des: `Giao dịch bị huỷ qua SePay PG - ${command.transaction.payment_method}`,
            transactionId: transaction_id,
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // ── Thu hồi credit nếu đơn đã được cộng credit trước đó ──────────────
    if (wasAlreadyPaid && order.customerId && order.creditAmount > 0) {
      const customer = await CustomerModel.findByIdAndUpdate(
        order.customerId,
        { $inc: { creditBalance: -order.creditAmount } },
        { new: true }
      );

      if (customer) {
        const balanceAfter = (customer as any).creditBalance ?? 0;
        await creditTransactionService.create({
          customerId: order.customerId.toString(),
          type: CreditTransactionTypeEnum.ORDER_VOID,
          amount: order.creditAmount,
          balanceAfter,
          orderId: order._id.toString(),
          description: `Thu hồi ${order.creditAmount} credit từ đơn hàng ${order.orderNumber} do giao dịch SePay PG bị void`,
        });
      }
    }

    // ── Thông báo & real-time event ───────────────────────────────────────
    if (order.customerId) {
      const customerNotify = new NotificationBuilder(
        "Giao dịch bị huỷ",
        `Giao dịch SePay PG cho đơn hàng ${order.orderNumber} đã bị huỷ`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();
      InsertNotification([customerNotify]);
    }

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: PaymentStatus.PAYMENT_CANCELLED },
    });

    return { success: true };
  }
}

export const paidOrderBySePayPGUsecase = new PaidOrderBySePayPGUsecase();
