import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface ArtStyleCategory extends BaseModel {
  name: string;
  isHot: boolean;
  isActive: boolean;
  artStyleIds: string[];
  priority: number;
}

/** Public art style item for customer */
export interface ArtStylePublicItem {
  id: string;
  name: string;
  imageUrls: string[];
  prompt: string;
  count: number;
  price: number;
  promptShort: string;
  des: string;
  isPublish: boolean;
  monthlyCount: number;
  isActive: boolean;
}

/** Public art style category with resolved art style items */
export interface ArtStyleCategoryPublicItem {
  id: string;
  name: string;
  isHot: boolean;
  priority: number;
  artStyleItems: ArtStylePublicItem[];
}

/** Paginated art style items result */
export interface ArtStylesByCategoryResult {
  data: ArtStylePublicItem[];
  total: number;
  pagination?: { limit?: number; page?: number; total?: number };
}

/** Input data for creating/updating customer art style */
export interface CustomerArtStyleInput {
  name: string;
  prompt?: string;
  imageUrls?: string[];
  des?: string;
  isPublish?: boolean;
  artStyleCategoryIds?: string[];
  price?: number;
}

export class ArtStyleCategoryRepository extends CrudRepository<ArtStyleCategory> {
  apiName: string = "ArtStyleCategory";
  displayName: string = t("danh mục art style");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    isHot: Boolean
    isActive: Boolean
    artStyleIds: [ID]
    priority: Int
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    isHot: Boolean
    isActive: Boolean
    artStyleIds: [ID]
    priority: Int
  `);

  /**
   * Lấy danh sách ArtStyleCategory đang active (chỉ category info, không kèm items).
   * Dùng custom query `getActiveArtStyleCategoryList` (public, customer-accessible).
   */
  async getActiveArtStyleCategoryList(): Promise<ArtStyleCategoryPublicItem[]> {
    try {
      const result = await this.query({
        query: `getActiveArtStyleCategoryList { id name isHot priority }`,
        options: {
          fetchPolicy: "network-only",
        },
      });
      this.handleError(result);
      return (result.data?.["g0"] || []) as ArtStyleCategoryPublicItem[];
    } catch (err) {
      console.error("[getActiveArtStyleCategoryList] Error:", err);
      return [];
    }
  }

  /**
   * Lấy danh sách art style items theo category ID, có phân trang.
   */
  async getArtStylesByCategoryId(
    categoryId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<ArtStylesByCategoryResult> {
    try {
      const filter: any = { isActive: true };
      if (categoryId) {
        filter.artStyleCategoryIds = { $in: [categoryId] };
      }
      const result = await this.getAll({
        apiName: "getArtStylesByCategoryId",
        query: {
          page,
          limit,
          search: search || undefined,
          filter,
          order: { count: -1 },
        },
        fragment: `id name imageUrls  count price promptShort artStyleCategoryIds isPublish isActive`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as ArtStylePublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error("[getArtStylesByCategoryId] Error:", err);
      return { data: [], total: 0 };
    }
  }

  /**
   * Lấy prompt của art style theo ID.
   * Gọi custom query `getArtStylePromptById(id)` → trả về prompt string.
   */
  async getArtStylePromptById(artStyleId: string): Promise<string | null> {
    try {
      const result = await this.query({
        query: `getArtStylePromptById(id: "${artStyleId}") { id prompt }`,
        options: {
          fetchPolicy: "network-only",
        },
      });
      this.handleError(result);
      const data = result.data?.["g0"];
      return data?.prompt || null;
    } catch (err) {
      console.error("[getArtStylePromptById] Error:", err);
      return null;
    }
  }

  /**
   * Lấy danh sách art style do chính customer hiện tại tạo, có phân trang.
   */
  async getCustomerArtStyleList(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<ArtStylesByCategoryResult> {
    try {
      const result = await this.getAll({
        apiName: "getCustomerArtStyleList",
        query: {
          page,
          limit,
          search: search || undefined,
          order: { createdAt: -1 },
        },
        fragment: `id name imageUrls prompt count price promptShort des isPublish artStyleCategoryIds createdAt monthlyCount isActive`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as ArtStylePublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error("[getCustomerArtStyleList] Error:", err);
      return { data: [], total: 0 };
    }
  }

  /**
   * Lấy bảng xếp hạng art style theo monthlyCount (giảm dần).
   */
  async getArtStyleRank(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<ArtStylesByCategoryResult> {
    try {
      const result = await this.getAll({
        apiName: "getArtStylesByCategoryId",
        query: {
          page,
          limit,
          search: search || undefined,
          filter: { isActive: true },
          order: { monthlyCount: -1 },
        },
        fragment: `id name imageUrls count price promptShort monthlyCount`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as ArtStylePublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error("[getArtStyleRank] Error:", err);
      return { data: [], total: 0 };
    }
  }
}

export const ArtStyleCategoryService = new ArtStyleCategoryRepository();
