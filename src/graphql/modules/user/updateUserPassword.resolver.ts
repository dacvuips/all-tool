import { TOKEN_ROLES } from "../../../constants/role.const";
import { notFoundHandler } from "../../../helpers/common";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { authErrorPermissionDeny } from "../../../libs/core";
import { InsertNotification, NotificationTarget } from "../../../libs/dal/notification";
import { UserModel } from "../../../libs/dal/user/user.model";
import { Context } from "../../../libs/graphql";
import { NotificationBuilder } from "../notification/notificationBuilder";
import { validatePassword } from "./common";

const Mutation = {
  updateUserPassword: async (root: any, args: any, context: Context) => {
    const { id, password } = args;
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    if (!context.isAdmin && context.id != id) throw authErrorPermissionDeny;
    validatePassword(password);
    const user = notFoundHandler(await UserModel.findById(id));
    await Firebase.auth.updateUser(user.uid, { password });
    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      t("Cập nhật mật khẩu"),
      `${t("Bạn đã cập nhật mật khẩu tài khoản thành công")}, ${t("Tên tài khoản")}: ${user.name}`
    )
      .sendTo(NotificationTarget.USER, context.id)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return user;
  },
};

export default {
  Mutation,
};
