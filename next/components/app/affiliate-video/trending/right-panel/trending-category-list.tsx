/**
 * trending-category-list.tsx
 * Hiển thị danh sách trending categories + trending items theo từng category.
 * Mỗi category load trending items riêng với phân trang (getTrendingsByCategoryId).
 * Giao diện professional: accordion-style categories, grid card items
 * Tailwind CSS, i18n, dùng component có sẵn trong source.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import { RiEyeLine, RiFileCopyLine, RiFireFill, RiRefreshLine } from "react-icons/ri";

import { Img } from "../../../../shared/utilities/misc";
import { PaginationComponent } from "../../../../shared/utilities/pagination/pagination-component";
import {
  TrendingCategoryPublicItem,
  TrendingPublicItem,
  useAffiliateVideoApi,
} from "../../hook/useAffiliateVideoApi";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

// ── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;

// ── TrendingCard – hiển thị 1 trending item ──────────────────────────────
const TrendingCard = ({
  item,
  onUsePrompt,
}: {
  item: TrendingPublicItem;
  onUsePrompt: (prompt: string) => void;
}) => {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const firstImage = item.imageUrls?.[0];

  return (
    <div className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg transition-all duration-200">
      {/* Image */}
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden relative">
        {firstImage ? (
          <Img
            showImageOnClick
            src={firstImage}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
            🎬
          </div>
        )}

        {/* Use count badge */}
        {item.count > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-[10px] text-white font-medium flex items-center gap-0.5">
            <RiEyeLine className="text-[10px]" />
            {item.count}
          </div>
        )}

        {/* Hover overlay with action buttons */}
        <div className="  flex items-end p-2">
          <div className="flex gap-1.5 w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUsePrompt(item.prompt || item.name);
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-semibold rounded-lg transition-colors cursor-pointer border-0"
            >
              <RiFileCopyLine className="text-xs" />
              {t("Dùng prompt")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPrompt(!showPrompt);
              }}
              className="px-2 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-[10px] font-medium rounded-lg transition-colors cursor-pointer border-0"
            >
              <RiEyeLine className="text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="px-2 py-2">
        <h4 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight m-0">
          {item.name}
        </h4>
      </div>

      {/* Expandable prompt section */}
      {showPrompt && item.prompt && (
        <div className="px-2 pb-2">
          <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
            <p className="text-[10px] text-gray-600 leading-relaxed line-clamp-4 m-0">
              {item.prompt}
            </p>
            <button
              onClick={() => onUsePrompt(item.prompt)}
              className="mt-1.5 w-full py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-semibold rounded-md transition-colors cursor-pointer border border-blue-200"
            >
              {t("Sử dụng prompt này")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── CategorySection – hiển thị 1 category với trending items phân trang ──
const CategorySection = ({
  category,
  onUsePrompt,
}: {
  category: TrendingCategoryPublicItem;
  defaultExpanded?: boolean;
  onUsePrompt: (prompt: string) => void;
}) => {
  const { t } = useTranslation();
  const { getTrendingsByCategoryId } = useAffiliateVideoApi();

  const [items, setItems] = useState<TrendingPublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadItems = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      try {
        const result = await getTrendingsByCategoryId(category.id, pageNum, ITEMS_PER_PAGE);
        setItems(result.data);
        setTotal(result.total);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [getTrendingsByCategoryId, category.id]
  );

  // Auto-load on mount
  useEffect(() => {
    if (!hasLoaded) {
      loadItems(1);
    }
  }, [hasLoaded, loadItems]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadItems(newPage);
    },
    [loadItems]
  );

  return (
    <div className="rounded-xl overflow-hidden   ">
      {/* Category header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800 m-0 truncate">{category.name}</h3>
        {total > 0 && (
          <span className="text-[10px] text-gray-400 font-medium ml-2 shrink-0">
            {total} {t("trending")}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && !hasLoaded && (
        <div className="flex items-center justify-center py-6">
          <CgSpinner className="animate-spin text-xl text-blue-400 mr-2" />
          <span className="text-xs text-gray-400">{t("Đang tải...")}</span>
        </div>
      )}

      {/* Trending items grid */}
      {hasLoaded && items.length > 0 && (
        <>
          <div
            className={`grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 xs:gap-2.5 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {items.map((item) => (
              <TrendingCard key={item.id} item={item} onUsePrompt={onUsePrompt} />
            ))}
          </div>

          {/* Pagination */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-3">
              <PaginationComponent
                limit={ITEMS_PER_PAGE}
                page={page}
                total={total}
                onPageChange={handlePageChange}
                visiblePageCount={5}
                hasDots
              />
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {hasLoaded && !isLoading && items.length === 0 && (
        <div className="text-center py-6 text-xs text-gray-400">
          {t("Chưa có trending nào trong danh mục này")}
        </div>
      )}
    </div>
  );
};

// ── TrendingCategoryList – main component ───────────────────────────────
export const TrendingCategoryList = () => {
  const { t } = useTranslation();
  const { getActiveTrendingCategoryList } = useAffiliateVideoApi();
  const { handleSubmit, affiliateVideoFormConfig } = useAffiliateVideoContext();

  const [categories, setCategories] = useState<TrendingCategoryPublicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getActiveTrendingCategoryList();
      setCategories(items);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [getActiveTrendingCategoryList]);

  useEffect(() => {
    if (!hasLoaded) {
      loadCategories();
    }
  }, [hasLoaded, loadCategories]);

  // Khi user click "Dùng prompt" → gọi handleSubmit với prompt text
  const handleUsePrompt = useCallback(
    (prompt: string) => {
      if (handleSubmit && affiliateVideoFormConfig) {
        handleSubmit(affiliateVideoFormConfig, prompt);
      }
    },
    [handleSubmit, affiliateVideoFormConfig]
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <CgSpinner className="animate-spin text-3xl text-blue-500 mb-3" />
        <span className="text-sm text-gray-500 font-medium">
          {t("Đang tải danh sách trending...")}
        </span>
      </div>
    );
  }

  // ── Empty state ──
  if (hasLoaded && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <span className="text-2xl">🔥</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-600 mb-1">{t("Chưa có trending nào")}</h3>
        <p className="text-xs text-gray-400 text-center mb-4">
          {t("Các trending sẽ xuất hiện khi được quản trị viên thiết lập")}
        </p>
        <button
          onClick={loadCategories}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border-0"
        >
          <RiRefreshLine className="text-sm" />
          {t("Thử lại")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 xs:px-3 py-2 xs:py-2.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-1.5 xs:gap-2">
          <div className="w-5 h-5 xs:w-6 xs:h-6 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <RiFireFill className="text-white text-[10px] xs:text-xs" />
          </div>
          <h2 className="text-xs xs:text-sm font-bold text-gray-800 m-0">
            {t("Trending Prompts")}
          </h2>
        </div>
        <button
          onClick={loadCategories}
          className="p-1 xs:p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={t("Làm mới")}
        >
          <RiRefreshLine className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Categories list */}
      <div className="flex-1 overflow-y-auto v-scrollbar p-2 xs:p-3 space-y-2 xs:space-y-2.5">
        {categories.map((cat, index) => (
          <CategorySection
            key={cat.id}
            category={cat}
            defaultExpanded={index === 0}
            onUsePrompt={handleUsePrompt}
          />
        ))}
      </div>
    </div>
  );
};
