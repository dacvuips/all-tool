import { t } from "../../../helpers/functions/string";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { trendingService } from "../../dal/trending";
import { trendingPurchaseOrderService } from "../../dal/trending-purchase-order";

export namespace CheckTrendingAccess {
  export class Command extends BaseCommand {
    @IsObjectId()
    customerId: string;

    @IsObjectId()
    trendingId: string;
  }

  export type AccessResult = {
    /** Customer được phép lấy prompt / dùng item */
    hasAccess: boolean;
    /** Là chủ sở hữu item → miễn phí */
    isOwner: boolean;
    /** Item miễn phí (price = 0) */
    isFree: boolean;
    /** Đã có đơn PAID */
    hasPaidOrder: boolean;
    /** ID đơn PAID (nếu có) */
    orderId?: string;
    /** Document trending */
    trending: any;
  };

  class CheckTrendingAccessUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<AccessResult> {
      const { customerId, trendingId } = cmd;

      const trending = await trendingService.findOne({ _id: trendingId });
      if (!trending) {
        throw new ForbiddenError(t("Không tìm thấy item"));
      }

      const doc = (trending as any)._doc || trending;
      const ownerId = doc.customerId?.toString();
      const isOwner = !!ownerId && ownerId === customerId?.toString();
      const price = doc.price || 0;
      const isFree = price <= 0;

      if (isOwner || isFree) {
        return {
          hasAccess: true,
          isOwner,
          isFree,
          hasPaidOrder: false,
          trending: doc,
        };
      }

      const paidOrder = await trendingPurchaseOrderService.findPaidOrder(customerId, trendingId);
      const hasPaidOrder = !!paidOrder;

      return {
        hasAccess: hasPaidOrder,
        isOwner: false,
        isFree: false,
        hasPaidOrder,
        orderId: paidOrder?._id?.toString(),
        trending: doc,
      };
    }
  }

  /** Helper nhanh: throw nếu chưa có quyền truy cập */
  export async function requireAccess(customerId: string, trendingId: string) {
    const result = await usecase.execute(
      Command.create({ customerId, trendingId } as Command)
    );
    if (!result.hasAccess) {
      throw new ForbiddenError(
        t("Bạn chưa mua item này. Vui lòng thanh toán trước khi sử dụng.")
      );
    }
    return result;
  }

  export const usecase = new CheckTrendingAccessUsecase();
}
