---
to: src/graphql/modules/<%= h.inflection.camelize(name, true) %>/<%= h.inflection.camelize(name, true) %>.resolver.ts
---
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { <%= h.inflection.camelize(name, true) %>Service } from "../../../libs/dal/<%= h.inflection.camelize(name, true) %>";

const Query = {
  getAll<%= h.inflection.camelize(name) %>: async (root: any, args: any, context: Context) => {
  await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return <%= h.inflection.camelize(name, true) %>Service.fetch(args.q);
  },
  getOne<%= h.inflection.camelize(name) %>: async (root: any, args: any, context: Context) => {
  await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await <%= h.inflection.camelize(name, true) %>Service.findOne({ _id: id });
  },
};

const Mutation = {
  create<%= h.inflection.camelize(name) %>: async (root: any, args: any, context: Context) => {
  await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { data } = args;
    return await <%= h.inflection.camelize(name, true) %>Service.create(data);
  },
  update<%= h.inflection.camelize(name) %>: async (root: any, args: any, context: Context) => {
  await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id, data } = args;
    return await <%= h.inflection.camelize(name, true) %>Service.updateOne(id, data);
  },
  deleteOne<%= h.inflection.camelize(name) %>: async (root: any, args: any, context: Context) => {
  await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await <%= h.inflection.camelize(name, true) %>Service.deleteOne(id);
  },
};

const <%= h.inflection.camelize(name) %> = {
  
};

export default {
  Query,
  Mutation,
  <%= h.inflection.camelize(name) %>,
};
