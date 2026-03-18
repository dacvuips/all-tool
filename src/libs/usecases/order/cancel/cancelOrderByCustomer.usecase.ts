import { CONSTANTS } from "../../../../constants/constant.const";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import { BaseUsecase } from "../../../core";
import { BaseCommand } from "../../../core/command/base.command";
import { OrderStatusEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { pubsub } from "../../../graphql/pub-sub";

export class CancelOrderByCustomerCommand extends BaseCommand {
  orderNumber: string;
}

type CancelOrderByCustomerResponse = {
  success: boolean;
};

class CancelOrderByCustomerUsecase extends BaseUsecase {
  async execute(cmd: CancelOrderByCustomerCommand): Promise<CancelOrderByCustomerResponse> {
    const { orderNumber } = cmd;

    const order = await OrderModel.findOne({ orderNumber }).orFail(
      new Error(t("Không tìm thấy đơn hàng"))
    );

    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING && order.paymentStatus !== PaymentStatus.PAYMENT_INITIATED) {
      throw new Error(t("Không thể hủy đơn hàng với trạng thái thanh toán hiện tại"));
    }

    const newOrder = await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          paymentStatus: PaymentStatus.PAYMENT_CANCELLED,
          status: OrderStatusEnum.CANCELLED,
          cancelReason: "Khách hàng hủy thanh toán",
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.CANCELLED,
            des: "Khách hàng hủy thanh toán tại cổng thanh toán",
            createdAt: new Date(),
          },
          paymentLogs: {
            status: PaymentStatus.PAYMENT_CANCELLED,
            des: "Khách hàng đã hủy thanh toán tại cổng thanh toán",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: newOrder.paymentStatus },
    });

    return { success: true };
  }
}

export const cancelOrderByCustomerUsecase = new CancelOrderByCustomerUsecase();
