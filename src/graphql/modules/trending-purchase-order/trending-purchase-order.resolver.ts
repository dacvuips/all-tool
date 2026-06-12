import { TOKEN_ROLES } from "../../../constants/role.const";
import { trendingPurchaseOrderService } from "../../../libs/dal/trending-purchase-order";
import { Context } from "../../../libs/graphql";
import { RefundTrendingPurchaseOrder } from "../../../libs/usecases/trending-purchase-order/refund-trending-purchase-order.usecase";
import { UseTrendingItem } from "../../../libs/usecases/trending-purchase-order/use-trending-item.usecase";

const Query = {
  getAllTrendingPurchaseOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return trendingPurchaseOrderService.fetch(args.q);
  },
  getOneTrendingPurchaseOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return trendingPurchaseOrderService.findOne({ _id: id });
  },
  getMyTrendingPurchases: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const customerId = context.id;
    const { trendingIds } = args;

    if (!trendingIds?.length) return [];

    const orders = await trendingPurchaseOrderService.findPaidOrdersByTrendingIds(
      customerId,
      trendingIds
    );

    return orders.map((order: any) => ({
      trendingId: order.trendingId?.toString(),
      orderId: order._id?.toString(),
      status: order.status,
      paidAt: order.paidAt,
      price: order.price,
    }));
  },
};

const Mutation = {
  useTrendingItem: async (root: any, args: any, context: Context) => {
    context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { trendingId } = args;
    const customerId = context.id;

    const command = UseTrendingItem.Command.create({
      customerId,
      trendingId,
    } as UseTrendingItem.Command);
    return UseTrendingItem.usecase.execute(command);
  },
  refundTrendingPurchaseOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { orderId, reason } = args;

    const command = RefundTrendingPurchaseOrder.Command.create({
      orderId,
      adminUserId: context.id,
      reason,
    } as RefundTrendingPurchaseOrder.Command);
    return RefundTrendingPurchaseOrder.usecase.execute(command);
  },
};

export default {
  Query,
  Mutation,
};
