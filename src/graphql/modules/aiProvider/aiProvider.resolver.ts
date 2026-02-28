import { TOKEN_ROLES } from "../../../constants/role.const";
import { aiProviderService } from "../../../libs/dal/aiProvider";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllAiProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return aiProviderService.fetch(args.q);
  },
  getOneAiProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await aiProviderService.findOne({ _id: id });
  },
};

const Mutation = {
  createAiProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await aiProviderService.create(data);
  },
  updateAiProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await aiProviderService.updateOne(id, data);
  },
  deleteOneAiProvider: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await aiProviderService.deleteOne(id);
  },
};

const AiProvider = {};

export default {
  Query,
  Mutation,
  AiProvider,
};
