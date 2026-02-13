import { gql } from "apollo-server-express";
import { validatePassword } from "./common";

import { TOKEN_ROLES } from "../../../constants/role.const";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../../libs/core";
import { UserModel } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      userChangePassword(idToken: String!, password: String!): User
    }
  `,
  resolver: {
    Mutation: {
      userChangePassword: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
        const { idToken, password } = args;
        let decode = await Firebase.auth.verifyIdToken(idToken);
        let user = await UserModel.findOne({ uid: decode.uid });
        if (!user) {
          throw new ForbiddenError(t("Tài khoản không tồn tại"));
        }
        if (user.status != "ACTIVE") {
          throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
        }

        if (user.id != context.id) {
          new ForbiddenError(t("Bạn không có quyền thay đổi mật khẩu của người khác"));
        }
        validatePassword(password);

        await Firebase.auth.updateUser(user.uid, { password });
        return user;
      },
    },
  },
};
