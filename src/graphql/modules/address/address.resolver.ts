import { TOKEN_ROLES } from "../../../constants/role.const";
import { addressService } from "../../../libs/dal/address";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllAddress: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return addressService.fetch(args.q);
  },
  getOneAddress: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await addressService.findOne({ _id: id });
  },
};

const Mutation = {
  createAddress: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { data } = args;
    return await addressService.create(data);
  },
  updateAddress: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id, data } = args;
    return await addressService.updateOne(id, data);
  },
  deleteOneAddress: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { id } = args;
    return await addressService.deleteOne(id);
  },
  deleteManyAddress: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.ADMIN]);
    const { ids } = args;
    let result = await addressService.deleteMany(ids);
    return result;
  },
};

const Address = {};

export default {
  Query,
  Mutation,
  Address,
};
