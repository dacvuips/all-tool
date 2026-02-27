import _ from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { categoryService } from "../../../libs/dal/category";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-7-1"]]);
    return categoryService.fetch(args.q);
  },
  getOneCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-7-1"]]);
    const { id } = args;
    return await categoryService.findOne({ _id: id });
  },
  getAllCategoryActive: async (root: any, args: any, context: Context) => {
    _.set(args, "q.filter.active", true);
    return categoryService.fetch(args.q);
  },
};

const Mutation = {
  createCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-7-2"]]);
    const { data } = args;
    return await categoryService.create(data);
  },
  updateCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-7-3"]]);
    const { id, data } = args;
    return await categoryService.updateOne(id, data);
  },
  deleteOneCategory: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-7-4"]]);
    const { id } = args;
    return await categoryService.deleteOne(id);
  },
};

const Category = {};

export default {
  Query,
  Mutation,
  Category,
};
