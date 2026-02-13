import { TOKEN_ROLES } from "../../../constants/role.const";
import { activityService } from "../../../libs/dal/activity";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllActivity: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return activityService.fetch(args.q);
  },
  getOneActivity: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await activityService.findOne({ _id: id });
  },
};

const Mutation = {
  createActivity: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { data } = args;
    return await activityService.create(data);
  },
  updateActivity: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id, data } = args;
    return await activityService.updateOne(id, data);
  },
  deleteOneActivity: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id } = args;
    return await activityService.deleteOne(id);
  },
  deleteManyActivity: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { ids } = args;
    let result = await activityService.deleteMany(ids);
    return result;
  },
};

const Activity = {};

export default {
  Query,
  Mutation,
  Activity,
};
