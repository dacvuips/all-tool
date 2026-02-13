import _, { get } from "lodash";

import { TOKEN_ROLES } from "../constants/role.const";
import { Context } from "../libs/graphql";

type GraphqlResolverOptions = {
  auth?: {
    roles?: string[];
  };
};
export class GraphqlResolver {
  private options: GraphqlResolverOptions = {};
  constructor(options: GraphqlResolverOptions = {}) {
    this.options = _.defaultsDeep(options, {});
  }
  static loadById(
    loader: any,
    idField: string,
    option: { defaultValue?: any; select?: string } = {} as any
  ) {
    return (root: any, args: any, context: Context) => {
      return _.get(root, idField)
        ? loader
            .load(_.get(root, idField, "").toString() + (option.select ? ":" + option.select : ""))
            .then((res: any) => res || option.defaultValue)
        : undefined;
    };
  }
  static loadManyById(
    loader: any,
    idField: string,
    option: { defaultValue?: any; skipNull?: boolean } = {} as any
  ) {
    const { defaultValue, skipNull } = option;
    return async (root: any, args: any, context: Context) => {
      let result = _.get(root, idField)
        ? await loader
            .loadMany(_.get(root, idField))
            .then((res: any[]) => res.map((r) => r || defaultValue))
        : [];
      if (skipNull) {
        result = result.filter((r: any) => r != null && r != undefined);
      }
      return result;
    };
  }
  static requireRoles(roles: string[], defaultValue: any = null) {
    return (root: any, args: any, context: Context, info: any) => {
      try {
        context.auth(roles);
      } catch (err) {
        return typeof defaultValue === "function"
          ? defaultValue(root, args, context, info)
          : defaultValue;
      }
      return root[info.fieldName];
    };
  }
  static dependOnFieldEq(field: string, equal: any, next: any) {
    return (root: any, args: any, context: Context) => {
      return get(root, field) == equal ? next(root, args, context) : null;
    };
  }

  static admin(options: GraphqlResolverOptions = {}) {
    _.set(options, "auth.roles", [TOKEN_ROLES.ADMIN, TOKEN_ROLES.STAFF]);
    return new GraphqlResolver(options);
  }

  static id() {
    return new GraphqlResolver({}).resolve(async ({ root }) => root._id);
  }

  auth(roles: string[]) {
    _.set(this.options, "auth.roles", roles);
    return this;
  }
  resolve(fn: (props: { root: any; args: any; context: Context; info: any }) => any) {
    return async (root: any, args: any, context: Context, info: any) => {
      if (_.get(this.options, "auth.roles")) {
        await context.auth(_.get(this.options, "auth.roles"));
      }
      return fn({ root, args, context, info });
    };
  }
}
