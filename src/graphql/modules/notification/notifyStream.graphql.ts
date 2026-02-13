import { gql } from "apollo-server-express";

export default {
  schema: gql`
    extend type Subscription {
      notifyStream: Notification
    }
  `,
  resolver: {
    Subscription: {
      notifyStream: {
        resolve: (payload: any) => payload,
        // subscribe: withFilter(
        //   (root: any, args: any, context: Context) => {
        //   await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER);

        //   },
        //   async (payload: INotification, args: any, context: Context) => {
        //     switch (payload.target) {
        //       case NotificationTarget.CUSTOMER:
        //         return payload.customerId.toString() == context.id;
        //       case NotificationTarget.SHOP:
        //         return payload.shopId.toString() == context.id;
        //       case NotificationTarget.STAFF:
        //         return payload.staffId.toString() == context.id;
        //       case NotificationTarget.PARTNER:
        //         return payload.partnerId.toString() == context.id;
        //     }
        //   }
        // ),
      },
    },
  },
};
