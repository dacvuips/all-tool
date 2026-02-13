import KhongDau from "khong-dau";
import { random, set } from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { ProductModel, productService } from "../../../libs/dal/product";
import { Context } from "../../../libs/graphql";

const calculatePriceRange = (data: any) => {
  if (data.classification.variants && data.classification.variants.length > 0) {
    const prices = data.classification.variants.map((variant: any) => variant.price);

    data.minPrice = Math.min(...prices);
    data.maxPrice = Math.max(...prices);
  } else if (data.classification) {
    data.minPrice = data.classification.originalPrice;
    data.maxPrice = data.classification.originalPrice;
  }
};

const Query = {
  getAllProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-1"]]);
    return productService.fetch(args.q);
  },
  getOneProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-1"]]);
    const { id } = args;
    return await productService.findOne({ _id: id });
  },
  getActiveProducts: async (root: any, args: any, context: Context) => {
    set(args, "q.filter.active", true);
   
    return productService.fetch(args.q);
  },
  getProductSlug: async (root: any, args: any, context: Context) => {
    const { slug } = args;
    return await productService.findOne({ slug });
  },
};
const PageList = ["admin", "profile", "post"];
const Mutation = {
  createProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-2"]]);

    const { data } = args;
    if (!data.slug) {
      data.slug = KhongDau(data.name)?.toLowerCase().trim().replace(/\ +/g, "-");
      // tránh việc tạo trùng path và trùng với page chính
      if ((await ProductModel.count({ slug: data.slug })) > 0 || PageList.includes(data.slug)) {
        data.slug += "-" + random(1000, 9999);
      }
    }

    calculatePriceRange(data);

    return await productService.create(data);
  },
  updateProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-3"]]);

    const { id, data } = args;

    if (!data.slug) {
      data.slug = KhongDau(data.name)?.toLowerCase().trim().replace(/\ +/g, "-");
      // tránh việc tạo trùng path và trùng với page chính
      if (
        (await ProductModel.count({ slug: data.slug, _id: { $ne: id } })) > 0 ||
        PageList.includes(data.slug)
      ) {
        data.slug += "-" + random(1000, 9999);
      }
    }

    calculatePriceRange(data);

    return await productService.updateOne(id, data);
  },
  deleteOneProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-4"]]);

    const { id } = args;
    return await productService.deleteOne(id);
  },
  toggleActiveProduct: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-4-3"]]);

    const { id } = args;
    const product = await productService.findOne({ _id: id });
    if (!product) throw new Error("Product not found");

    return await productService.updateOne(id, { active: !product.active });
  },
};

const Product = {};

export default {
  Query,
  Mutation,
  Product,
};
