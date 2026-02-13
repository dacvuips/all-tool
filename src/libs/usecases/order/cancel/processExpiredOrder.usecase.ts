import { CONSTANTS } from "../../../../constants/constant.const";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import { BaseUsecase, EnforceOrderCommand } from "../../../core";

import { OrderStatusEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { pubsub } from "../../../graphql/pub-sub";

export class ProcessExpiredOrderCommand extends EnforceOrderCommand {
  orderId: string;
}

type ProcessExpiredOrderResponse = {
  success: boolean;
};

class ProcessExpiredOrderUsecase extends BaseUsecase {
  async execute(cmd: ProcessExpiredOrderCommand): Promise<ProcessExpiredOrderResponse> {
    const { orderId } = cmd;

    // find order
    const order = await OrderModel.findById(orderId).orFail(
      new Error(t("Không tìm thấy đơn hàng"))
    );

    // check order status
    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new Error(t("Không thể hủy với trạng thái đơn hàng hiện tại "));
    }

    // update order status
    const newOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
      },
      {
        $set: {
          paymentStatus: PaymentStatus.PAYMENT_TIMEOUT,
          status: OrderStatusEnum.CANCELLED,
          cancelReason: "Order expired",
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.CANCELLED,
            des: "Hủy đơn hàng do quá thời gian thanh toán",
            createdAt: new Date(),
          },
          paymentLogs: {
            status: PaymentStatus.PAYMENT_TIMEOUT,
            des: "Đơn hàng đã quá thời gian thanh toán và bị hủy",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
    // tạo Subscription để thông báo hủy đơn hàng
    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: newOrder.paymentStatus },
    });

    // // Tạo thông báo
    // const customerNotify = new NotificationBuilder("Hủy đơn mua thẻ ", `Bạn đã huy đơn mua thẻ`)
    //   .sendTo(NotificationTarget.CUSTOMER, customerId)
    //   .order(orderId)
    //   .build();
    // InsertNotification([customerNotify]);

    return { success: true };
  }
}

export const processExpiredOrderUsecase = new ProcessExpiredOrderUsecase();
