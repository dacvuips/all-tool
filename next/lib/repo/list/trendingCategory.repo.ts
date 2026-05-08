import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface TrendingCategory extends BaseModel {
  name: string;
  isHot: boolean;
  isActive: boolean;
  trendingIds: string[];
  priority: number;
}

/** Public trending item for customer */
export interface TrendingPublicItem {
  id: string;
  name: string;
  imageUrls: string[];
  prompt: string;
  count: number;
}

/** Public trending category with resolved trending items */
export interface TrendingCategoryPublicItem {
  id: string;
  name: string;
  isHot: boolean;
  priority: number;
  trendingItems: TrendingPublicItem[];
}

export class TrendingCategoryRepository extends CrudRepository<TrendingCategory> {
  apiName: string = "TrendingCategory";
  displayName: string = t("danh mục trending");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    isHot: Boolean
    isActive: Boolean
    trendingIds: [ID]
    priority: Int
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    isHot: Boolean
    isActive: Boolean
    trendingIds: [ID]
    priority: Int
  `);

  /**
   * Lấy danh sách TrendingCategory đang active kèm trending items đã resolve.
   * Dùng custom query `getActiveTrendingCategoryList` (public, customer-accessible).
   */
  async getActiveTrendingCategoryList(): Promise<TrendingCategoryPublicItem[]> {
    try {
      const result = await this.query({
        query: `getActiveTrendingCategoryList { id name isHot priority trendingItems { id name imageUrls prompt count } }`,
        options: {
          fetchPolicy: "network-only",
        },
      });
      this.handleError(result);
      return (result.data?.["g0"] || []) as TrendingCategoryPublicItem[];
    } catch (err) {
      console.error("[getActiveTrendingCategoryList] Error:", err);
      return [];
    }
  }
}

export const TrendingCategoryService = new TrendingCategoryRepository();
