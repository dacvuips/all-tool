import _ from "lodash";
import { Types } from "mongoose";
import cache from "../../../helpers/cache";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import Token, { TokenType } from "../../../helpers/token";
import { BaseError, ForbiddenError } from "../../../libs/core";
import { AuthorityModel, authorityService } from "../../../libs/dal/authority";
import { UserStatus } from "../../../libs/dal/user/user.interface";
import { UserModel } from "../../../libs/dal/user/user.model";
import { Context } from "../../../libs/graphql";
import { SECURITY_CONFIG, UserRoleEnum } from "../../../libs/shared";
import { UserHelper } from "./user.helper";

const Mutation = {
  login: async (root: any, args: any, context: Context) => {
    const { idToken, deviceId, deviceToken } = args;

    let decode = await Firebase.auth.verifyIdToken(idToken);

    let user = await UserModel.findOne({ uid: decode.uid });

    if (!user) {
      if (decode.email == "midmanvn@gmail.com") {
        await authorityService.seeding();
        const rootAuthority = await AuthorityModel.findOne({ root: true });

        user = await UserModel.create({
          root: true,
          uid: decode.uid,
          name: "Admin",
          email: decode.email,
          role: UserRoleEnum.ADMIN,
          authorityIds: [rootAuthority._id],
          scopes: rootAuthority.scopes,
          status: UserStatus.ACTIVE,
        });
      } else {
        throw new BaseError("login-error", t("Tài khoản không tồn tại"), 404);
      }
    }

    if (user.status != UserStatus.ACTIVE) {
      throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
    }
    if (deviceId && deviceToken) {
      await new UserHelper(user).setDevice(deviceId, deviceToken);
    }

    const username = user.name || user.email || user.phone || user.role;
    const payload = {
      username,
      type: TokenType.STAFF,
      sessionId: new Types.ObjectId().toString(),
    };
    const accessToken = new Token(user._id, user.role, payload).sign();

    context.setAccessToken(accessToken);

    if (SECURITY_CONFIG.auth.useSession) {
      const decoded = Token.decode(accessToken);
      const exp = decoded.payload.exp - decoded.payload.iat;
      await cache.set("token-session:user:" + user._id, payload.sessionId, exp);
    }
    if (user.role === UserRoleEnum.ADMIN) {
      await authorityService.seeding();
    }
    const userHelper = new UserHelper(user);
    if (user.phone) {
      _.set(user, "phone", userHelper.maskPhone(user.phone));
    }
    if (user.email) {
      _.set(user, "email", userHelper.maskEmail(user.email));
    }
    return {
      user,
      token: accessToken,
    };
  },
};

export default {
  Mutation,
};
