import KhongDau from "khong-dau";
import { random } from "lodash";

import { TopicModel } from "./topic.model";
import { topicService } from "./topic.service";
import { Context } from "../../../../libs/graphql";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import { Scope } from "../../../../libs/dal/authority";

const Query = {
  getAllTopic: async (root: any, args: any, context: Context) => {
    return topicService.fetch(args.q);
  },
  getOneTopic: async (root: any, args: any, context: Context) => {
    const { id } = args;
    return await topicService.findOne({ _id: id });
  },
};

const Mutation = {
  createTopic: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-2"]]);
    const { data } = args;
    if (!data.slug) {
      data.slug = KhongDau(data.title).toLowerCase().trim().replace(/\ +/g, "-");
    }
    if ((await TopicModel.count({ slug: data.slug })) > 0) {
      data.slug += "-" + random(1000, 9999);
    }

    return await topicService.create(data);
  },
  updateTopic: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-3"]]);
    const { id, data } = args;
    return await topicService.updateOne(id, data);
  },
  deleteOneTopic: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["TT-1-4"]]);
    const { id } = args;
    return await topicService.deleteOne(id);
  },
};

const Topic = {};

export default {
  Query,
  Mutation,
  Topic,
};
