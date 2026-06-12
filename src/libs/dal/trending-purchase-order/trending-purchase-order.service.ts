import { CRUDService } from "../../../base/crudService";
import { TrendingPurchaseOrderModel } from "./trending-purchase-order.model";
import { TrendingPurchaseOrderStatusEnum } from "./trending-purchase-order.interface";

class TrendingPurchaseOrderService extends CRUDService(TrendingPurchaseOrderModel) {
  /** Lấy đơn PAID của customer cho 1 trending item */
  findPaidOrder(customerId: string, trendingId: string) {
    return TrendingPurchaseOrderModel.findOne({
      customerId,
      trendingId,
      status: TrendingPurchaseOrderStatusEnum.PAID,
    });
  }

  /** Batch lấy đơn PAID cho nhiều trending item (phục vụ UI list) */
  findPaidOrdersByTrendingIds(customerId: string, trendingIds: string[]) {
    if (!trendingIds?.length) return Promise.resolve([]);
    return TrendingPurchaseOrderModel.find({
      customerId,
      trendingId: { $in: trendingIds },
      status: TrendingPurchaseOrderStatusEnum.PAID,
    }).lean();
  }
}

const trendingPurchaseOrderService = new TrendingPurchaseOrderService();

export { trendingPurchaseOrderService };
