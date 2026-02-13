import { TOKEN_ROLES } from "../../../constants/role.const";
import { authErrorPermissionDeny } from "../../../libs/core";
import { UserModel } from "../../../libs/dal/user/user.model";
import { Context } from "../../../libs/graphql";

const Mutation = {
  userUpdateMe: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    // kiem tra user co phai chinh no
    const existedUser = await UserModel.findById(context.token._id);
    if (!existedUser) throw authErrorPermissionDeny;
    return await UserModel.findByIdAndUpdate(existedUser.id, { $set: data }, { new: true });
  },
};

export default {
  Mutation,
};
