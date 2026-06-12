import { IsNotEmpty } from "class-validator";

import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { startSession } from "../../../helpers/mongo";
import { IsObjectId } from "../../../packages/class-validator";
import { ObjectId } from "../../../packages/object-id";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import {
  TrendingPurchaseOrderModel,
  TrendingPurchaseOrderStatusEnum,
  trendingPurchaseOrderService,
} from "../../dal/trending-purchase-order";
import { walletService } from "../../dal/wallet";
import { GetWalletInfo } from "../wallet/get-wallet-info.usecase";
import { WalletTransactionBuilder } from "../wallet/wallet-transaction.builder";
import { CheckTrendingAccess } from "./check-trending-access.usecase";

export namespace UseTrendingItem {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    customerId: string;

    @IsObjectId()
    @IsNotEmpty()
    trendingId: string;
  }

  export type UseTrendingItemResponse = {
    id: string;
    prompt: string;
    orderId: string | null;
    alreadyOwned: boolean;
    charged: boolean;
    chargedAmount: number;
  };

  class UseTrendingItemUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<UseTrendingItemResponse> {
      const { customerId, trendingId } = cmd;

      const access = await CheckTrendingAccess.usecase.execute(
        CheckTrendingAccess.Command.create({ customerId, trendingId } as CheckTrendingAccess.Command)
      );
      const doc = access.trending;
      const prompt = doc.prompt || "";

      // Owner hoặc item miễn phí → dùng ngay, không tạo đơn
      if (access.isOwner || access.isFree) {
        return {
          id: trendingId,
          prompt,
          orderId: access.orderId || null,
          alreadyOwned: true,
          charged: false,
          chargedAmount: 0,
        };
      }

      // Đã mua trước đó → dùng ngay, không trừ tiền thêm (one-time purchase)
      if (access.hasPaidOrder) {
        return {
          id: trendingId,
          prompt,
          orderId: access.orderId || null,
          alreadyOwned: true,
          charged: false,
          chargedAmount: 0,
        };
      }

      const price = doc.price || 0;
      if (price <= 0) {
        return {
          id: trendingId,
          prompt,
          orderId: null,
          alreadyOwned: true,
          charged: false,
          chargedAmount: 0,
        };
      }

      const wallet = await GetWalletInfo.usecase.execute({ ownerId: customerId });
      if (wallet.balance < price) {
        throw new ForbiddenError(t("mPoint không đủ. Vui lòng nạp thêm mPoint."));
      }

      const purchaseOrderId = ObjectId().toString();
      const itemName = doc.name || "Trending item";
      const session = await startSession();

      try {
        await session.withTransaction(async () => {
          // Tạo đơn PAID trước (unique index chống double-charge)
          const [order] = await TrendingPurchaseOrderModel.create(
            [
              {
                _id: purchaseOrderId,
                customerId,
                trendingId,
                trendingType: doc.type,
                price,
                itemName,
                status: TrendingPurchaseOrderStatusEnum.PAID,
                paidAt: new Date(),
              },
            ],
            { session }
          );

          const transaction = new WalletTransactionBuilder(wallet)
            .buyTrendingItem({
              amount: price,
              description: `Mua "${itemName}" – ${price} mPoint`,
              trendingId,
              purchaseOrderId: order._id.toString(),
            })
            .build();

          const updatedWallet = await walletService.createTransaction({
            transaction,
            session,
          });

          if (!updatedWallet) {
            throw new ForbiddenError(t("Giao dịch không thành công. Vui lòng thử lại"));
          }

          const walletTransactionId = transaction._id?.toString();
          await TrendingPurchaseOrderModel.findByIdAndUpdate(
            order._id,
            { $set: { walletTransactionId } },
            { session }
          );
        });
      } catch (err: any) {
        // Race condition: request song song → đơn PAID đã tồn tại
        if (err?.code === 11000) {
          const existing = await trendingPurchaseOrderService.findPaidOrder(
            customerId,
            trendingId
          );
          if (existing) {
            return {
              id: trendingId,
              prompt,
              orderId: existing._id.toString(),
              alreadyOwned: true,
              charged: false,
              chargedAmount: 0,
            };
          }
        }
        throw err;
      } finally {
        session.endSession();
      }

      // Thông báo trừ mPoint cho customer
      const customerNotify = new NotificationBuilder(
        "Thanh toán item thành công",
        `Bạn đã mua "${itemName}" với giá ${price} mPoint. Bạn có thể dùng item này không giới hạn.`
      )
        .sendTo(NotificationTarget.CUSTOMER, customerId)
        .wallet(wallet._id?.toString())
        .build();
      InsertNotification([customerNotify]);

      return {
        id: trendingId,
        prompt,
        orderId: purchaseOrderId,
        alreadyOwned: false,
        charged: true,
        chargedAmount: price,
      };
    }
  }

  export const usecase = new UseTrendingItemUsecase();
}
