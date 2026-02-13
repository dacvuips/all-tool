import KhongDau from "khong-dau";
import _, { get, random } from "lodash";

import { TOKEN_ROLES } from "../../../constants/role.const";

// import { AttachmentLoader } from "../attachment/attachment.model";
import { PostTagLoader } from "./postTag/postTag.model";

import { TopicLoader } from "./topic/topic.model";
import { PostModel, PostStatus, RoleGroup, postService } from "../../../libs/dal/post";
import { Context } from "../../../libs/graphql";
import { GraphqlResolver } from "../../graphqlResolver";
import { Scope } from "../../../libs/dal/authority";

const Query = {
  getAllPost: async (root: any, args: any, context: Context) => {
    if (!context.isAdmin && !context.isStaff) {
      _.set(args, "q.filter.status", PostStatus.PUBLIC);
    }

    if (get(args, "q.filter.topicSlugs")) {
      const slugs: string[] = get(args, "q.filter.topicSlugs");
      const topicIds = await Promise.all(slugs.map((l) => postService.getTopicIdBySlug(l)));
      delete args.q.filter.topicSlugs;
      _.set(args, "q.filter.topicIds", { $in: topicIds });
    }

    return postService.fetch(args.q);
  },
  getOnePost: async (root: any, args: any, context: Context) => {
    const { id } = args;

    const post = await PostModel.findOneAndUpdate(
      { _id: id },
      { $inc: { view: 1 } },
      { new: true }
    );

    // postViewLogService.emit("user_view", post, context);
    return post;
  },
};

const Mutation = {
  createPost: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-2"]]);
    const { data } = args;
    if (!data.slug) {
      data.slug = KhongDau(data.title).toLowerCase().trim().replace(/\ +/g, "-");
      if ((await PostModel.count({ slug: data.slug })) > 0) {
        data.slug += "-" + random(1000, 9999);
      }
    }
    if (!data.priority) {
      data.priority = await PostModel.find()
        .sort({ priority: -1 })
        .limit(1)
        .exec()
        .then((res) => {
          if (res.length == 0) return 0;
          return res[0].priority + 1;
        });
    }
    const post = await postService.create(data);
    // await context.log(`Tạo bài đăng: ${post.title}`);
    return post;
  },
  updatePost: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-3"]]);
    const { id, data } = args;
    const post = await postService.updateOne(id, data);
    if (data.status == PostStatus.PUBLIC) {
      // await context.log(`Công khai bài đăng: ${post.title}`);
    }
    return post;
  },
  deleteOnePost: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-4"]]);
    const { id } = args;
    const post = await postService.deleteOne(id);
    // await context.log(`Xoá bài đăng ${post.title}`);
    return post;
  },
};

const Post = {
  tags: GraphqlResolver.loadManyById(PostTagLoader, "tagIds"),
  topics: GraphqlResolver.loadManyById(TopicLoader, "topicIds"),
  // attachments:  GraphqlResolver.loadManyById(AttachmentLoader, "attachmentIds"),
};

export default {
  Query,
  Mutation,
  Post,
};
