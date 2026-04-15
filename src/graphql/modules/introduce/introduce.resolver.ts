import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerLoader } from "../../../libs/dal/customer";
import { introduceService } from "../../../libs/dal/introduce";
import { Context } from "../../../libs/graphql";
import { GraphqlResolver } from "../../graphqlResolver";

const Query = {
  getAllIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return introduceService.fetch(args.q);
  },
  getOneIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await introduceService.findOne({ _id: id });
  },
};

const Mutation = {
  createIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await introduceService.create(data);
  },
  updateIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await introduceService.updateOne(id, data);
  },
  deleteOneIntroduce: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await introduceService.deleteOne(id);
  },
};

const Introduce = {
  referrer: GraphqlResolver.loadById(CustomerLoader, "referrerId"),
  referee: GraphqlResolver.loadById(CustomerLoader, "refereeId"),
};

export default {
  Query,
  Mutation,
  Introduce,
};
