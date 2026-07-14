import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight, HiOutlineX, HiSearch } from "react-icons/hi";

/** Shared list chrome — matched to Generate Video tab. */
export const panelListClasses = {
  card: "overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm",
  toolbar: "flex flex-wrap gap-3 justify-between items-center px-4 py-3 bg-white border-b border-gray-100",
  table: "w-full text-sm",
  theadTr:
    "text-xs tracking-wide text-gray-600 uppercase bg-gray-50 border-b border-gray-200",
  th: "px-4 py-3",
  tbody: "divide-y divide-gray-100",
  td: "px-4 py-3",
  empty: "py-16 text-sm text-center text-gray-400",
  emptyMatch: "px-4 py-10 text-sm text-center text-gray-400",
  paginationFooter:
    "flex flex-wrap gap-3 justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50/60",
  pageBtn:
    "inline-flex justify-center items-center w-7 h-7 text-gray-700 bg-white rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40",
  pageActive: "border-sky-300 bg-sky-50 text-sky-800",
  pageIdle: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  checkbox: "rounded",
} as const;

export function panelListRowClass(opts?: { selected?: boolean; error?: boolean }) {
  if (opts?.error) return "hover:bg-sky-50/30 transition-colors bg-rose-50/70";
  if (opts?.selected) return "hover:bg-sky-50/30 transition-colors bg-sky-50/50";
  return "hover:bg-sky-50/30 transition-colors bg-white";
}

export function PanelListCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${panelListClasses.card} ${className}`.trim()}>{children}</div>;
}

export function PanelListToolbar({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className={panelListClasses.toolbar}>
      {children}
      {trailing ? (
        <div className="flex gap-2 items-center text-xs text-gray-500">{trailing}</div>
      ) : null}
    </div>
  );
}

/** Improved search input (Generate Video style + clearer focus/hover). */
export function PanelListSearch({
  value,
  onChange,
  placeholder,
  clearAriaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearAriaLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative flex-1 min-w-[240px] max-w-md h-9">
      <span className="flex absolute inset-y-0 left-0 z-10 items-center pl-3 pointer-events-none text-gray-400">
        <HiSearch className="w-4 h-4 shrink-0" aria-hidden />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block pr-9 pl-9 w-full h-full text-sm leading-none text-gray-800 placeholder:text-gray-400 bg-gray-50 rounded-lg border border-gray-200 outline-none transition-colors hover:border-gray-300 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
      {value ? (
        <span className="flex absolute inset-y-0 right-0 z-10 items-center pr-1.5">
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex justify-center items-center w-6 h-6 text-gray-400 rounded-md hover:bg-gray-100 hover:text-gray-600"
            aria-label={clearAriaLabel || t("Xóa tìm kiếm")}
          >
            <HiOutlineX className="w-3.5 h-3.5 shrink-0" />
          </button>
        </span>
      ) : null}
    </div>
  );
}

export function PanelListMatchCount({
  term,
  matched,
  total,
  totalExtra,
}: {
  term?: string;
  matched: number;
  total: number;
  totalExtra?: ReactNode;
}) {
  const { t } = useTranslation();
  if (term) {
    return (
      <span>
        {t("Khớp")}: <b className="text-gray-800">{matched}</b>/{total}
        {totalExtra}
      </span>
    );
  }
  return (
    <span>
      {t("Tổng")}: <b className="text-gray-800">{total}</b>
      {totalExtra}
    </span>
  );
}

export function PanelListPagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions = [100, 200, 400, 500],
  from,
  to,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const { t } = useTranslation();
  if (total <= 0) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div className={panelListClasses.paginationFooter}>
      <div className="flex gap-3 items-center text-xs text-gray-500">
        <span>
          {t("Trang")} <b className="text-gray-800">{safePage}</b>/{totalPages}
          <span className="mx-1 text-gray-300">·</span>
          {from}–{to} / {total}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) || pageSizeOptions[0])}
          className="h-7 text-xs rounded-md border border-gray-200 bg-white px-1.5"
          aria-label={t("Số dòng mỗi trang")}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}/{t("trang")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 items-center">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className={panelListClasses.pageBtn}
          aria-label={t("Trang trước")}
        >
          <HiChevronLeft />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            if (totalPages <= 7) return true;
            if (p === 1 || p === totalPages) return true;
            return Math.abs(p - safePage) <= 1;
          })
          .reduce<number[]>((acc, p, i, arr) => {
            if (i > 0 && p - arr[i - 1] > 1) acc.push(-p);
            acc.push(p);
            return acc;
          }, [])
          .map((p) =>
            p < 0 ? (
              <span key={`e${p}`} className="px-1 text-xs text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition-colors ${
                  p === safePage ? panelListClasses.pageActive : panelListClasses.pageIdle
                }`}
              >
                {p}
              </button>
            )
          )}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className={panelListClasses.pageBtn}
          aria-label={t("Trang sau")}
        >
          <HiChevronRight />
        </button>
      </div>
    </div>
  );
}
