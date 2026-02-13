import { gql } from "apollo-server-express";
import passwordHash from "password-hash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../../libs/core";
import { CustomerModel } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";
import { CustomerStatusEnum } from "../../../libs/shared";
import { validatePassword } from "../user/common";

export default {
  schema: gql`
    extend type Mutation {
      customerChangePassword(input: CustomerChangePasswordInput!): Mixed
    }

    input CustomerChangePasswordInput {
      "Token"
      idToken: String!
      "Mật khẩu mới"
      password: String!
    }
  `,
  resolver: {
    Mutation: {
      customerChangePassword: async (root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);
        const { idToken, password } = args.input;

        let decode = await Firebase.auth.verifyIdToken(idToken);

        let customer = await CustomerModel.findOne({ uid: decode.uid });
        if (!customer) {
          throw new ForbiddenError(t("Tài khoản không tồn tại"));
        }
        if (customer.status != CustomerStatusEnum.ACTIVE) {
          throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
        }

        if (customer.id != context.id) {
          new ForbiddenError(t("Bạn không có quyền thay đổi mật khẩu của người khác"));
        }
        validatePassword(password);

        await Firebase.auth.updateUser(customer.uid, { password });
        // update password
        await CustomerModel.updateOne(
          {
            uid: decode.uid,
          },
          {
            $set: {
              passwordHash: passwordHash.generate(password),
              "times.passwordChangedAt": new Date(),
            },
          }
        );
        return true;
      },
    },
  },
};
