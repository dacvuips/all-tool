import { gql } from "apollo-server-express";
import { Types } from "mongoose";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import { t } from "../../../../helpers/functions/string";
import Token, { TokenType } from "../../../../helpers/token";
import { ForbiddenError } from "../../../../libs/core";
import { UserModel, UserStatus } from "../../../../libs/dal/user";
import { Context } from "../../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      changeAccountUserFormShop: Mixed
    }
  `,
  resolver: {
    Mutation: {
      changeAccountUserFormShop: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.SHOP_SHOP_STAFF);
        const token = context.token.payload;

        let user = await UserModel.findById(token.userId).orFail(
          new ForbiddenError(t("Không tìm thấy tài khoản"))
        );

        if (user.status != UserStatus.ACTIVE) {
          throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
        }

        const username = user.name || user.email || user.phone || user.role;

        const payload = {
          username,
          type: TokenType.STAFF,
          sessionId: new Types.ObjectId().toString(),
        };
        const accessToken = new Token(user._id, user.role, payload).sign();

        context.setAccessToken(accessToken);

        return { result: "success" };
      },
    },
  },
};
