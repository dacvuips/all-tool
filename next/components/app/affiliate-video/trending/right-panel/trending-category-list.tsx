/**
 * trending-category-list.tsx
 * Hiển thị danh sách trending categories + trending items theo từng category.
 * Mỗi category load trending items riêng với phân trang (getTrendingsByCategoryId).
 * Giao diện professional: accordion-style categories, grid card items
 * Tailwind CSS, i18n, dùng component có sẵn trong source.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import {
  RiEyeLine,
  RiFileCopyLine,
  RiFireFill,
  RiFireLine,
  RiRefreshLine,
  RiSearchLine,
} from "react-icons/ri";

import { BsBookmarkStarFill } from "react-icons/bs";
import { Button } from "../../../../shared/utilities/form";
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
const ALL_CATEGORY_ID = "__all__";

/** Extract hashtags from prompt text */
const extractHashtags = (prompt: string): string[] => {
  if (!prompt) return [];
  const words = prompt.split(/\s+/);
  // Take some meaningful words and create hashtags
  const keywords = words
    .filter((w) => w.length > 3 && /^[a-zA-ZÀ-ỹ]/.test(w))
    .slice(0, 3)
    .map((w) => `#${w.replace(/[^a-zA-ZÀ-ỹ0-9]/g, "")}`);
  return keywords;
};

// ── TrendingCard – hiển thị 1 trending item (dark theme) ─────────────────
const TrendingCard = ({
  item,
  categoryName,
  onUsePrompt,
}: {
  item: TrendingPublicItem;
  categoryName?: string;
  onUsePrompt: (prompt: string) => void;
}) => {
  const { t } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const firstImage = item.imageUrls?.[0];
  const hashtags = useMemo(() => extractHashtags(item.prompt), [item.prompt]);

  return (
    <div className="group relative rounded-xl overflow-hidden bg-white p-1.5 gap-2  transition-all duration-300 border border-primary-dark  flex flex-col">
      {/* Image */}
      <div className="aspect-[4/3] bg-gradient-to-br from-[#0f1923] to-[#1a2332] overflow-hidden relative">
        {firstImage ? (
          <Img
            lazyload={false}
            showImageOnClick
            rounded
            src={firstImage}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">
            🎬
          </div>
        )}
      </div>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          setIsBookmarked(!isBookmarked);
        }}
        className="absolute top-2 right-2 z-10 p-0.5"
        tooltip={t("Đánh dấu")}
        icon={
          isBookmarked ? (
            <BsBookmarkStarFill className="text-20 text-success" />
          ) : (
            <BsBookmarkStarFill className="text-20" />
          )
        }
      />
      {/* Title row: Name + Bookmark + Copy */}
      <div className=" flex items-start gap-2 w-full">
        <div className="flex items-center gap-1.5 justify-between min-w-0 flex-1">
          {/* Category tag */}
          {categoryName && (
            <div className="bg-white bg-opacity-70 font-semibold px-1 py-0.5 text-emerald-400 text-base rounded-md border min-w-0 truncate">
              🌿 {categoryName}
            </div>
          )}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onUsePrompt(item.prompt || item.name);
            }}
            outline
            info
            className="rounded-lg px-1 h-7 whitespace-nowrap font-normal text-10"
            text={t("Sao chép")}
            icon={<RiFileCopyLine className="text-14 " />}
          ></Button>
        </div>
      </div>

      <div className="flex-1  font-bold text-primary line-clamp-1 leading-snug m-0  items-center pl-1">
        {item.name}
      </div>
      {/* Prompt section (dark, max 3 lines) */}
      {item.prompt && (
        <div className=" bg-white rounded-lg border border-gray-200">
          <p className="text-12 text-gray-400 leading-relaxed line-clamp-3 m-0 max-w-full overflow-ellipsis text-ellipsis-2 px-1">
            {item.prompt}
          </p>
        </div>
      )}

      {/* Footer: stats + hashtags */}
      <div className="mt-auto flex items-center gap-3 flex-wrap">
        {/* Fire count */}
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiFireLine className="text-orange-400/70 text-xs" />
          {item.count || 0}
        </span>
        {/* Eye count */}
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiEyeLine className="text-gray-500 text-xs" />0
        </span>
        {/* Hashtags */}
        {hashtags.length > 0 && (
          <span className="text-[10px] text-blue-400/60 truncate">{hashtags.join(" ")}</span>
        )}
      </div>
    </div>
  );
};

// ── CategorySection – hiển thị 1 category với trending items phân trang ──
const CategorySection = ({
  category,
  searchText,
  onUsePrompt,
}: {
  category: TrendingCategoryPublicItem;
  defaultExpanded?: boolean;
  searchText?: string;
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
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result = await getTrendingsByCategoryId(
          category.id,
          pageNum,
          ITEMS_PER_PAGE,
          search || undefined
        );
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
    [getTrendingsByCategoryId, category.id, searchText]
  );

  // Auto-load on mount and when search changes
  useEffect(() => {
    setPage(1);
    setHasLoaded(false);
  }, [searchText]);

  useEffect(() => {
    if (!hasLoaded) {
      loadItems(1, searchText);
    }
  }, [hasLoaded, loadItems, searchText]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadItems(newPage, searchText);
    },
    [loadItems, searchText]
  );

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Category header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-100 m-0 truncate">{category.name}</h3>
        {total > 0 && (
          <span className="text-[10px] text-gray-500 font-medium ml-2 shrink-0">
            {total} {t("trending")}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && !hasLoaded && (
        <div className="flex items-center justify-center py-6">
          <CgSpinner className="animate-spin text-xl text-blue-400 mr-2" />
          <span className="text-xs text-gray-500">{t("Đang tải...")}</span>
        </div>
      )}

      {/* Trending items grid */}
      {hasLoaded && items.length > 0 && (
        <>
          <div
            className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {items.map((item) => (
              <TrendingCard
                key={item.id}
                item={item}
                categoryName={category.name}
                onUsePrompt={onUsePrompt}
              />
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
        <div className="text-center py-6 text-xs text-gray-500">
          {t("Chưa có trending nào trong danh mục này")}
        </div>
      )}
    </div>
  );
};

// ── CategoryTabBar – thanh tab danh mục ngang ───────────────────────────
const CategoryTabBar = ({
  categories,
  activeId,
  onSelect,
}: {
  categories: TrendingCategoryPublicItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => {
    const allTab = { id: ALL_CATEGORY_ID, name: t("Tất cả"), isHot: false };
    return [allTab, ...categories.map((c) => ({ id: c.id, name: c.name, isHot: c.isHot }))];
  }, [categories, t]);

  return (
    <div className="relative flex-shrink-0">
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto v-scrollbar pb-1 px-0.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                whitespace-nowrap transition-all duration-200 cursor-pointer border-0
                ${
                  isActive
                    ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                    : "bg-[#1a2332] text-gray-400 hover:bg-[#243040] hover:text-gray-200 border border-[#2a3a4a]"
                }
              `}
            >
              {tab.isHot && <RiFireFill className="text-orange-400 text-[11px]" />}
              {tab.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── SearchInput – ô tìm kiếm trending theo name ─────────────────────────
const SearchInput = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const { t } = useTranslation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Update input immediately
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className="relative flex-shrink-0">
      <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={t("Tìm kiếm trending...")}
        className="w-full pl-8 pr-3 py-1.5 text-xs text-gray-200 bg-[#1a2332] border border-[#2a3a4a] rounded-lg
          focus:outline-none focus:border-blue-500/50 focus:bg-[#1e2a3a] focus:ring-1 focus:ring-blue-500/20
          placeholder:text-gray-600 transition-all duration-200"
      />
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
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ALL_CATEGORY_ID);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

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

  // Visible categories based on active tab
  const visibleCategories = useMemo(() => {
    if (activeCategoryId === ALL_CATEGORY_ID) return categories;
    return categories.filter((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

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
        <span className="text-sm text-gray-400 font-medium">
          {t("Đang tải danh sách trending...")}
        </span>
      </div>
    );
  }

  // ── Empty state ──
  if (hasLoaded && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-[#1a2332] flex items-center justify-center mb-3">
          <span className="text-2xl">🔥</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-300 mb-1">{t("Chưa có trending nào")}</h3>
        <p className="text-xs text-gray-500 text-center mb-4">
          {t("Các trending sẽ xuất hiện khi được quản trị viên thiết lập")}
        </p>
        <button
          onClick={loadCategories}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer border border-blue-500/20"
        >
          <RiRefreshLine className="text-sm" />
          {t("Thử lại")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1923]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 xs:px-3 py-2 xs:py-2.5 border-b border-[#1a2332] flex-shrink-0">
        <button
          onClick={loadCategories}
          className="p-1 xs:p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={t("Làm mới")}
        >
          <RiRefreshLine className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Category tabs + Search */}
      <div className="px-2 xs:px-3 pt-2 space-y-2 flex-shrink-0">
        {/* Tab bar */}
        <CategoryTabBar
          categories={categories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
        />

        {/* Search input */}
        <SearchInput value={searchInput} onChange={setSearchInput} />
      </div>

      {/* Categories list */}
      <div className="flex-1 overflow-y-auto v-scrollbar p-2 xs:p-3 space-y-4">
        {visibleCategories.map((cat, index) => (
          <CategorySection
            key={cat.id}
            category={cat}
            defaultExpanded={index === 0}
            searchText={debouncedSearch}
            onUsePrompt={handleUsePrompt}
          />
        ))}
      </div>
    </div>
  );
};
