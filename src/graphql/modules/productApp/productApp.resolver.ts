import KhongDau from "khong-dau";
import { random, set } from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { ProductAppModel, productAppService } from "../../../libs/dal/productApp";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-1"]]);
    return productAppService.fetch(args.q);
  },
  getOneProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-1"]]);
    const { id } = args;
    return await productAppService.findOne({ _id: id });
  },
  getActiveProductApps: async (root: any, args: any, context: Context) => {
    set(args, "q.filter.active", true);
    return productAppService.fetch(args.q);
  },
  getProductAppSlug: async (root: any, args: any, context: Context) => {
    const { slug } = args;
    return await productAppService.findOne({ slug });
  },
};

const PageList = ["admin", "profile", "post"];

const Mutation = {
  createProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-2"]]);

    const { data } = args;
    if (!data.slug) {
      data.slug = KhongDau(data.name)?.toLowerCase().trim().replace(/\ +/g, "-");
      // tránh việc tạo trùng path và trùng với page chính
      if ((await ProductAppModel.count({ slug: data.slug })) > 0 || PageList.includes(data.slug)) {
        data.slug += "-" + random(1000, 9999);
      }
    }

    return await productAppService.create(data);
  },
  updateProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-3"]]);

    const { id, data } = args;

    if (!data.slug) {
      data.slug = KhongDau(data.name)?.toLowerCase().trim().replace(/\ +/g, "-");
      // tránh việc tạo trùng path và trùng với page chính
      if (
        (await ProductAppModel.count({ slug: data.slug, _id: { $ne: id } })) > 0 ||
        PageList.includes(data.slug)
      ) {
        data.slug += "-" + random(1000, 9999);
      }
    }

    return await productAppService.updateOne(id, data);
  },
  deleteOneProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-4"]]);

    const { id } = args;
    return await productAppService.deleteOne(id);
  },
  toggleActiveProductApp: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-3"]]);

    const { id } = args;
    const product = await productAppService.findOne({ _id: id });
    if (!product) throw new Error("ProductApp not found");

    return await productAppService.updateOne(id, { active: !product.active });
  },
};

const ProductApp = {};

export default {
  Query,
  Mutation,
  ProductApp,
};
