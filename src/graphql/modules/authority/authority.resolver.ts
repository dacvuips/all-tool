import { BaseErrorHelper } from "../../../base/error";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { AuthorityModel, authorityService } from "../../../libs/dal/authority";
import { Scope } from "../../../libs/dal/authority/scope.enum";
import { UserModel } from "../../../libs/dal/user/user.model";
import { Context } from "../../../libs/graphql";
import { AuthorityHelper } from "./authority.helper";

const Query = {
  getAllAuthority: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-10-1"]]);
    // const user = await context.getUser({ cached: false });
    // _.set(args, "q.filter.$or", [
    //   { _id: user.authorityIds[0] },
    //   { parentIds: user.authorityIds[0] },
    // ]);

    return authorityService.fetch(args.q);
  },
  getOneAuthority: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await authorityService.findOne({ _id: id });
  },
};

const Mutation = {
  createAuthority: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-10-2"]]);
    const { data } = args;
    const { name, parentId } = data;
    const user = await context.getUser({});
    const authority = await AuthorityModel.findById(parentId);

    if (context.isStaff) {
      // Quyền kế thừa phải thuộc quyền của người tạo
      if (
        authority.parentIds.length > 0 &&
        !authority.parentIds.includes(user.authorityIds[0]) &&
        authority.id != user.authorityIds[0]
      ) {
        throw BaseErrorHelper.permissionDeny();
      }
    }
    return await authorityService.create({
      name: name,
      scopes: authority.scopes,
      root: false,
      parentIds: [authority._id, ...authority.parentIds],
    });
  },
  updateAuthority: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-10-3"]]);
    const { id, data } = args;
    const authority = await AuthorityModel.findById(id);
    if (authority.root) throw BaseErrorHelper.permissionDeny();
    const user = await context.getUser({});
    if (!new AuthorityHelper(authority).isParent(user.authorityIds[0])) {
      throw BaseErrorHelper.permissionDeny();
    }
    if (data.scopes) {
      const parentAuthority = await AuthorityModel.findById(authority.parentIds[0]);
      const pushScopes: string[] = [];
      const pullScopes: string[] = [];
      data.scopes.forEach((scope: string) => {
        if (!parentAuthority.scopes.includes(scope)) {
          throw BaseErrorHelper.permissionDeny();
        }
        if (!authority.scopes.includes(scope)) {
          pushScopes.push(scope);
        }
      });
      // Nếu không có quyền truy cập phân quyền -> Không cập nhật phân quyền
      if (!data.scopes.includes("QT-10-1")) {
        pullScopes.push("QT-10-2");
        pullScopes.push("QT-10-3");
        data.scopes = data.scopes.filter((scope: string) => {
          if (scope === "QT-10-2" || scope === "QT-10-3") return false;
          return true;
        });
      }
      for (const scope of authority.scopes) {
        if (!data.scopes.includes(scope)) {
          pullScopes.push(scope);
        }
      }
      // Trường hợp bổ sung thêm scope cho phân quyền
      if (pushScopes.length > 0) {
        // Tất cả người dung có phân quyền sẽ có thêm quyền được bổ sung
        await UserModel.updateMany(
          { "authorityIds.0": authority._id },
          { $push: { scopes: { $each: pushScopes } } }
        ).exec();
      }
      // Trường hợp huỷ bỏ scope cho phân quyền
      if (pullScopes.length > 0) {
        // Tất cả những quyền con cũng sẽ bị loại bỏ quyền
        await AuthorityModel.updateMany(
          { parentIds: { $in: authority._id } },
          { $pullAll: { scopes: pullScopes } }
        ).exec();
        // Tất cả người dùng có phân quyền sẽ bị loại bỏ quyền
        await UserModel.updateMany(
          { authorityIds: { $in: authority._id } },
          { $pullAll: { scopes: pullScopes } }
        ).exec();
      }
    }
    return await authorityService.updateOne(id, data);
  },
  deleteOneAuthority: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-10-4"]]);
    const { id } = args;
    // Không cho xoá phân quyền góc
    const authority = await AuthorityModel.findById(id);
    const user = await context.getUser({});
    if (!new AuthorityHelper(authority).isParent(user.authorityIds[0])) {
      throw BaseErrorHelper.permissionDeny();
    }
    if (authority.root) throw BaseErrorHelper.permissionDeny();
    // Kiểm tra xem có người dùng nào phụ thuộc phân quyền không
    const userCount = await UserModel.count({ authorityIds: { $in: id } });
    if (userCount > 0) {
      throw Error(
        `${t("Phân quyền không thể bị xoá")} ${t("có")} ${userCount} ${t(
          "người dùng phụ thuộc phân quyền này."
        )}`
      );
    }
    // Xoá các phân quyền phụ thuộc
    await AuthorityModel.deleteMany({ parentIds: { $in: id } });
    return await authorityService.deleteOne(id);
  },
};

const Authority = {};

export default {
  Query,
  Mutation,
  Authority,
};
