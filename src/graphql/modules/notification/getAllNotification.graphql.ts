import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { GetAllNotificationUsecase } from "../../../libs/usecases/notification/get/get-all-notification.usecase";

export default {
  schema: gql`
    extend type Query {
      getAllUserNotify(q: QueryGetListInput): NotificationPageData
      getAllCustomerNotify(q: QueryGetListInput): NotificationPageData
      getAllShopNotify(q: QueryGetListInput): NotificationPageData
    }
  `,
  resolver: {
    Query: {
      getAllUserNotify: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);

        const command = GetAllNotificationUsecase.Command.create({
          resource: "user",
          userId: context.id,
          query: args.q,
        });
        const result = await GetAllNotificationUsecase.usecase.execute(command);
        return result.data;
      },
      getAllCustomerNotify: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);

        const command = GetAllNotificationUsecase.Command.create({
          resource: "customer",
          customerId: context.id,
          query: args.q,
        });
        const result = await GetAllNotificationUsecase.usecase.execute(command);
        return result.data;
      },
      getAllShopNotify: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.SHOP_SHOP_STAFF);

        const command = GetAllNotificationUsecase.Command.create({
          resource: "shop",
          shopId: context.id,
          query: args.q,
        });
        const result = await GetAllNotificationUsecase.usecase.execute(command);
        return result.data;
      },
    },
  },
};
