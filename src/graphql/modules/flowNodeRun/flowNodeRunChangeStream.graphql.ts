import { gql, withFilter } from "apollo-server-express";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";

export enum FlowNodeRunChangeEventEnum {
  COMPLETED = "completed",
  FAILED = "failed",
}

export type FlowNodeRunChangePayload = {
  runId: string;
  nodeId: string;
  customerId: string;
  productId: string;
  event: FlowNodeRunChangeEventEnum;
  /** Run document (serializable) để client cập nhật node ngay */
  data: Record<string, unknown>;
};

export default {
  schema: gql`
    extend type Subscription {
      flowNodeRunChanged(customerId: String!, productId: String): FlowNodeRunChange
    }

    type FlowNodeRunChange {
      runId: String
      nodeId: String
      customerId: String
      productId: String
      event: String
      data: Mixed
    }
  `,
  resolver: {
    Subscription: {
      flowNodeRunChanged: {
        resolve: (payload: FlowNodeRunChangePayload) => payload,
        subscribe: withFilter(
          (_root: unknown, _args: unknown, context: Context) => {
            if (!context.isCustomer) {
              throw new Error("Unauthorized: Customer authentication required");
            }
            return pubsub.asyncIterator(CONSTANTS.SOCKET_EVENT_NAME.FLOW_NODE_RUN);
          },
          (payload: FlowNodeRunChangePayload, args: { customerId: string; productId?: string }, context: Context) => {
            if (context.id !== payload.customerId) return false;
            if (args.customerId && payload.customerId !== args.customerId) return false;
            if (args.productId && payload.productId !== args.productId) return false;
            return true;
          }
        ),
      },
    },
  },
};
