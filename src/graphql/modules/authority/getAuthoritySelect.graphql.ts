import { gql } from "apollo-server-express";
import { Context } from "../../../libs/graphql";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { AuthorityModel } from "../../../libs/dal/authority";
import { BaseError } from "../../../libs/core";
import { UserModel } from "../../../libs/dal/user";

export default {
  schema: gql`
    extend type Query {
      getAuthoritySelect: Mixed
    }
  `,
  resolver: {
    Query: {
      getAuthoritySelect: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        if (context.isAdmin) return await AuthorityModel.find({}).select("name id ").lean();
        if (context.isStaff) {
          const user = await UserModel.findById(context.id)
            .orFail(new BaseError("user-not-found", "Không tìm thấy người dùng"))
            .select("authorityId")
            .lean();
          const authority = await AuthorityModel.find({ parentIds: { $in: [user.authorityId] } })
            .select("name id ")
            .lean();
          return authority;
        }
      },
    },
  },
};
