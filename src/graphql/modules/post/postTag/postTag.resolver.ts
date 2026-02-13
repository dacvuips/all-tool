import KhongDau from "khong-dau";
import { random } from "lodash";

import { TOKEN_ROLES } from "../../../../constants/role.const";
import { Scope } from "../../../../libs/dal/authority";
import { Context } from "../../../../libs/graphql";
import { PostTagModel } from "./postTag.model";
import { postTagService } from "./postTag.service";

const Query = {
  getAllPostTag: async (root: any, args: any, context: Context) => {
    return postTagService.fetch(args.q);
  },
  getOnePostTag: async (root: any, args: any, context: Context) => {
    const { id } = args;
    return await postTagService.findOne({ _id: id });
  },
};

const Mutation = {
  createPostTag: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-2"]]);
    const { data } = args;
    if (!data.slug) {
      data.slug = KhongDau(data.name).toLowerCase().trim().replace(/\ +/g, "-");
      if ((await PostTagModel.count({ slug: data.slug })) > 0) {
        data.slug += "-" + random(1000, 9999);
      }
    }
    return await postTagService.create(data);
  },
  updatePostTag: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-3"]]);
    const { id, data } = args;
    return await postTagService.updateOne(id, data);
  },
  deleteOnePostTag: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-4"]]);
    const { id } = args;
    return await postTagService.deleteOne(id);
  },
};

const PostTag = {};

export default {
  Query,
  Mutation,
  PostTag,
};
