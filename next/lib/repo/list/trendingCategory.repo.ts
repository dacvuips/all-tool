import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { TrendingTypeEnum } from "./trending.repo";

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
  promptShort: string;
  des: string;
  isPublish: boolean;
  monthlyCount: number;
  isActive: boolean;
  type?: TrendingTypeEnum;
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

/** Input data for creating/updating customer trending / chatbot */
export interface CustomerTrendingInput {
  name: string;
  prompt?: string;
  imageUrls?: string[];
  des?: string;
  isPublish?: boolean;
  trendingCategoryIds?: string[];
  price?: number;
  type?: TrendingTypeEnum;
}

/** Trạng thái mua của customer cho 1 trending item */
export interface TrendingPurchaseStatus {
  trendingId: string;
  orderId: string;
  status: string;
  paidAt?: string;
  price?: number;
}

/** Kết quả mutation useTrendingItem – gộp thanh toán + lấy prompt */
export interface UseTrendingItemResult {
  id: string;
  prompt: string;
  orderId: string | null;
  alreadyOwned: boolean;
  charged: boolean;
  chargedAmount: number;
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
    categoryId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    type: TrendingTypeEnum = TrendingTypeEnum.PROMPT
  ): Promise<TrendingsByCategoryResult> {
    try {
      const filter: any = { isActive: true, type };
      if (categoryId) {
        filter.trendingCategoryIds = { $in: [categoryId] };
      }
      const result = await this.getAll({
        apiName: "getTrendingsByCategoryId",
        query: {
          page,
          limit,
          search: search || undefined,
          filter,
          order: { count: -1 },
        },
        fragment: `id name imageUrls count price promptShort trendingCategoryIds isPublish isActive type`,
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

  /**
   * Lấy prompt của trending theo ID.
   * Gọi custom query `getTrendingPromptById(id)` → trả về prompt string.
   */
  async getTrendingPromptById(trendingId: string): Promise<string | null> {
    try {
      const result = await this.query({
        query: `getTrendingPromptById(id: "${trendingId}") { id prompt }`,
        options: {
          fetchPolicy: "network-only",
        },
      });
      this.handleError(result);
      const data = result.data?.["g0"];
      return data?.prompt || null;
    } catch (err) {
      console.error("[getTrendingPromptById] Error:", err);
      return null;
    }
  }

  /**
   * Ghi nhận lượt dùng Flow App / AI Studio App (tăng count + monthlyCount).
   */
  async recordAppTrendingUse(trendingId: string): Promise<boolean> {
    try {
      const result = await this.mutate({
        mutation: `recordAppTrendingUse(id: "${trendingId}") { id count monthlyCount }`,
        options: {
          fetchPolicy: "no-cache",
        },
      });
      this.handleError(result);
      return !!result.data?.["g0"]?.id;
    } catch (err) {
      console.error("[recordAppTrendingUse] Error:", err);
      return false;
    }
  }

  /**
   * Mua (nếu chưa mua) + lấy prompt trong 1 lần gọi.
   * Gộp thanh toán mPoint và trả prompt – dùng khi bấm "Dùng ngay".
   */
  async useTrendingItem(trendingId: string): Promise<UseTrendingItemResult | null> {
    try {
      const result = await this.mutate({
        mutation: `useTrendingItem(trendingId: "${trendingId}") {
          id prompt orderId alreadyOwned charged chargedAmount
        }`,
        options: { fetchPolicy: "no-cache" },
      });
      this.handleError(result);
      return (result.data?.["g0"] as UseTrendingItemResult) || null;
    } catch (err) {
      console.error("[useTrendingItem] Error:", err);
      throw err;
    }
  }

  /**
   * Batch lấy trạng thái mua PAID của customer cho nhiều trending item.
   * Dùng khi render list card – hiển thị badge "Đã mua".
   */
  async getMyTrendingPurchases(trendingIds: string[]): Promise<TrendingPurchaseStatus[]> {
    if (!trendingIds.length) return [];
    try {
      const idsArg = trendingIds.map((id) => `"${id}"`).join(", ");
      const result = await this.query({
        query: `getMyTrendingPurchases(trendingIds: [${idsArg}]) {
          trendingId orderId status paidAt price
        }`,
        options: { fetchPolicy: "network-only" },
      });
      this.handleError(result);
      return (result.data?.["g0"] as TrendingPurchaseStatus[]) || [];
    } catch (err) {
      console.error("[getMyTrendingPurchases] Error:", err);
      return [];
    }
  }

  /**
   * Lấy danh sách trending do chính customer hiện tại tạo, có phân trang.
   */
  async getCustomerTrendingList(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getCustomerItemList(
      "getCustomerTrendingList",
      TrendingTypeEnum.PROMPT,
      page,
      limit,
      search
    );
  }

  /**
   * Lấy danh sách chatbot do chính customer hiện tại tạo, có phân trang.
   */
  async getCustomerChatbotList(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getCustomerItemList(
      "getCustomerChatbotList",
      TrendingTypeEnum.CHATBOT,
      page,
      limit,
      search
    );
  }

  /**
   * Lấy bảng xếp hạng trending theo monthlyCount (giảm dần).
   * Dùng cho Trending Prompt Rank table.
   */
  async getTrendingRank(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getRankByType(TrendingTypeEnum.PROMPT, page, limit, search);
  }
  async getChatbotRank(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getRankByType(TrendingTypeEnum.CHATBOT, page, limit, search);
  }

  async getCustomerFlowAppList(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getCustomerItemList(
      "getCustomerFlowAppList",
      TrendingTypeEnum.FLOW_APP,
      page,
      limit,
      search
    );
  }

  async getCustomerAiStudioAppList(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getCustomerItemList(
      "getCustomerAiStudioAppList",
      TrendingTypeEnum.AI_STUDIO_APP,
      page,
      limit,
      search
    );
  }

  async getFlowAppRank(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getRankByType(TrendingTypeEnum.FLOW_APP, page, limit, search);
  }

  async getAiStudioAppRank(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    return this.getRankByType(TrendingTypeEnum.AI_STUDIO_APP, page, limit, search);
  }

  private async getCustomerItemList(
    apiName: string,
    type: TrendingTypeEnum,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    try {
      const result = await this.getAll({
        apiName,
        query: {
          // Chỉ lọc theo type – backend tự gắn customerId.
          // Không lọc isPublish/isActive để customer thấy cả item mới tạo/chưa duyệt.
          filter: {
            type,
          },
          page,
          limit,
          search: search || undefined,
          order: { createdAt: -1 },
        },
        fragment: `id name imageUrls prompt count price promptShort des isPublish trendingCategoryIds createdAt monthlyCount isActive type`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as TrendingPublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error(`[${apiName}] Error:`, err);
      return { data: [], total: 0 };
    }
  }

  private async getRankByType(
    type: TrendingTypeEnum,
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<TrendingsByCategoryResult> {
    try {
      const result = await this.getAll({
        apiName: "getTrendingsByCategoryId",
        query: {
          page,
          limit,
          search: search || undefined,
          filter: { isActive: true, type },
          order: { monthlyCount: -1 },
        },
        fragment: `id name imageUrls count price promptShort monthlyCount`,
        cache: false,
      });
      return {
        data: (result.data || []) as any as TrendingPublicItem[],
        total: result.total || 0,
        pagination: result.pagination,
      };
    } catch (err) {
      console.error(`[getRankByType:${type}] Error:`, err);
      return { data: [], total: 0 };
    }
  }
}

export const TrendingCategoryService = new TrendingCategoryRepository();
