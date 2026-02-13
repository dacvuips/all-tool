import { gql, withFilter } from "apollo-server-express";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { IOrder } from "../../../libs/dal/order/order.interface";
import { OrderLoader } from "../../../libs/dal/order/order.model";
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";

export enum OrderChangeEventEnum {
  CREATED = "created",
  UPDATED = "updated",
  CANCELLED = "cancelled",
  STATUS_CHANGED = "status_changed",
  PAYMENT_CHANGED = "payment_changed",
}
type OrderChange = {
  orderId: string;
  event: OrderChangeEventEnum;
  data: IOrder;
};

export default {
  schema: gql`
    extend type Subscription {
      orderChanged(orderId: String): OrderChange
    }

    type OrderChange {
      orderId: String
      event: String
      data: Mixed
    }
  `,
  resolver: {
    Subscription: {
      orderChanged: {
        resolve: (payload: any) => payload,
        subscribe: withFilter(
          (root: any, args: any, context: Context) => {
            //get cartSessionId from connectionParams (WebSocket) hoặc cookie (HTTP)
            const cartSessionId = context.req.headers.cookie?.match(/cartSessionId=([^;]+)/)?.[1];

            if (!context.isCustomer && !cartSessionId) {
              throw new Error("Unauthorized: Session ID or customer authentication required");
            }

            return pubsub.asyncIterator(CONSTANTS.SOCKET_EVENT_NAME.ORDER);
          },
          async (payload: OrderChange, args: any, context: Context) => {
            const order = await OrderLoader.load(payload.orderId);
            const cartSessionId = context.req.headers.cookie?.match(/cartSessionId=([^;]+)/)?.[1];

            // Kiểm tra quyền truy cập
            let hasAccess = false;

            if (context.token?.role === TOKEN_ROLES.CUSTOMER) {
              // Logged in customer - check by customerId
              hasAccess = order.customerId?.toString() === context.id;
            } else {
              // Guest user - check by sessionId
              hasAccess = order.sessionId === cartSessionId;
            }

            if (!hasAccess) {
              return false;
            }

            // Lọc theo orderId nếu có (để theo dõi 1 đơn hàng cụ thể)
            if (args.orderId && order._id.toString() !== args.orderId) {
              return false;
            }

            return true;
          }
        ),
      },
    },
  },
};
