import { IsNotEmpty, Min } from "class-validator";

import { CONSTANTS } from "../../../../constants/constant.const";
import { increaseCustomerTryOnLimit } from "../../../../graphql/modules/guest/guest.helper";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import logger from "../../../../helpers/logger";
import { MainConnection } from "../../../../helpers/mongo";
import { OrderCode } from "../../../../packages/order-code";
import { BaseCommand, BaseUsecase } from "../../../core";
import { ForbiddenError } from "../../../core/errors";
import {
  CreditTransactionTypeEnum,
  creditTransactionService,
} from "../../../dal/creditTransaction";
import { CustomerModel } from "../../../dal/customer";
import { IntroduceModel } from "../../../dal/introduce/introduce.model";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { OrderStatusEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import { pubsub } from "../../../graphql/pub-sub";

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

    if (!!order.customerId && order.totalAmount > 0) {
      const customer = await CustomerModel.findByIdAndUpdate(
        order.customerId,
        { $inc: { creditBalance: order.totalAmount } },
        { new: true }
      );

      if (!customer) {
        throw new ForbiddenError(t("Không tìm thấy khách hàng để cập nhật credit"));
      }

      const balanceAfter = (customer as any).creditBalance ?? 0;
      await creditTransactionService.create({
        customerId: order.customerId.toString(),
        type: CreditTransactionTypeEnum.ORDER_TOPUP,
        amount: order.totalAmount,
        balanceAfter,
        orderId: order._id.toString(),
        description: `Cộng ${order.totalAmount} credit từ thanh toán đơn hàng ${order.orderNumber}`,
      });
    }

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

    // === Hoa hồng giới thiệu: cộng 10% giá đơn cho người giới thiệu ===
    if (!!order.customerId && order.totalAmount > 0) {
      try {
        // Tìm bản ghi giới thiệu: người nạp đơn là refereeId
        const introduce = await IntroduceModel.findOne({
          refereeId: order.customerId,
          blocked: false,
        });

        if (introduce) {
          const referralBonus = Math.round(order.totalAmount * 0.1); // 10%
          const referrerId = introduce.referrerId.toString();

          // Cộng credit cho người giới thiệu
          const referrer = await CustomerModel.findByIdAndUpdate(
            referrerId,
            { $inc: { creditBalance: referralBonus } },
            { new: true }
          );

          if (referrer) {
            const balanceAfter = (referrer as any).creditBalance ?? 0;
            await creditTransactionService.create({
              customerId: referrerId,
              type: CreditTransactionTypeEnum.REFERRAL_BONUS,
              amount: referralBonus,
              balanceAfter,
              orderId: order._id.toString(),
              description: `Hoa hồng giới thiệu ${referralBonus} credit (10% đơn hàng ${order.orderNumber})`,
            });
          }

          // Thông báo cho người giới thiệu
          const referrerNotify = new NotificationBuilder(
            "Hoa hồng giới thiệu",
            `Bạn nhận được ${referralBonus} credit hoa hồng từ đơn hàng của người bạn giới thiệu`
          )
            .sendTo(NotificationTarget.CUSTOMER, referrerId)
            .build();
          InsertNotification([referrerNotify]);

          // Ghi thông tin đơn vào Introduce
          await IntroduceModel.findByIdAndUpdate(introduce._id, {
            $push: {
              orders: {
                orderId: order._id,
                discountPrice: referralBonus,
              },
            },
          });

          logger.info(`Đã cộng hoa hồng giới thiệu`, {
            referrerId,
            refereeId: order.customerId.toString(),
            orderId: order._id.toString(),
            referralBonus,
          });
        }
      } catch (err) {
        // Không để lỗi hoa hồng ảnh hưởng tới luồng thanh toán chính
        logger.error(`Lỗi khi xử lý hoa hồng giới thiệu`, {
          err,
          orderId: order._id.toString(),
          customerId: order.customerId.toString(),
        });
      }
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
