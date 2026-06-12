import { CONSTANTS } from "../../../../constants/constant.const";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import { startSession } from "../../../../helpers/mongo";
import { ForbiddenError } from "../../../core/errors";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { IOrder, OrderStatusEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { walletService } from "../../../dal/wallet";
import { pubsub } from "../../../graphql/pub-sub";
import { GetWalletInfo } from "../../wallet";
import { WalletTransactionBuilder } from "../../wallet/wallet-transaction.builder";

export type NormalOrderPaymentMeta = {
  transactionId?: string;
  amount: number;
  metaData?: Record<string, unknown>;
};

type PaidNormalOrderResponse = {
  success: boolean;
};

/**
 * Xử lý thanh toán thành công cho đơn NORMAL (nạp mPoint qua chuyển khoản).
 * - Cập nhật trạng thái đơn
 * - Cộng mPoint vào ví
 * - Tạo giao dịch ví
 * - Gửi thông báo
 */
class PaidNormalOrderUsecase {
  /** Cộng mPoint, tạo giao dịch ví và gửi thông báo (dùng chung cho BANK và SePay PG). */
  async fulfillMpointCredit(order: IOrder): Promise<void> {
    const mpointAmount = order.creditAmount ?? order.totalAmount;
    const customerId = order.customerId?.toString();

    if (!customerId || mpointAmount <= 0) return;

    const wallet = await GetWalletInfo.usecase.execute({ ownerId: customerId });
    const session = await startSession();

    try {
      await session.withTransaction(async () => {
        await walletService.createTransaction({
          transaction: new WalletTransactionBuilder(wallet)
            .depositFromOrder({
              amount: mpointAmount,
              description: t(`Nạp mPoint từ đơn hàng ${order.orderNumber}`),
              orderId: order._id.toString(),
              orderCode: order.orderNumber,
            })
            .build(),
          session,
        });
      });
    } finally {
      await session.endSession();
    }

    const receivedNotify = new NotificationBuilder(
      t("Thanh toán thành công"),
      t(
        `Hệ thống đã nhận thanh toán cho đơn ${order.orderNumber}. Bạn được cộng ${mpointAmount.toLocaleString("vi-VN")} mPoint.`
      )
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .order(order._id.toString())
      .build();

    const walletNotify = new NotificationBuilder(
      t("Nạp mPoint thành công"),
      t(
        `Số dư mPoint của bạn đã được cộng ${mpointAmount.toLocaleString("vi-VN")} điểm từ đơn nạp tiền ${order.orderNumber}.`
      )
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .wallet()
      .build();

    InsertNotification([receivedNotify, walletNotify]);

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: PaymentStatus.PAYMENT_SUCCESS },
    });
  }

  async execute(
    order: IOrder,
    paymentMeta: NormalOrderPaymentMeta
  ): Promise<PaidNormalOrderResponse> {
    if (order.paymentStatus === PaymentStatus.PAYMENT_SUCCESS) {
      return { success: true };
    }

    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new ForbiddenError(t("Đơn hàng không ở trạng thái chờ thanh toán"));
    }

    if (paymentMeta.amount < order.totalAmount) {
      throw new ForbiddenError(t("Số tiền chuyển khoản không đúng với số tiền đơn hàng"));
    }

    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.CONFIRMED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          paidAt: new Date(),
          ...(paymentMeta.metaData
            ? { "paymentInfo.metaData": paymentMeta.metaData }
            : {}),
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PAYMENT_CONFIRMED,
            des: t("Nạp mPoint thành công"),
            createdAt: new Date(),
          },
          paymentLogs: {
            status: PaymentStatus.PAYMENT_SUCCESS,
            des: t("Thanh toán thành công"),
            amount: paymentMeta.amount,
            transactionId: paymentMeta.transactionId,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    await this.fulfillMpointCredit(order);

    return { success: true };
  }
}

export const paidNormalOrderUsecase = new PaidNormalOrderUsecase();
