import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { CustomerLoader } from "../../../libs/dal/customer";
import { UserLoader } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";
import { GraphqlResolver } from "../../graphqlResolver";
import { notificationService } from "./notification.service";

const Query = {
  getAllNotification: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-17-1"]]);

    return notificationService.fetch(args.q);
  },
  getOneNotification: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER);
    const { id } = args;
    return await notificationService.findOne({ _id: id });
  },
};

const Notification = {
  user: GraphqlResolver.loadById(UserLoader, "userId"),
  customer: GraphqlResolver.loadById(CustomerLoader, "customerId"),
};

export default {
  Query,
  Notification,
};
