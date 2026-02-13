import _ from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { UserModel } from "../../../libs/dal/user/user.model";
import { Context } from "../../../libs/graphql";

const Query = {
  userGetMe: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
    const user = await UserModel.findById(context.token._id);
    if (user.phone) {
      _.set(
        user,
        "phone",
        user.phone.slice(0, 3) + "***" + user.phone.substring(user.phone.length - 4)
      );
    }
    if (user.email) {
      _.set(
        user,
        "email",
        user.email.slice(0, user.email.lastIndexOf("@") - 3) +
          "***" +
          user.email.slice(user.email.lastIndexOf("@"))
      );
    }

    return user;
  },
};

export default {
  Query,
};
