import _ from "lodash";

import { BaseErrorHelper } from "../../../base/error";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { onActivity } from "../../../events/onActivity.event";
import cache from "../../../helpers/cache";
import { notFoundHandler } from "../../../helpers/common";
import Firebase from "../../../helpers/firebase";
import { t } from "../../../helpers/functions/string";
import { BaseError, ForbiddenError } from "../../../libs/core";
import { AuthorityModel } from "../../../libs/dal/authority";
import { Scope } from "../../../libs/dal/authority/scope.enum";
import { CustomerModel } from "../../../libs/dal/customer";
import { InsertNotification, NotificationTarget } from "../../../libs/dal/notification";
import { IUser, UserModel, UserStatus, userService } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";
import { UserRoleEnum } from "../../../libs/shared";
import { AuthorityHelper } from "../authority/authority.helper";
import { NotificationBuilder } from "../notification/notificationBuilder";
import { validateEmail, validatePassword } from "./common";
import { UserHelper } from "./user.helper";
const Query = {
  getAllUser: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-1"]]);
    if (!context.isAdmin) {
      const user = await UserModel.findById(context.id)
        .orFail(new BaseError("user-not-found", t("Không tìm thấy người dùng")))
        .select("authorityId")
        .lean();
      const authority = await AuthorityModel.find({ parentIds: { $in: [user.authorityId] } })
        .select("name id ")
        .lean();

      _.set(args.q, "filter.authorityId", { $in: authority.map((a) => a._id) });
    }
    return userService.fetch(args.q);
  },
  getOneUser: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER);
    const { id } = args;
    return await userService.findOne({ _id: id });
  },
};

const Mutation = {
  createUser: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-2"]]);
    const { data } = args;
    validateEmail(data.email);
    validatePassword(data.password);
    const owner = await context.getUser({});
    // Kiểm tra phân quyền phải dưới cấp
    const authority = await AuthorityModel.findById(data.authorityId);
    if (!new AuthorityHelper(authority).isParent(owner.authorityIds[0])) {
      throw BaseErrorHelper.permissionDeny();
    }
    const user = await UserModel.findOne({ email: data.email });
    if (user) {
      throw new BaseError("create-user-error", t("Email này đã có tài khoản"));
    }
    // get customer by phone number and email to check exist customer
    const customer = await CustomerModel.findOne({ email: data.email });

    if (customer) {
      throw new ForbiddenError(
        t("Email đã được đăng ký tài khoản khách hàng, vui lòng chọn email khác!")
      );
    }
    const userHelper = new UserHelper(new UserModel(data));
    userHelper.setAuthority(authority);

    if (!data.role) data.role = UserRoleEnum.STAFF;
    const fbUser = await Firebase.auth.createUser({ email: data.email, password: data.password });
    data.uid = fbUser.uid;
    data.code = await userService.generateCode();
    delete data.password;
    const newData = _.merge(data, userHelper.user);
    const newUser = await new UserModel(newData).save();
    onActivity.next({
      username: context.token.payload.username || "",
      message: t(`Tạo người dùng`),
    });
    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      t("Tạo tài khoản"),
      `${t("Bạn đã tài khoản thành công")}, ${t("Tên")}: ${data.name}`
    )
      .sendTo(NotificationTarget.USER, context.id)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return newUser;
  },
  updateUser: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-3"]]);
    const { id, data } = args;
    // if (!context.isAdmin && context.id != id) throw authErrorPermissionDeny;

    const user = await UserModel.findOne({ _id: id }).orFail(
      new ForbiddenError(t("Tài khoản không tồn tại"))
    );
    const authority = await AuthorityModel.findById(user.authorityId);
    const updater = await context.getUser({});
    if (!new AuthorityHelper(authority).isParent(updater.authorityIds[0])) {
      throw BaseErrorHelper.permissionDeny();
    }
    if (data.authorityId) {
      const authorityData = await AuthorityModel.findById(data.authorityId);
      if (!new AuthorityHelper(authorityData).isParent(updater.authorityIds[0])) {
        throw BaseErrorHelper.permissionDeny();
      }
    }

    if (data.email != user.email) {
      await Firebase.auth.updateUser(user.uid, { email: data.email });
    }

    if (data.status != UserStatus.ACTIVE) {
      await cache.del("token-session:user:" + user._id.toString());
    }
    // Lấy giá trị hiện tại và giá trị bị thay đổi
    const getChangedValues = async (oldData: any, newData: any) => {
      const oldValueArray = [] as any[];
      const newValueArray = [] as any[];
      const newDataEntries = Object.entries(newData._doc);
      // Duyệt qua tất cả các trường của đối tượng mới
      for (const [key, value] of newDataEntries) {
        const oldValue = _.get(oldData, key);

        if (typeof value === "object" && key !== "gameIdsPermission") continue;

        if (!_.isEqual(oldValue, value)) {
          const valueType = value as string[];
          oldValueArray.push(JSON.stringify(oldValue));
          newValueArray.push(JSON.stringify(value));
        }
      }

      return { old: oldValueArray, new: newValueArray };
    };

    return await userService
      .updateOne(id, data)
      .then(async (res: IUser) => {
        onActivity.next({
          username: context.token.payload.username || "",
          message: t(`Cập nhật người dùng`),
        });
        return res;
      })
      .then(async (res) => {
        const changes = await getChangedValues(user, res);
        // Tạo thông báo
        const customerNotify = new NotificationBuilder(
          t("Cập nhật tài khoản"),
          `${t("Bạn đã cập nhật tài khoản thành công")}, ${t("giá trị cũ")}:[ ${
            changes.old
          } ] | ${t("giá trị đổi")}: [ ${changes.new} ] `
        )
          .sendTo(NotificationTarget.USER, context.id)
          .account()
          .build();
        InsertNotification([customerNotify]);
      });
  },
  deleteOneUser: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-1-4"]]);
    const { id } = args;
    let user = notFoundHandler(await UserModel.findById(id));
    await Firebase.auth.deleteUser(user.uid);
    return await userService
      .deleteOne(id)
      .then((res) => {
        onActivity.next({
          username: context.token.payload.username || "",
          message: `Xóa người dùng`,
        });
        return res;
      })
      .then((res) => {
        // Tạo thông báo
        const customerNotify = new NotificationBuilder(
          "Xóa tài khoản",
          `Bạn đã xóa tài khoản thành công. tài khoản tên: ${res.name}`
        )
          .sendTo(NotificationTarget.USER, context.id)
          .account()
          .build();
        InsertNotification([customerNotify]);
      });
  },
  deleteManyUser: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-1-4"]]);
    const { ids } = args;
    const users = await UserModel.find({ _id: { $in: ids } });
    await Firebase.auth.deleteUsers(users.map((u) => u.uid.toString()));
    let result = await userService.deleteMany(ids);
    onActivity.next({
      username: context.token.payload.username || "",
      message: `Xóa người dùng`,
    });
    return result;
  },
};

const User = {
  unseenNotify: async (root: IUser, args: any, context: Context) => {
    return await new UserHelper(root).getUnseenNotify();
  },
};

export default {
  Query,
  Mutation,
  User,
};
