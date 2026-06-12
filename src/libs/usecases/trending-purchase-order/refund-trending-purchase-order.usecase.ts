import { IsNotEmpty } from "class-validator";

import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { startSession } from "../../../helpers/mongo";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import {
  TrendingPurchaseOrderModel,
  TrendingPurchaseOrderStatusEnum,
} from "../../dal/trending-purchase-order";
import { walletService } from "../../dal/wallet";
import { GetWalletInfo } from "../wallet/get-wallet-info.usecase";
import { WalletTransactionBuilder } from "../wallet/wallet-transaction.builder";

export namespace RefundTrendingPurchaseOrder {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    orderId: string;

    @IsObjectId()
    @IsNotEmpty()
    adminUserId: string;

    @IsNotEmpty()
    reason: string;
  }

  class RefundTrendingPurchaseOrderUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { orderId, adminUserId, reason } = cmd;

      const order = await TrendingPurchaseOrderModel.findById(orderId);
      if (!order) {
        throw new ForbiddenError(t("Không tìm thấy đơn mua"));
      }

      if (order.status !== TrendingPurchaseOrderStatusEnum.PAID) {
        throw new ForbiddenError(t("Đơn này không ở trạng thái đã thanh toán, không thể hoàn tiền"));
      }

      const customerId = order.customerId.toString();
      const price = order.price || 0;

      const session = await startSession();

      try {
        await session.withTransaction(async () => {
          if (price > 0) {
            const wallet = await GetWalletInfo.usecase.execute({ ownerId: customerId });
            const updatedWallet = await walletService.createTransaction({
              transaction: new WalletTransactionBuilder(wallet)
                .refundTrendingItem({
                  amount: price,
                  description: `Hoàn tiền mua "${order.itemName}" – ${reason}`,
                  trendingId: order.trendingId.toString(),
                  purchaseOrderId: order._id.toString(),
                })
                .build(),
              session,
            });

            if (!updatedWallet) {
              throw new ForbiddenError(t("Hoàn tiền không thành công. Vui lòng thử lại"));
            }
          }

          await TrendingPurchaseOrderModel.findByIdAndUpdate(
            order._id,
            {
              $set: {
                status: TrendingPurchaseOrderStatusEnum.REFUNDED,
                refundedAt: new Date(),
                refundReason: reason,
                refundedByUserId: adminUserId,
              },
            },
            { session }
          );
        });
      } finally {
        session.endSession();
      }

      const customerNotify = new NotificationBuilder(
        "Hoàn tiền item",
        price > 0
          ? `Đơn mua "${order.itemName}" đã được hoàn ${price} mPoint. Lý do: ${reason}`
          : `Quyền sử dụng "${order.itemName}" đã bị thu hồi. Lý do: ${reason}`
      )
        .sendTo(NotificationTarget.CUSTOMER, customerId)
        .build();
      InsertNotification([customerNotify]);

      return { success: true, orderId: order._id.toString() };
    }
  }

  export const usecase = new RefundTrendingPurchaseOrderUsecase();
}
