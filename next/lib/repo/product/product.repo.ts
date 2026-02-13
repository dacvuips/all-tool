import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export enum PreOrder {
  YES = "YES", // Có
  NO = "NO", // Không
}

export enum OtherInfoStatus {
  NEW = "NEW", // MỚI
  USED = "USED", // Đã sử dụng
}

export interface ProductDelivery {
  weight?: number;
  width?: number;
  length?: number;
  height?: number;
  price?: number;
}

export interface ProductOtherInfo {
  preOrder?: PreOrder;
  preOrderDay?: number;
  status?: OtherInfoStatus;
  sku?: string;
}

export interface ProductTierOption {
  code?: string;
  name: string;
  imageUrl?: string;
}

export interface ProductTier {
  code?: string;
  name: string;
  options: ProductTierOption[];
}

export interface ProductVariant {
  code?: string;
  sku: string;
  price: number;
  stock: number;
  optionCodes: string[];
}

export interface ProductClassification {
  tiers?: ProductTier[];
  variants?: ProductVariant[];
  originalPrice?: number;
  totalStock?: number;
}

export interface Product extends BaseModel {
  id?: string;
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  imgs?: string[];
  categoryId?: string;
  active?: boolean;
  slug?: string;
  minPrice?: number;
  maxPrice?: number;
  categoryProperties?: any;
  delivery?: ProductDelivery;
  otherInfo?: ProductOtherInfo;
  classification?: ProductClassification;
}

export class ProductRepository extends CrudRepository<Product> {
  apiName: string = "Product";
  displayName: string = t("sản phẩm");
  shortFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg 
    active
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    video
    coverImg
    imgs
    categoryId
    active
    slug
    minPrice
    maxPrice
    categoryProperties
    delivery {
      weight
      width
      length
      height
      price
    }
    otherInfo {
      preOrder
      preOrderDay
      status
      sku
    }
    classification {
      originalPrice 
      totalStock 
      tiers {     
        code 
        name 
        options {
          code 
          name
          imageUrl
        }
      }
      variants {
        code
        sku
        price
        stock
        optionCodes
      }
    }
  `);
  getDetailFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    video
    coverImg
    imgs
    categoryId
    active
    slug
    categoryProperties
    classification {
      originalPrice 
      totalStock 
      tiers {     
        code 
        name 
        options {
          code 
          name
          imageUrl
        }
      }
      variants {
        code
        sku
        price
        stock
        optionCodes
      }
    }
  `);
  async getProductSlug(slug: string) {
    return await this.query({
      query: `getProductSlug(slug:"${slug}"){
        ${this.getDetailFragment}
      }`,
      options: { fetchPolicy: "no-cache" },
    }).then((res) => res.data.g0);
  }

  async getActiveProducts(options?: any) {
    return await this.getAll({
      query: options || { limit: 20 },
      fragment: this.parseFragment(`
        id
        name
        coverImg
        slug
        minPrice
        maxPrice
        classification {
          originalPrice
        }
      `),
      apiName: "getActiveProducts",
    });
  }

  async toggleActive(id: string) {
    return await this.mutate({
      mutation: `toggleActiveProduct(id: "${id}") {
        ${this.shortFragment}
      }`,
    }).then((res) => res.data.g0);
  }
}

export const ProductService = new ProductRepository();
