import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiChevronUp,
  HiDownload,
  HiOutlineFilter,
  HiOutlinePuzzle,
  HiOutlineSearch,
  HiOutlineTrash,
  HiPlay,
} from "react-icons/hi";
import { RiChromeLine, RiDatabase2Line, RiLoader4Line, RiSendPlaneLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { formatDuration, formatSessionTime, ScrapeCsvSession } from "../scrape-csv-history";
import {
  downloadCsvText,
  downloadShopeeExtensionPackage,
  loadScrapeCsvSessions,
  openShopeeAffiliateBrowser,
  removeAllScrapeCsvSessions,
  removeScrapeCsvSession,
  syncExtensionCsvToIdb,
} from "../scrape/api";
import {
  PanelListCard,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusItem } from "../types";

const MARKET_OPTIONS = [
  { value: "affiliate.shopee.vn", label: "VN" },
  { value: "affiliate.shopee.ph", label: "PH" },
  { value: "affiliate.shopee.sg", label: "SG" },
  { value: "affiliate.shopee.co.th", label: "TH" },
  { value: "affiliate.shopee.com.my", label: "MY" },
  { value: "affiliate.shopee.co.id", label: "ID" },
];

const GUIDE_STEPS = [
  {
    step: "01",
    titleKey: "Cài extension",
    descKey: "Tải ZIP → chrome://extensions → Load unpacked → bật Viet-Theo-Bridge.",
    Icon: HiOutlinePuzzle,
  },
  {
    step: "02",
    titleKey: "Chọn quốc gia & mở trình duyệt",
    descKey: "Chọn market (VN, PH…) rồi bấm Mở Trình duyệt — mở đúng trang product_offer của quốc gia đó.",
    Icon: RiChromeLine,
  },
  {
    step: "03",
    titleKey: "Bắt list API",
    descKey: "Trên Affiliate: tìm kiếm / lọc / lật trang. Domain tự nhận từ tab đang mở.",
    Icon: HiOutlineSearch,
  },
  {
    step: "04",
    titleKey: "Gửi CSV",
    descKey: "Mở popup extension → chọn Số SP / Delay → Gửi. Web lưu phiên vào data.",
    Icon: RiSendPlaneLine,
  },
  {
    step: "05",
    titleKey: "Lọc & tải",
    descKey: "Select Domain / Ngày / Tháng / Năm bên dưới chỉ lọc danh sách CSV đã lưu.",
    Icon: HiOutlineFilter,
  },
];

interface ScrapeDataPanelProps {
  onImportItems?: (fileName: string, items: AffiliatePlusItem[]) => void | Promise<void>;
}

function sessionLocalParts(ts: number) {
  const d = new Date(ts);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

/** Tab Cào dữ liệu — mở browser + danh sách CSV từ extension (IndexedDB). */
export function ScrapeDataPanel(_props: ScrapeDataPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [sessions, setSessions] = useState<ScrapeCsvSession[]>([]);
  const [opening, setOpening] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [syncing, setSyncing] = useState(false);
  /** Market dùng khi Mở trình duyệt → /offer/product_offer */
  const [openMarketHost, setOpenMarketHost] = useState(MARKET_OPTIONS[0].value);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [guideOpen, setGuideOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshLocal = async () => {
    setSessions(await loadScrapeCsvSessions());
  };

  useEffect(() => {
    void refreshLocal();
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          setSyncing(true);
          const list = await syncExtensionCsvToIdb();
          setSessions(list);
        } catch {
          // ignore poll errors
        } finally {
          setSyncing(false);
        }
      })();
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const domainOptions = useMemo(() => {
    const fromData = new Set(sessions.map((s) => s.marketHost).filter(Boolean) as string[]);
    const known = MARKET_OPTIONS.map((m) => m.value);
    for (const h of known) fromData.add(h);
    return Array.from(fromData).sort();
  }, [sessions]);

  const yearOptions = useMemo(() => {
    const years = new Set(sessions.map((s) => sessionLocalParts(s.createdAt).year));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDomain && s.marketHost !== filterDomain) return false;
      const { year, month, day } = sessionLocalParts(s.createdAt);
      if (filterYear && year !== Number(filterYear)) return false;
      if (filterMonth && month !== Number(filterMonth)) return false;
      if (filterDay && day !== Number(filterDay)) return false;
      return true;
    });
  }, [sessions, filterDomain, filterYear, filterMonth, filterDay]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedSessions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filterDomain, filterYear, filterMonth, filterDay, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const domainLabel = (host: string) => {
    const known = MARKET_OPTIONS.find((m) => m.value === host);
    return known ? `${known.label} — ${host}` : host;
  };

  const clearFilters = () => {
    setFilterDomain("");
    setFilterYear("");
    setFilterMonth("");
    setFilterDay("");
    setPage(1);
  };

  const handleOpenBrowser = async () => {
    try {
      setOpening(true);
      window.postMessage(
        {
          source: "viet-theo-bridge-app",
          type: "SET_API_BASE",
          apiBase: window.location.origin,
        },
        "*"
      );
      const { offerUrl } = await openShopeeAffiliateBrowser(openMarketHost);
      toast.success(
        t("Đã mở {{url}} — dùng extension để Gửi CSV", {
          url: offerUrl || `https://${openMarketHost}/offer/product_offer`,
        })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được trình duyệt"));
    } finally {
      setOpening(false);
    }
  };

  const handleDownloadExtension = async () => {
    if (downloadingExt) return;
    setDownloadingExt(true);
    try {
      await downloadShopeeExtensionPackage();
      toast.success(t("Đã tải ZIP extension — giải nén rồi Load unpacked"));
    } catch (err: any) {
      toast.error(err?.message || t("Tải extension thất bại"));
    } finally {
      setDownloadingExt(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      setSessions(await removeScrapeCsvSession(id));
      toast.warn(t("Đã xóa phiên CSV"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  const handleDeleteAll = async () => {
    if (!sessions.length) return;
    if (!window.confirm(t("Xóa tất cả danh sách CSV trong IndexedDB?"))) return;
    try {
      await removeAllScrapeCsvSessions();
      setSessions([]);
      toast.warn(t("Đã xóa tất cả phiên CSV"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  const selectClass =
    "h-8 min-w-[120px] text-xs rounded-lg border border-gray-200 bg-white px-2 disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 justify-between lg:flex-row lg:items-center">
        <div className="flex gap-3 items-center">
          <div className="flex justify-center items-center w-10 h-10 text-teal-600 bg-teal-50 rounded-xl border border-teal-200">
            <RiDatabase2Line className="text-xl" />
          </div>
          <div>
            <h3 className="m-0 text-sm font-bold text-gray-800">{t("Cào dữ liệu")}</h3>
            <p className="m-0 mt-0.5 text-xs text-gray-500">
              {t("Chọn quốc gia · Mở product_offer · Extension gửi CSV")}
            </p>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="scrape-guide-title"
        className="overflow-hidden rounded-2xl border  bg-white"
      >
        <div className={`px-4 sm:px-5 ${guideOpen ? "py-4 sm:py-5 space-y-4" : "py-3"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setGuideOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-start gap-2 text-left rounded-lg -ml-1 px-1 py-0.5 transition-colors hover:bg-white/50"
              aria-expanded={guideOpen}
              aria-controls="scrape-guide-body"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#c5d6ec] bg-white text-[#1e3a5f]">
                {guideOpen ? (
                  <HiChevronUp className="text-sm" />
                ) : (
                  <HiChevronDown className="text-sm" />
                )}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#1e3a5f]">
                  {t("Hướng dẫn")}
                  <span className="mx-1.5 font-normal text-[#8aa0bc]">·</span>
                  <span className="tracking-normal text-[#1e3a5f]">
                    {t("Quy trình cào Shopee Affiliate")}
                  </span>
                </span>
                {guideOpen ? (
                  <span className="block max-w-3xl text-[12px] leading-relaxed text-[#5b7190]">
                    {t(
                      "Chọn quốc gia trước khi Mở trình duyệt (mở /offer/product_offer). Extension bắt domain từ tab khi Gửi. Select Domain bên dưới chỉ lọc danh sách CSV."
                    )}
                  </span>
                ) : null}
              </span>
            </button>
            <h4 id="scrape-guide-title" className="sr-only">
              {t("Quy trình cào Shopee Affiliate")}
            </h4>

            <div className="flex flex-wrap gap-2 items-center shrink-0 sm:justify-end">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#1e3a5f] whitespace-nowrap">
                  {t("Quốc gia")}
                </span>
                <select
                  value={openMarketHost}
                  onChange={(e) => setOpenMarketHost(e.target.value)}
                  disabled={opening}
                  className="h-9 min-w-[148px] text-xs font-semibold rounded-lg border border-[#b8cce6] bg-white px-2 text-[#1e3a5f] disabled:opacity-50"
                  aria-label={t("Quốc gia Affiliate")}
                >
                  {MARKET_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.value}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={downloadingExt}
                onClick={() => void handleDownloadExtension()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#b8cce6] bg-white px-3 text-[11px] font-semibold text-[#1e3a5f] shadow-sm transition-colors hover:bg-[#f4f8fd] disabled:opacity-50"
              >
                {downloadingExt ? (
                  <RiLoader4Line className="text-sm animate-spin" />
                ) : (
                  <HiDownload className="text-sm" />
                )}
                {t("Tải extension")}
              </button>
              <button
                type="button"
                disabled={opening}
                onClick={() => void handleOpenBrowser()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {opening ? (
                  <RiLoader4Line className="text-base animate-spin" />
                ) : (
                  <HiPlay className="text-base" />
                )}
                {t("Mở Trình duyệt")}
              </button>
            </div>
          </div>

          {guideOpen ? (
            <div id="scrape-guide-body" className="space-y-4">
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 m-0 p-0 list-none">
                {GUIDE_STEPS.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <li
                      key={item.step}
                      className="relative flex min-h-[132px] flex-col rounded-xl border border-[#d5e2f2] bg-[#f7faff]/95 p-3.5 shadow-[0_1px_0_rgba(30,58,95,0.03)] transition-colors hover:border-[#b8cce6] hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[22px] font-semibold leading-none tracking-tight text-[#c5d4e8]">
                          {item.step}
                        </span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9e6f5] bg-white text-[#4a6a8f]">
                          <Icon className="text-[15px]" />
                        </span>
                      </div>
                      <div className="space-y-1 pt-2">
                        <p className="m-0 text-[13px] font-bold text-[#1a2b4b]">
                          {t(item.titleKey)}
                        </p>
                        <p className="m-0 text-[11px] leading-relaxed text-[#6b809c]">
                          {t(item.descKey)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="border-t border-[#d5e2f2] pt-3">
                <p className="m-0 text-[11px] leading-relaxed text-[#5b7190]">
                  <span className="font-semibold text-[#1e3a5f]">{t("Mẹo")}:</span>{" "}
                  {t(
                    "Mặc định VN mở https://affiliate.shopee.vn/offer/product_offer. Chọn PH/SG/… để mở đúng market trước khi gắn extension."
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="p-4 space-y-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2 items-center">
            <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {t("Danh sách cào (CSV)")}
            </p>
            {syncing ? <RiLoader4Line className="text-teal-600 animate-spin text-sm" /> : null}
            <span className="text-10 text-gray-400">
              {filteredSessions.length}/{sessions.length}
            </span>
          </div>
          <button
            type="button"
            disabled={!sessions.length}
            onClick={() => void handleDeleteAll()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40"
          >
            <HiOutlineTrash />
            {t("Xóa tất cả")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Domain")}</p>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {domainOptions.map((host) => (
                <option key={host} value={host}>
                  {domainLabel(host)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Năm")}</p>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Tháng")}</p>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Ngày")}</p>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {String(d).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          {(filterDomain || filterYear || filterMonth || filterDay) && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 px-2.5 text-xs font-semibold text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {t("Xóa lọc")}
            </button>
          )}
        </div>

        {!sessions.length ? (
          <PanelListCard>
            <div className={panelListClasses.empty}>
              {t("Chưa có CSV. Mở trình duyệt → trên extension bấm Gửi.")}
            </div>
          </PanelListCard>
        ) : !filteredSessions.length ? (
          <PanelListCard>
            <div className={panelListClasses.empty}>{t("Không có phiên khớp bộ lọc.")}</div>
          </PanelListCard>
        ) : (
          <>
            <PanelListCard>
              <div className="overflow-auto max-h-[420px]">
              <table className={panelListClasses.table}>
                <thead className="sticky top-0 z-10">
                  <tr className={panelListClasses.theadTr}>
                    <th className={`${panelListClasses.th} text-left`}>{t("Thời gian")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Domain")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Keyword")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("SP")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Thực hiện")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("ID")}</th>
                    <th className={`${panelListClasses.th} text-left`} />
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {pagedSessions.map((s) => (
                    <tr key={s.id} className={panelListRowClass()}>
                      <td className={`${panelListClasses.td} whitespace-nowrap text-gray-700`}>
                        {formatSessionTime(s.createdAt)}
                      </td>
                      <td className={`${panelListClasses.td} max-w-[160px] truncate`} title={s.marketHost}>
                        {s.marketHost ? domainLabel(s.marketHost) : "—"}
                      </td>
                      <td className={`${panelListClasses.td} max-w-[140px] truncate`} title={s.keyword}>
                        {s.keyword || "—"}
                      </td>
                      <td className={`${panelListClasses.td} font-semibold text-gray-800`}>{s.productCount}</td>
                      <td className={`${panelListClasses.td} text-gray-600`}>{formatDuration(s.durationMs)}</td>
                      <td
                        className={`${panelListClasses.td} font-mono text-10 text-gray-400 max-w-[120px] truncate`}
                        title={s.id}
                      >
                        {s.id}
                      </td>
                      <td className={panelListClasses.td}>
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              downloadCsvText(s.csv, `scrape-${s.keyword || "export"}-${s.id}.csv`)
                            }
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-10 font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <HiDownload />
                            CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteOne(s.id)}
                            className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-10 font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </PanelListCard>

            <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
              <div className="flex gap-2 items-center text-xs text-gray-500">
                <span>
                  {t("Trang")} {safePage}/{totalPages}
                  <span className="mx-1 text-gray-300">·</span>
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filteredSessions.length)} /{" "}
                  {filteredSessions.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                  className="h-7 text-xs rounded-md border border-gray-200 bg-white px-1.5"
                  aria-label={t("Số dòng mỗi trang")}
                >
                  {[10, 20, 50, 100].map((n) => (
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
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
                  .reduce<number[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push(-p);
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
                        onClick={() => setPage(p)}
                        className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition-colors ${
                          p === safePage
                            ? "border-teal-300 bg-teal-50 text-teal-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={t("Trang sau")}
                >
                  <HiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
