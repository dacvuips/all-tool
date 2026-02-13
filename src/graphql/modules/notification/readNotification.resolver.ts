import { ErrorHelper } from "../../../base/error";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { NotificationModel } from "../../../libs/dal/notification";
import { Context } from "../../../libs/graphql";

const Mutation = {
  readNotification: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER);
    const { notificationId } = args;
    const notification = await NotificationModel.findById(notificationId);
    if (!notification) throw ErrorHelper.mgRecoredNotFound("Thông báo");
    if (context.isShop && notification.shopId.toString() != context.id)
      throw ErrorHelper.permissionDeny();
    if (
      (context.isStaff || context.isPartner || context.isAdmin) &&
      notification.userId.toString() != context.id
    )
      throw ErrorHelper.permissionDeny();

    if (context.isCustomer && notification.customerId.toString() != context.id)
      throw ErrorHelper.permissionDeny();
    if (notification.seen) return notification;
    notification.seen = true;
    notification.sentAt = new Date();
    return notification.save();
  },
};

export default { Mutation };
