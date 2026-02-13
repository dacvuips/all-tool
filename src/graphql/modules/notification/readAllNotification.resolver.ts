import { TOKEN_ROLES } from "../../../constants/role.const";
import { NotificationModel, NotificationTarget } from "../../../libs/dal/notification";
import { Context } from "../../../libs/graphql";

const Mutation = {
  readAllNotification: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    if (context.isShop) {
      await NotificationModel.updateMany(
        { target: NotificationTarget.SHOP, shopId: context.id, seen: false },
        { $set: { seen: true, seenAt: new Date() } }
      );
    }
    if (context.isStaff || context.isPartner || context.isAdmin) {
      await NotificationModel.updateMany(
        { target: NotificationTarget.USER, userId: context.id, seen: false },
        { $set: { seen: true, seenAt: new Date() } }
      );
    }

    if (context.isCustomer) {
      await NotificationModel.updateMany(
        { target: NotificationTarget.CUSTOMER, customerId: context.id, seen: false },
        { $set: { seen: true, seenAt: new Date() } }
      );
    }
    return true;
  },
};

export default { Mutation };
