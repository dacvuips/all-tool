/**
 * trending-prompt-rank.tsx
 * Bảng xếp hạng trending prompt theo monthlyCount (giảm dần).
 * Giao diện bảng rank chuyên nghiệp, hiển thị ảnh thumbnail, tên, lượt dùng tháng.
 * Tailwind CSS, i18n, phân trang.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import { RiFireFill, RiMedalFill, RiRefreshLine, RiSearchLine, RiTrophyFill } from "react-icons/ri";

import { parseNumber } from "../../../../../lib/helpers/parser";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Input } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { PaginationComponent } from "../../../../shared/utilities/pagination/pagination-component";
import {
  TrendingPublicItem,
  TrendingsByCategoryResult,
  useAffiliateVideoApi,
} from "../../hook/useAffiliateVideoApi";

// ── Constants ────────────────────────────────────────────────────────────────
const RANK_PER_PAGE = 20;

// ── Rank badge colors ─────────────────────────────────────────────────────
const getRankStyle = (rank: number) => {
  if (rank === 1)
    return {
      bg: "bg-gradient-to-r from-yellow-50 to-amber-50",
      border: "border-orange border-dashed",
      badge: "bg-white border",
      icon: <RiTrophyFill className="text-sm text-yellow-400" />,
      textColor: "text-primary",
    };
  if (rank === 2)
    return {
      bg: "bg-gradient-to-r from-blue-100 to-slate-50",
      border: "border-orange border-dashed",
      badge: "border bg-white",
      icon: <RiMedalFill className="text-sm text-blue-500" />,
      textColor: "text-gray",
    };
  if (rank === 3)
    return {
      bg: "bg-gradient-to-r from-pink-50 to-slate-50",
      border: "border-orange border-dashed",
      badge: "border bg-white",
      icon: <RiMedalFill className="text-sm text-pink" />,
      textColor: "text-orange-700",
    };
  return {
    bg: "bg-white hover:bg-gray-50",
    border: "border-gray",
    badge: "bg-gray-100 text-gray-500",
    icon: null,
    textColor: "text-gray-700",
  };
};

// ── Format number compact ────────────────────────────────────────────────
const formatCompact = (num: number): string => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toString();
};

// ── RankRow ───────────────────────────────────────────────────────────────
const RankRow = ({
  item,
  rank,
  isSearching,
}: {
  item: TrendingPublicItem;
  rank: number;
  isSearching?: boolean;
}) => {
  const { t } = useTranslation();
  const firstImage = item.imageUrls?.[0];
  const style = isSearching ? getRankStyle(999) : getRankStyle(rank);
  const isTopThree = !isSearching && rank <= 3;

  return (
    <div
      className={` bg
        group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
        border ${style.border} ${style.bg}
        ${isTopThree ? "shadow-sm" : "hover:shadow-sm"}
      `}
    >
      {/* Rank badge – ẩn khi đang search */}
      {!isSearching && (
        <div
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            font-bold text-sm ${style.badge} transition-transform duration-200
            ${isTopThree ? "scale-110" : "group-hover:scale-105"}
          `}
        >
          {style.icon || rank}
        </div>
      )}

      {/* Thumbnail */}
      <div className="overflow-hidden flex-shrink-0 w-10 h-10 rounded-lg border border-gray-100">
        {firstImage ? (
          <Img
            showImageOnClick
            lazyload={false}
            src={firstImage}
            alt={item.name}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex justify-center items-center w-full h-full text-lg bg-gradient-to-br from-gray-100 to-gray-200">
            🎬
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${style.textColor}`}>{item.name}</div>
        {item.promptShort && (
          <p className="text-12 text-gray-400 line-clamp-1 mt-0.5 m-0 leading-tight">
            {item.promptShort}
          </p>
        )}
      </div>

      {/* Monthly count (main metric) */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <div className="flex flex-col items-end">
          <div className="flex gap-1 items-center">
            <RiFireFill
              className={`text-sm ${isTopThree ? "text-orange-400" : "text-orange-300"}`}
            />
            <span
              className={`text-sm font-bold tabular-nums ${
                isTopThree ? "text-orange-500" : "text-gray-600"
              }`}
            >
              {formatCompact(item.monthlyCount || 0)}
            </span>
          </div>
          <span className="text-[9px] text-gray-400 whitespace-nowrap">{t("lượt/tháng")}</span>
        </div>
      </div>

      {/* Price tag */}
      <div className="flex-shrink-0">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            item.price === 0
              ? "bg-white text-success border border-emerald-200"
              : "bg-red-50 text-red-500 border border-red-200"
          }`}
        >
          {item.price === 0 ? t("Miễn phí") : parseNumber(item.price, "VND")}
        </span>
      </div>
    </div>
  );
};

// ── Summary Stats Card ────────────────────────────────────────────────────
const StatsCards = ({ total, topItem }: { total: number; topItem?: TrendingPublicItem }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {/* Top Creator */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 bg-white to-yellow-50 rounded-xl px-3 py-2.5 border border-amber-100">
        <div className="overflow-hidden flex-shrink-0 w-8 h-8 rounded-full border-2 border-amber-200">
          {topItem?.imageUrls?.[0] ? (
            <Img
              lazyload={false}
              src={topItem.imageUrls[0]}
              alt={topItem.name}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex justify-center items-center w-full h-full text-sm bg-amber-100">
              🏆
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-amber-500 font-medium">{t("Top 1 tháng này")}</div>
          <div className="text-xs font-bold text-amber-700 truncate">{topItem?.name || "—"}</div>
        </div>
      </div>

      {/* Total Prompts */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-3 py-2.5 border border-blue-100">
        <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 bg-blue-100 rounded-full">
          <RiFireFill className="text-sm text-blue-500" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-blue-500 font-medium">{t("Tổng prompt")}</div>
          <div className="text-xs font-bold text-blue-700">{parseNumber(total)}</div>
        </div>
      </div>
    </div>
  );
};

// ── Search Input ────────────────────────────────────────────────────────
const RankSearchInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="relative flex-shrink-0">
      <Input
        clearable
        value={value}
        onChange={(val: any) => onChange(typeof val === "string" ? val : val?.target?.value || "")}
        prefix={<RiSearchLine />}
        placeholder={t("Tìm kiếm prompt...")}
        className="rounded-full"
      />
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────
export const ChatBotPromptRank = ({}: {}) => {
  const { t } = useTranslation();
  const { getTrendingRank } = useAffiliateVideoApi();
  const { customer } = useAuth();
  const [items, setItems] = useState<TrendingPublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 1000);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

  const loadRank = useCallback(
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result: TrendingsByCategoryResult = await getTrendingRank(
          pageNum,
          RANK_PER_PAGE,
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
    [getTrendingRank]
  );

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
    setHasLoaded(false);
  }, [debouncedSearch]);

  // Auto-load
  useEffect(() => {
    if (!hasLoaded) {
      loadRank(1, debouncedSearch);
    }
  }, [hasLoaded, loadRank, debouncedSearch]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadRank(newPage, debouncedSearch);
    },
    [loadRank, debouncedSearch]
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    setHasLoaded(false);
  }, []);

  const topItem = items[0];

  if (!customer) {
    return (
      <div className="flex flex-col justify-center items-center py-16">
        <span className="text-sm font-medium text-gray-400">
          {t("Vui lòng đăng nhập để sử dụng tính năng này")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1923]">
      <div className="overflow-y-auto flex-1 p-2 space-y-3 v-scrollbar xs:p-3">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <RiTrophyFill className="text-lg text-amber-400" />
            <h3 className="m-0 text-sm font-bold text-gray-800">{t("Bảng xếp hạng Prompt")}</h3>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 bg-white hover:bg-gray-50 rounded-full transition-colors cursor-pointer border border-gray-200"
            title={t("Làm mới")}
          >
            <RiRefreshLine className={`text-xs ${isLoading ? "animate-spin" : ""}`} />
            {t("Làm mới")}
          </button>
        </div>

        {/* Search – luôn hiển thị, không bị ảnh hưởng bởi loading */}
        <RankSearchInput value={searchInput} onChange={setSearchInput} />
        {/* Stats cards */}
        {hasLoaded && items.length > 0 && <StatsCards total={total} topItem={topItem} />}

        {/* Loading indicator inline */}
        {isLoading && (
          <div className="flex justify-center items-center py-3">
            <CgSpinner className="mr-2 text-xl text-blue-400 animate-spin" />
            <span className="text-xs text-gray-400">{t("Đang tải...")}</span>
          </div>
        )}

        {/* Content area – mờ khi loading nhưng không unmount */}
        <div
          className={`${
            isLoading ? "opacity-40 pointer-events-none" : "transition-opacity duration-200"
          }`}
        >
          {/* Rank list */}
          {hasLoaded && items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((item, index) => (
                <RankRow
                  key={item.id}
                  item={item}
                  rank={(page - 1) * RANK_PER_PAGE + index + 1}
                  isSearching={!!debouncedSearch}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {hasLoaded && total > RANK_PER_PAGE && (
            <div className="flex justify-center pt-2">
              <PaginationComponent
                limit={RANK_PER_PAGE}
                page={page}
                total={total}
                onPageChange={handlePageChange}
                visiblePageCount={5}
                hasDots
              />
            </div>
          )}

          {/* Empty state */}
          {hasLoaded && !isLoading && items.length === 0 && (
            <div className="flex flex-col justify-center items-center py-12">
              <div className="flex justify-center items-center mb-3 w-14 h-14 bg-gray-100 rounded-full">
                <RiTrophyFill className="text-2xl text-gray-300" />
              </div>
              <div className="mb-1 text-sm font-medium text-gray-400">
                {t("Chưa có dữ liệu xếp hạng")}
              </div>
              <div className="text-xs text-gray-400">
                {t("Bảng xếp hạng sẽ cập nhật khi có lượt sử dụng")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
