import { TOKEN_ROLES } from "../../../constants/role.const";
import { counterService } from "../../../libs/dal/counter";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllCounter: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return counterService.fetch(args.q);
  },
  getOneCounter: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await counterService.findOne({ _id: id });
  },
};

const Mutation = {
  createCounter: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { data } = args;
    return await counterService.create(data);
  },
  updateCounter: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id, data } = args;
    return await counterService.updateOne(id, data);
  },
  deleteOneCounter: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id } = args;
    return await counterService.deleteOne(id);
  },
  deleteManyCounter: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { ids } = args;
    let result = await counterService.deleteMany(ids);
    return result;
  },
};

const Counter = {};

export default {
  Query,
  Mutation,
  Counter,
};
