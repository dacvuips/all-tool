import { gql, withFilter } from "apollo-server-express";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { ThreadLoader } from "../../../libs/dal/thread";
import { IThreadMessage } from "../../../libs/dal/threadMessage";
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";

type ThreadChange = {
  threadId: string;
  event: "message";
  data: IThreadMessage;
};

export default {
  schema: gql`
    extend type Subscription {
      threadChanged: ThreadChange
    }

    type ThreadChange {
      threadId: String
      event: String
      data: Mixed
    }
  `,
  resolver: {
    Subscription: {
      threadChanged: {
        resolve: (payload: any) => payload,
        subscribe: withFilter(
          (root: any, args: any, context: Context) => {
            context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
            return pubsub.asyncIterator(CONSTANTS.SOCKET_EVENT_NAME.THREAD_MESSAGE);
          },
          async (payload: ThreadChange, args: any, context: Context) => {
            const thread = await ThreadLoader.load(payload.threadId);
            switch (context.token.role) {
              case TOKEN_ROLES.CUSTOMER:
                return thread.customerId.toString() === context.id;
              case TOKEN_ROLES.SHOP:
              case TOKEN_ROLES.SHOP_STAFF:
                return thread.shopId.toString() === context.id;
              case TOKEN_ROLES.STAFF:
              case TOKEN_ROLES.PARTNER:
              case TOKEN_ROLES.ADMIN:
                return thread.staffId.toString() === context.id;
              default:
                return false;
            }
          }
        ),
      },
    },
  },
};
