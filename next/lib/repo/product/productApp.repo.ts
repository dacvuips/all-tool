import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
 
export interface ProductApp extends BaseModel {
  id?: string;
  name?: string;
  des?: string;
  coverImg?: string;
  categoryIds?: string[];
  active?: boolean;
  slug?: string;
  priority?: number;
  creditCost?: number;
 
 
}

export enum AiProviderKeyEnum{
  OPENAI_KEY = "OPENAI_KEY",
  CLAUDE_KEY = "CLAUDE_KEY",
  GOOGLE_GEMINI_KEY = "GOOGLE_GEMINI_KEY",
  DEEP_SEEK_KEY = "DEEP_SEEK_KEY",
  KLING_KEY = "KLING_KEY",
  SEE_DANCE_KEY = "SEE_DANCE_KEY",
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ProductAppRepository extends CrudRepository<ProductApp> {
  apiName: string = "ProductApp";
  displayName: string = t("sản phẩm app");
  shortFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    active
    slug
    creditCost
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    categoryIds
    active
    slug
    priority
    creditCost
  `);
  getDetailFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    categoryIds
    active
    slug
    priority
    creditCost
  `);

  async getProductAppSlug(slug: string) {
    return await this.query({
      query: `getProductAppSlug(slug:"${slug}"){
        ${this.getDetailFragment}
      }`,
      options: { fetchPolicy: "no-cache" },
    }).then((res) => res.data.g0);
  }

  async getActiveProductApps(options?: any) {
    return await this.getAll({
      query: options || { limit: 20 },
      fragment: this.parseFragment(`
        id
        name
        coverImg
        slug
        creditCost
      `),
      apiName: "getActiveProductApps",
    });
  }

  async toggleActive(id: string) {
    return await this.mutate({
      mutation: `toggleActiveProductApp(id: "${id}") {
        ${this.shortFragment}
      }`,
    }).then((res) => res.data.g0);
  }

 
}

export const ProductAppService = new ProductAppRepository();
