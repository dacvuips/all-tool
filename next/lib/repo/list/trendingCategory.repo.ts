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
  price: number;
}

/** Public trending category with resolved trending items */
export interface TrendingCategoryPublicItem {
  id: string;
  name: string;
  isHot: boolean;
  priority: number;
  trendingItems: TrendingPublicItem[];
}

/** Paginated trending items result */
export interface TrendingsByCategoryResult {
  data: TrendingPublicItem[];
  total: number;
  pagination?: { limit?: number; page?: number; total?: number };
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
   * Lấy danh sách TrendingCategory đang active (chỉ category info, không kèm items).
   * Dùng custom query `getActiveTrendingCategoryList` (public, customer-accessible).
   */
  async getActiveTrendingCategoryList(): Promise<TrendingCategoryPublicItem[]> {
    try {
      const result = await this.query({
        query: `getActiveTrendingCategoryList { id name isHot priority }`,
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

  /**
   * Lấy danh sách trending items theo category ID, có phân trang.
   * Dùng standard CrudRepository.getAll() với apiName override → getTrendingsByCategoryId(q:...)
   */
  async getTrendingsByCategoryId(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    try {
      const result = await this.getAll({
        apiName: "getTrendingsByCategoryId",
        query: {
          page,
          limit,
          search: search || undefined,
          filter: {
            trendingCategoryIds: { $in: [categoryId] },
            isActive: true,
          },
          order: { count: -1 },
        },
        fragment: `id name imageUrls prompt count price`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as TrendingPublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error("[getTrendingsByCategoryId] Error:", err);
      return { data: [], total: 0 };
    }
  }
}

export const TrendingCategoryService = new TrendingCategoryRepository();
