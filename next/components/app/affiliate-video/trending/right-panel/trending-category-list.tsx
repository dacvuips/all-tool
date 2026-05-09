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
import { RiEyeLine, RiFireFill, RiFireLine, RiRefreshLine, RiSearchLine } from "react-icons/ri";

import { BsBookmarkStarFill, BsMagic } from "react-icons/bs";
import { parseNumber } from "../../../../../lib/helpers/parser";
import { Button, Input } from "../../../../shared/utilities/form";
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

// ── TrendingCard – hiển thị 1 trending item (dark theme) ─────────────────
const TrendingCard = ({
  item,
  categoryName,
  onUseTrending,
}: {
  item: TrendingPublicItem;
  categoryName?: string;
  onUseTrending: (trendingId: string) => void;
}) => {
  const { t } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const firstImage = item.imageUrls?.[0];

  return (
    <div className="group relative rounded-xl  overflow-hidden bg-white p-1.5 gap-2  transition-all duration-300 border border-primary-dark  flex flex-col hover:shadow-2xl cursor-pointer hover:shadow-primary-100 hover:border-success-dark hover:border-2">
      {/* Image */}
      <div className="aspect-[4/3]  overflow-hidden relative">
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
        )}{" "}
        <div
          className={`text-lg absolute -bottom-0.5 -left-0.5 p-1    bg-white rounded-l-none rounded-br-none  rounded-tr-xl font-semibold ${
            item.price === 0 ? "text-success" : "text-red-500"
          }`}
        >
          {item.price === 0 ? t("Miễn phí") : parseNumber(item.price, "VND")}
        </div>
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
              onUseTrending(item.id);
            }}
            outline
            info
            className="rounded-lg px-1 h-7 whitespace-nowrap font-normal text-10"
            text={t("Dùng ngay")}
            icon={<BsMagic className="text-14 " />}
          ></Button>
        </div>
      </div>

      <div className="flex-1  font-bold text-primary line-clamp-1 leading-snug m-0  items-center pl-1">
        {item.name}
      </div>
      {/* Prompt section (dark, max 3 lines) */}
      {item.promptShort && (
        <div className=" bg-white rounded-lg border border-gray-200 border-dashed">
          <p className="text-12 text-gray-400 leading-relaxed line-clamp-3 m-0 max-w-full overflow-ellipsis text-ellipsis-2 px-2  ">
            {item.promptShort}
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
      </div>
    </div>
  );
};

// ── CategorySection – hiển thị 1 category với trending items phân trang ──
const CategorySection = ({
  category,
  categoryId,
  searchText,
  onUseTrending,
}: {
  category?: TrendingCategoryPublicItem;
  categoryId?: string;
  defaultExpanded?: boolean;
  searchText?: string;
  onUseTrending: (trendingId: string) => void;
}) => {
  const { t } = useTranslation();
  const { getTrendingsByCategoryId } = useAffiliateVideoApi();

  const [items, setItems] = useState<TrendingPublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Use explicit categoryId prop if provided, otherwise fall back to category.id
  const effectiveCategoryId = categoryId ?? category?.id;

  const loadItems = useCallback(
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result = await getTrendingsByCategoryId(
          effectiveCategoryId,
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
    [getTrendingsByCategoryId, effectiveCategoryId, searchText]
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
        <h3 className="text-sm font-bold text-gray-100 m-0 truncate">
          {category?.name || t("Tất cả")}
        </h3>
        {total > 0 && (
          <span className="text-[10px] text-gray-500 font-medium ml-2 shrink-0">
            {total} {t("Prompt")}
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
                categoryName={category?.name}
                onUseTrending={onUseTrending}
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
  loadCategories,
  isLoading,
}: {
  categories: TrendingCategoryPublicItem[];
  activeId: string;
  onSelect: (id: string) => void;
  loadCategories: () => void;
  isLoading: boolean;
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => {
    const allTab = { id: ALL_CATEGORY_ID, name: t("Tất cả"), isHot: false };
    return [allTab, ...categories.map((c) => ({ id: c.id, name: c.name, isHot: c.isHot }))];
  }, [categories, t]);

  return (
    <div className="relative flex-shrink-0 flex flex-row gap-2 items-center">
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto v-scrollbar py-1 w-full pb-2 no-scrollbar   rounded-lg px-1.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={` 
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs  bg-white
                whitespace-nowrap font-semibold transition-all duration-200 cursor-pointer  
                ${
                  isActive
                    ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                    : "  text-gray   hover:text-gray-200 border border-gray-200"
                }
              `}
            >
              {tab.isHot && <RiFireFill className="text-orange text-12 " />}
              {tab.name}
            </button>
          );
        })}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between   flex-shrink-0">
        <Button
          onClick={loadCategories}
          className="px-3 transition-all cursor-pointer border rounded-full bg-white"
          tooltip={t("Làm mới")}
          icon={<RiRefreshLine className={`text-sm ${isLoading ? "animate-spin" : ""}`} />}
        />
      </div>
    </div>
  );
};

// ── SearchInput – ô tìm kiếm trending theo name ─────────────────────────
const SearchInput = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const { t } = useTranslation();

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
      <Input
        value={value}
        onChange={handleChange}
        prefix={<RiSearchLine />}
        placeholder={t("Tìm kiếm...")}
        className="rounded-full"
      />
    </div>
  );
};

// ── TrendingCategoryList – main component ───────────────────────────────
export const TrendingCategoryList = () => {
  const { t } = useTranslation();
  const { getActiveTrendingCategoryList, getTrendingPromptById } = useAffiliateVideoApi();
  const { patchConfig, setPendingPrompt } = useAffiliateVideoContext();

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
    if (activeCategoryId === ALL_CATEGORY_ID) return [];
    return categories.filter((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

  // Khi user click "Dùng ngay" → gọi backend lấy prompt theo trending ID → gắn vào config
  const handleUseTrending = useCallback(
    async (trendingId: string) => {
      const prompt = await getTrendingPromptById(trendingId);
      if (!prompt) return;
      if (patchConfig) {
        patchConfig({ tipContent: prompt });
      }
      if (setPendingPrompt) {
        setPendingPrompt(prompt);
      }
    },
    [getTrendingPromptById, patchConfig, setPendingPrompt]
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
      {/* Categories list */}
      <div className="flex-1 overflow-y-auto v-scrollbar p-2 xs:p-3 space-y-4">
        {/* Category tabs + Search */}
        <div>
          {/* Tab bar */}
          <CategoryTabBar
            categories={categories}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
            loadCategories={loadCategories}
            isLoading={isLoading}
          />

          {/* Search input */}
          <SearchInput value={searchInput} onChange={setSearchInput} />
        </div>
        {activeCategoryId === ALL_CATEGORY_ID ? (
          <CategorySection
            key="__all__"
            searchText={debouncedSearch}
            onUseTrending={handleUseTrending}
          />
        ) : (
          visibleCategories.map((cat, index) => (
            <CategorySection
              key={cat.id}
              category={cat}
              defaultExpanded={index === 0}
              searchText={debouncedSearch}
              onUseTrending={handleUseTrending}
            />
          ))
        )}
      </div>
    </div>
  );
};
