/**
 * Tab Mapping Account — trái: project nguồn; phải: danh sách CSV đã mapping.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiDownload, HiOutlineTrash } from "react-icons/hi";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import {
  clearMappingCsvSessions,
  deleteMappingCsvSession,
  listMappingCsvSessions,
  MappingCsvSession,
  nextMappingCsvName,
  saveMappingCsvSession,
} from "../mapping-csv-history";
import {
  formatSessionTime,
  ScrapeCsvSession,
  sessionDisplayName,
} from "../scrape-csv-history";
import { downloadCsvText, fetchGpmLoginProfiles } from "../scrape/api";
import {
  distributeProductsToAccounts,
  mappingRowsToCsv,
  MAPPING_MAX_PRODUCTS_PER_ACCOUNT,
  productRawToMappingRow,
} from "../scrape/mapping-account";
import { loadUsers } from "../storage";
import {
  PanelListCard,
  PanelListPagination,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";

const SOURCE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const MAPPED_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type Props = {
  crawlProjectSessions: ScrapeCsvSession[];
  gioVideoSessions: ScrapeCsvSession[];
  domainLabel: (host: string) => string;
  parseScrapedCsvToRaws: (csv: string) => Record<string, unknown>[];
};

/** Chỉ username — bỏ domain trong tên profile GPM (`user · shopee.vn`). */
function toMappingUsername(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  const sep = s.indexOf(" · ");
  if (sep > 0) s = s.slice(0, sep).trim();
  return s;
}

async function loadMappingAccountNames(): Promise<string[]> {
  const users = await loadUsers().catch(() => []);
  const userByProfileId = new Map<string, string>();
  for (const u of users) {
    const pid = String(u.gpmProfileId || "").trim();
    const username = toMappingUsername(String(u.username || ""));
    if (pid && username) userByProfileId.set(pid, username);
  }

  try {
    const profiles = await fetchGpmLoginProfiles();
    const names = profiles
      .map((p) => {
        const fromUser = userByProfileId.get(p.id);
        if (fromUser) return fromUser;
        return toMappingUsername(String(p.name || ""));
      })
      .filter(Boolean);
    if (names.length) return Array.from(new Set(names));
  } catch {
    // Agent offline — fallback danh sách tài khoản đã gắn
  }

  const fromUsers = users
    .map((u) => toMappingUsername(String(u.username || "")))
    .filter(Boolean);
  return Array.from(new Set(fromUsers));
}

export function MappingAccountPanel({
  crawlProjectSessions,
  gioVideoSessions,
  domainLabel,
  parseScrapedCsvToRaws,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [mappedSessions, setMappedSessions] = useState<MappingCsvSession[]>([]);
  const [sourceTab, setSourceTab] = useState(0);
  const [sourcePage, setSourcePage] = useState(1);
  const [sourcePageSize, setSourcePageSize] = useState(10);
  const [mappedPage, setMappedPage] = useState(1);
  const [mappedPageSize, setMappedPageSize] = useState(10);

  const reloadMappedSessions = useCallback(async () => {
    setMappedSessions(await listMappingCsvSessions());
  }, []);

  useEffect(() => {
    void reloadMappedSessions();
  }, [reloadMappedSessions]);

  useEffect(() => {
    setSourcePage(1);
  }, [sourceTab, sourcePageSize]);

  useEffect(() => {
    setMappedPage(1);
  }, [mappedPageSize, mappedSessions.length]);

  const sourceList =
    sourceTab === 0 ? crawlProjectSessions : gioVideoSessions;
  const sourceTotalPages = Math.max(1, Math.ceil(sourceList.length / sourcePageSize));
  const sourceSafePage = Math.min(Math.max(1, sourcePage), sourceTotalPages);
  const pagedCrawlSessions = useMemo(() => {
    const page = sourceTab === 0 ? sourceSafePage : 1;
    const start = (page - 1) * sourcePageSize;
    return crawlProjectSessions.slice(start, start + sourcePageSize);
  }, [crawlProjectSessions, sourceTab, sourceSafePage, sourcePageSize]);
  const pagedGioSessions = useMemo(() => {
    const page = sourceTab === 1 ? sourceSafePage : 1;
    const start = (page - 1) * sourcePageSize;
    return gioVideoSessions.slice(start, start + sourcePageSize);
  }, [gioVideoSessions, sourceTab, sourceSafePage, sourcePageSize]);

  const mappedTotalPages = Math.max(
    1,
    Math.ceil(mappedSessions.length / mappedPageSize)
  );
  const mappedSafePage = Math.min(Math.max(1, mappedPage), mappedTotalPages);
  const pagedMappedSessions = useMemo(() => {
    const start = (mappedSafePage - 1) * mappedPageSize;
    return mappedSessions.slice(start, start + mappedPageSize);
  }, [mappedSessions, mappedSafePage, mappedPageSize]);

  const handleMapping = async (
    session: ScrapeCsvSession,
    sourceKind: "crawl-project" | "gio-video"
  ) => {
    if (mappingId) return;
    setMappingId(session.id);
    try {
      const accounts = await loadMappingAccountNames();
      if (!accounts.length) {
        toast.warn(
          t(
            "Chưa có Profile/tài khoản. Thêm trong «Quản lý Profile» (hoặc Quản lý tài khoản) rồi thử lại."
          )
        );
        return;
      }

      const raws = parseScrapedCsvToRaws(session.csv);
      const products = raws
        .map((r) => productRawToMappingRow(r))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));

      if (!products.length) {
        toast.warn(t("Project không có sản phẩm hợp lệ (thiếu item_id / product_link)."));
        return;
      }

      const result = distributeProductsToAccounts(
        accounts,
        products,
        session.marketHost || ""
      );

      if (!result.mappedCount) {
        toast.warn(t("Không map được sản phẩm nào."));
        return;
      }

      const csv = mappingRowsToCsv(result.rows);
      const sourceName = sessionDisplayName(session);
      const saved = await saveMappingCsvSession({
        name: nextMappingCsvName(mappedSessions),
        sourceKind,
        sourceSessionId: session.id,
        sourceSessionName: sourceName,
        marketHost: session.marketHost || "",
        accountCount: result.accountCount,
        rowCount: result.mappedCount,
        productCount: result.productCount,
        skippedProducts: result.skippedProducts,
        csv,
      });
      await reloadMappedSessions();
      setMappedPage(1);

      const maxPer = Math.max(...result.perAccount.map((x) => x.count), 0);
      const minPer = Math.min(...result.perAccount.map((x) => x.count), maxPer);
      toast.success(
        t(
          "Đã lưu CSV «{{name}}» · {{mapped}} SP → {{accounts}} account ({{min}}–{{max}}/tk)",
          {
            name: saved.name,
            mapped: result.mappedCount,
            accounts: result.accountCount,
            min: minPer,
            max: maxPer,
          }
        )
      );
    } catch (err: any) {
      toast.error(err?.message || t("Mapping thất bại"));
    } finally {
      setMappingId(null);
    }
  };

  const handleDownloadMapped = (item: MappingCsvSession) => {
    if (!item.csv) {
      toast.warn(t("CSV trống"));
      return;
    }
    const stamp = new Date(item.createdAt || Date.now())
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    const baseName = String(item.name || "mapping").replace(/[^\w\-]+/g, "_");
    downloadCsvText(item.csv, `mapping-account-${baseName}-${stamp}.csv`);
    toast.success(t("Đã tải CSV mapping"));
  };

  const handleDeleteMapped = async (id: string) => {
    if (!window.confirm(t("Xóa CSV mapping này?"))) return;
    await deleteMappingCsvSession(id);
    await reloadMappedSessions();
    toast.warn(t("Đã xóa CSV mapping"));
  };

  const handleDeleteAllMapped = async () => {
    if (!mappedSessions.length) return;
    if (!window.confirm(t("Xóa tất cả CSV mapping đã lưu?"))) return;
    await clearMappingCsvSessions();
    await reloadMappedSessions();
    toast.warn(t("Đã xóa tất cả CSV mapping"));
  };

  const renderSourceTable = (opts: {
    list: ScrapeCsvSession[];
    emptyText: string;
    sourceKind: "crawl-project" | "gio-video";
  }) => {
    if (!opts.list.length && !sourceList.length) {
      return (
        <div className="px-3 py-8 text-center text-xs text-gray-400">{opts.emptyText}</div>
      );
    }
    if (!opts.list.length) {
      return (
        <div className="px-3 py-8 text-center text-xs text-gray-400">{opts.emptyText}</div>
      );
    }
    const total = sourceList.length;
    const from = total ? (sourceSafePage - 1) * sourcePageSize + 1 : 0;
    const to = Math.min(sourceSafePage * sourcePageSize, total);
    return (
      <div className="flex flex-col">
        <div className="overflow-y-auto max-h-[24rem]">
          <table className={panelListClasses.table}>
            <thead className="sticky top-0 z-10">
              <tr className={panelListClasses.theadTr}>
                <th className={`${panelListClasses.th} text-left`}>{t("Tên")}</th>
                <th className={`${panelListClasses.th} text-right w-28`}>
                  {t("Thực hiện")}
                </th>
              </tr>
            </thead>
            <tbody className={panelListClasses.tbody}>
              {opts.list.map((s) => {
                const busy = mappingId === s.id;
                return (
                  <tr key={s.id} className={panelListRowClass()}>
                    <td className={`${panelListClasses.td} align-top`}>
                      <div className="flex flex-col gap-0.5 py-0.5 text-xs leading-snug">
                        <span className="text-gray-500">
                          <span className="mr-1 font-semibold text-gray-400 uppercase text-10">
                            {t("Thời gian")}
                          </span>
                          {formatSessionTime(s.createdAt)}
                        </span>
                        <span
                          className="font-semibold text-gray-800"
                          title={sessionDisplayName(s)}
                        >
                          <span className="mr-1 font-semibold text-gray-400 uppercase text-10">
                            {t("Tên")}
                          </span>
                          {sessionDisplayName(s)}
                        </span>
                        <span className="text-gray-600 truncate" title={s.marketHost}>
                          <span className="mr-1 font-semibold text-gray-400 uppercase text-10">
                            {t("Domain")}
                          </span>
                          {s.marketHost ? domainLabel(s.marketHost) : "—"}
                        </span>
                        <span className="text-gray-600 truncate" title={s.keyword}>
                          <span className="mr-1 font-semibold text-gray-400 uppercase text-10">
                            {t("Keyword")}
                          </span>
                          {s.keyword || "—"}
                        </span>
                        <span className="font-semibold text-gray-800">
                          <span className="mr-1 font-semibold text-gray-400 uppercase text-10">
                            {t("SP")}
                          </span>
                          {s.productCount}
                        </span>
                      </div>
                    </td>
                    <td className={`${panelListClasses.td} text-right align-middle`}>
                      <button
                        type="button"
                        disabled={Boolean(mappingId)}
                        onClick={() => void handleMapping(s, opts.sourceKind)}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-10 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busy ? <RiLoader4Line className="animate-spin" /> : null}
                        {busy ? t("Đang map…") : t("Mapping")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PanelListPagination
          page={sourceSafePage}
          totalPages={sourceTotalPages}
          pageSize={sourcePageSize}
          pageSizeOptions={SOURCE_PAGE_SIZE_OPTIONS}
          from={from}
          to={to}
          total={total}
          onPageChange={setSourcePage}
          onPageSizeChange={(size) => {
            setSourcePageSize(size);
            setSourcePage(1);
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[28rem]">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-violet-50/60 text-xs leading-relaxed text-violet-900 shrink-0">
        {t(
          "Trái: chọn project → Mapping (lưu CSV). Phải: danh sách CSV đã mapping (tối đa {{max}} SP/account). Thiếu mô tả/hashtag → random 5 hashtag (.vn = tiếng Việt).",
          { max: MAPPING_MAX_PRODUCTS_PER_ACCOUNT }
        )}
      </div>

      <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col lg:w-[38%] xl:w-[34%] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 min-h-[20rem] lg:min-h-0 overflow-hidden">
          <TabGroup
            name="mapping-account-source"
            index={sourceTab}
            onChange={setSourceTab}
            flex
            hasInkBar={false}
            className="!bg-transparent"
            tabClassName="h-10 justify-center border-r border-gray-200 last:border-r-0 bg-gray-50"
            activeClassName="!text-blue-800 bg-blue-50"
            titleClassName="text-sm font-bold whitespace-nowrap"
            bodyClassName="border-t border-gray-200 bg-white overflow-hidden"
          >
            <TabGroup.Tab
              label={t("Crawl Project")}
              count={
                crawlProjectSessions.length
                  ? String(crawlProjectSessions.length)
                  : undefined
              }
            >
              {renderSourceTable({
                list: pagedCrawlSessions,
                emptyText: t("Chưa có Crawl Project"),
                sourceKind: "crawl-project",
              })}
            </TabGroup.Tab>
            <TabGroup.Tab
              label={t("Crawl Giỏ Video")}
              count={
                gioVideoSessions.length ? String(gioVideoSessions.length) : undefined
              }
            >
              {renderSourceTable({
                list: pagedGioSessions,
                emptyText: t("Chưa có Crawl Giỏ Video"),
                sourceKind: "gio-video",
              })}
            </TabGroup.Tab>
          </TabGroup>
        </div>

        <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-white">
          <div className="flex flex-wrap gap-2 justify-between items-center px-3 py-2 border-b border-gray-200 shrink-0">
            <div className="min-w-0">
              <p className="m-0 text-xs font-bold tracking-wide text-gray-600 uppercase">
                {t("Danh sách đã mapping")}
              </p>
              <p className="m-0 mt-0.5 text-10 text-gray-400">
                {mappedSessions.length
                  ? t("{{n}} CSV đã lưu", { n: mappedSessions.length })
                  : t("Chưa có CSV — chọn project bên trái và bấm Mapping.")}
              </p>
            </div>
            <button
              type="button"
              disabled={!mappedSessions.length}
              onClick={() => void handleDeleteAllMapped()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
            >
              <HiOutlineTrash />
              {t("Xóa tất cả")}
            </button>
          </div>

          <div className="overflow-auto flex-1 min-h-0 p-2 lg:max-h-[32rem]">
            {!mappedSessions.length ? (
              <PanelListCard>
                <div className={panelListClasses.empty}>
                  {t("Chưa có CSV mapping.")}
                </div>
              </PanelListCard>
            ) : (
              <div className="flex flex-col gap-2">
                <PanelListCard>
                  <div className="overflow-auto">
                    <table className={panelListClasses.table}>
                      <thead className="sticky top-0 z-10">
                        <tr className="text-xs tracking-wide text-gray-600 bg-gray-50 border-b border-gray-200">
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Thời gian")}
                          </th>
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Tên")}
                          </th>
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Nguồn")}
                          </th>
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Domain")}
                          </th>
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Dòng")}
                          </th>
                          <th className={`${panelListClasses.th} text-left`}>
                            {t("Account")}
                          </th>
                          <th className={`${panelListClasses.th} text-right`} />
                        </tr>
                      </thead>
                      <tbody className={panelListClasses.tbody}>
                        {pagedMappedSessions.map((item) => (
                          <tr key={item.id} className={panelListRowClass()}>
                            <td
                              className={`${panelListClasses.td} whitespace-nowrap text-gray-700`}
                            >
                              {formatSessionTime(item.createdAt)}
                            </td>
                            <td
                              className={`${panelListClasses.td} font-semibold text-gray-800 max-w-[10rem] truncate`}
                              title={item.name}
                            >
                              {item.name}
                            </td>
                            <td
                              className={`${panelListClasses.td} max-w-[12rem] truncate text-gray-600`}
                              title={item.sourceSessionName}
                            >
                              <span className="text-10 font-semibold text-gray-400 uppercase mr-1">
                                {item.sourceKind === "gio-video"
                                  ? t("Giỏ Video")
                                  : t("Project")}
                              </span>
                              {item.sourceSessionName || "—"}
                            </td>
                            <td
                              className={`${panelListClasses.td} max-w-[10rem] truncate`}
                              title={item.marketHost}
                            >
                              {item.marketHost ? domainLabel(item.marketHost) : "—"}
                            </td>
                            <td className={`${panelListClasses.td} font-semibold text-gray-800`}>
                              {item.rowCount}
                              {item.skippedProducts > 0 ? (
                                <span className="ml-1 text-10 font-normal text-amber-600">
                                  (−{item.skippedProducts})
                                </span>
                              ) : null}
                            </td>
                            <td className={`${panelListClasses.td} text-gray-700`}>
                              {item.accountCount}
                            </td>
                            <td className={panelListClasses.td}>
                              <div className="flex gap-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadMapped(item)}
                                  className="inline-flex gap-1 items-center px-2 h-7 font-semibold text-gray-700 bg-white rounded-md border border-gray-200 text-10 hover:bg-gray-50"
                                >
                                  <HiDownload />
                                  CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMapped(item.id)}
                                  className="inline-flex items-center px-2 h-7 font-semibold text-rose-700 bg-rose-50 rounded-md border border-rose-200 text-10 hover:bg-rose-100"
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
                <PanelListPagination
                  page={mappedSafePage}
                  totalPages={mappedTotalPages}
                  pageSize={mappedPageSize}
                  pageSizeOptions={MAPPED_PAGE_SIZE_OPTIONS}
                  from={
                    mappedSessions.length
                      ? (mappedSafePage - 1) * mappedPageSize + 1
                      : 0
                  }
                  to={Math.min(
                    mappedSafePage * mappedPageSize,
                    mappedSessions.length
                  )}
                  total={mappedSessions.length}
                  onPageChange={setMappedPage}
                  onPageSizeChange={(size) => {
                    setMappedPageSize(size);
                    setMappedPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
