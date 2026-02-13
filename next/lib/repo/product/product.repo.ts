import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export enum PropertyTypeEnum {
  TEXT = "TEXT",
  SELECT = "SELECT",
  MULTI_SELECT = "MULTI_SELECT",
  BOOLEAN = "BOOLEAN",
  NUMBER = "NUMBER",
  RADIO = "RADIO",
  CHECKBOX = "CHECKBOX",
  SWITCH = "SWITCH",
  TEXTAREA = "TEXTAREA",
}

export interface PropertySelectOption {
  key: string;
  label: string;
}

export interface Property {
  type?: PropertyTypeEnum;
  key?: string;
  label?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
  clearable?: boolean;
  options?: PropertySelectOption[];
}

export interface Product extends BaseModel {
  id?: string;
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  categoryId?: string;
  active?: boolean;
  slug?: string;
  price?: string;
  priority?: number;
  properties?: Property[];
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
    video
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
    categoryId
    active
    slug
    price
    priority
    properties {
      type
      key
      label
      placeholder
      tooltip
      required
      clearable
      options {
        key
        label
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
    categoryId
    active
    slug
    price
    priority
    properties {
      type
      key
      label
      placeholder
      tooltip
      required
      clearable
      options {
        key
        label
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
        price
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
