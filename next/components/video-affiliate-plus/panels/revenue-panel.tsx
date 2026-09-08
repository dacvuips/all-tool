/**
 * Tab «Doanh thu» — danh sách profile (đã có cookie ở tab Quản lý Profile).
 * Có nút Đồng bộ (từng profile / tất cả) gọi API dashboard rồi lưu vào IndexedDB
 * (store `revenue-records`) để hiển thị báo cáo tổng — không cần gọi lại API mỗi lần mở tab.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChartBar, HiOutlineClock, HiRefresh } from "react-icons/hi";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import {
  AffiliateDashboardDailyRow,
  AffiliateDashboardDetail,
  fetchGpmLoginGroups,
  fetchGpmLoginProfiles,
  fetchGpmLoginStatus,
  fetchAffiliateDashboardDetail,
  GpmLoginGroupOption,
  GpmLoginProfileOption,
} from "../scrape/api";
import { loadUsers, loadRevenueRecords, saveRevenueRecords, RevenueRecord } from "../storage";
import { AffiliatePlusUser } from "../types";
import {
  getProfileSavedInfo,
  resolveProfileDomain,
} from "./users-profiles-panel";
import {
  PanelListCard,
  panelListClasses,
  PanelListMatchCount,
  panelListRowClass,
  PanelListPagination,
  PanelListSearch,
  PanelListToolbar,
} from "../shared/panel-list-ui";

const PAGE_SIZE = 20;
const SYNC_RANGE_DAYS = 30;
const SYNC_DELAY_MS = 500;

function marketHostFromDomain(domain: string): string {
  const d = String(domain || "vn").toLowerCase();
  const map: Record<string, string> = {
    vn: "affiliate.shopee.vn",
    ph: "affiliate.shopee.ph",
    sg: "affiliate.shopee.sg",
    th: "affiliate.shopee.co.th",
    my: "affiliate.shopee.com.my",
    id: "affiliate.shopee.co.id",
  };
  return map[d] || "affiliate.shopee.vn";
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value / 1000) + "K";
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

/** Shopee trả tiền theo đơn vị x100000 (5 chữ số thập phân ẩn). */
function centsToAmount(raw: string | number | undefined): number {
  const n = Number(raw || 0);
  if (!Number.isFinite(n)) return 0;
  return n / 100000;
}

function formatDateShort(ymd: string): string {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function asDetail(raw: Record<string, unknown> | null | undefined): AffiliateDashboardDetail | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  return raw as unknown as AffiliateDashboardDetail;
}

type ProfileRow = {
  profile: GpmLoginProfileOption;
  user?: AffiliatePlusUser;
  groupName: string;
  cookie: string;
  domain: string;
  record?: RevenueRecord;
};

async function syncOneProfile(row: ProfileRow): Promise<RevenueRecord> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - SYNC_RANGE_DAYS * 24 * 60 * 60;
  try {
    const detail = await fetchAffiliateDashboardDetail({
      marketHost: marketHostFromDomain(row.domain),
      cookie: row.cookie,
      startTime: start,
      endTime: end,
    });
    return {
      profileId: row.profile.id,
      profileName: row.profile.name,
      domain: row.domain,
      detail: detail as unknown as Record<string, unknown>,
      syncedAt: Date.now(),
    };
  } catch (err: any) {
    return {
      profileId: row.profile.id,
      profileName: row.profile.name,
      domain: row.domain,
      detail: row.record?.detail || {},
      syncedAt: row.record?.syncedAt || 0,
      error: String(err?.message || err || "Đồng bộ thất bại"),
    };
  }
}

function DashboardModal({
  row,
  onSynced,
  onClose,
}: {
  row: ProfileRow;
  onSynced: (record: RevenueRecord) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(!row.record);
  const [page, setPage] = useState(1);

  const data = asDetail(row.record?.detail);
  const error = row.record?.error || "";
  const syncedAt = row.record?.syncedAt || 0;

  const sync = useCallback(async () => {
    setLoading(true);
    const record = await syncOneProfile(row);
    setLoading(false);
    onSynced(record);
    if (record.error) {
      toast.error(record.error);
    } else {
      toast.success(t("Đã đồng bộ doanh thu") as string);
    }
  }, [row, onSynced, toast, t]);

  useEffect(() => {
    if (!row.record) void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(() => {
    const list = data?.list || [];
    return [...list]
      .sort((a, b) => (a.ymd < b.ymd ? -1 : 1))
      .map((d) => ({ ymd: formatDateShort(d.ymd), clicks: d.clicks }));
  }, [data]);

  const dailyRowsDesc = useMemo(() => {
    const list = data?.list || [];
    return [...list].sort((a, b) => (a.ymd < b.ymd ? 1 : -1));
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(dailyRowsDesc.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = dailyRowsDesc.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const metrics = data
    ? [
        { label: t("Clicks"), value: formatNumber(data.clicks_sum || 0) },
        { label: t("Orders"), value: formatNumber(Number(data.cv_by_order_sum) || 0) },
        {
          label: t("Est. Commission (₫)"),
          value: formatNumber(centsToAmount(data.est_commission_sum)),
        },
        { label: t("Items Sold"), value: formatNumber(Number(data.item_sold_sum) || 0) },
        {
          label: t("Order Amount (₫)"),
          value: formatNumber(centsToAmount(data.order_amount_sum)),
        },
        { label: t("New Buyers"), value: formatNumber(Number(data.new_buyer_sum) || 0) },
      ]
    : [];

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`${t("Doanh thu")} — ${row.profile.name}`}
      icon={<HiChartBar />}
      width="900px"
      maxWidth="95vw"
    >
      <Dialog.Body>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex justify-between items-center">
            <p className="m-0 text-xs text-gray-500">
              {t("{{n}} ngày gần nhất", { n: SYNC_RANGE_DAYS })}
              {syncedAt ? (
                <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
                  <HiOutlineClock className="inline" />
                  {t("Đồng bộ lúc")}: {new Date(syncedAt).toLocaleString()}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => void sync()}
              disabled={loading}
              className="inline-flex gap-1.5 items-center px-3 h-8 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50"
              style={{ backgroundColor: "#047857" }}
            >
              <HiRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
              {loading ? (t("Đang đồng bộ…") as string) : (t("Đồng bộ") as string)}
            </button>
          </div>

          {loading && !data ? (
            <div className={panelListClasses.empty}>{t("Đang đồng bộ dashboard…")}</div>
          ) : error && !data ? (
            <div className="py-10 text-sm text-center text-rose-600">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
                  >
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-lg font-bold text-gray-800">{m.value}</div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="mb-2 text-sm font-semibold text-gray-700">{t("Click Trend")}</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="ymd" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="clicks"
                        name={t("Clicks") as string}
                        stroke="#ee4d2d"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={panelListClasses.card}>
                <div className="px-4 py-2.5 text-sm font-semibold text-gray-700 border-b border-gray-100">
                  {t("Daily Performance")}
                </div>
                <div className="overflow-x-auto">
                  <table className={panelListClasses.table}>
                    <thead>
                      <tr className={panelListClasses.theadTr}>
                        <th className={panelListClasses.th}>{t("Ngày")}</th>
                        <th className={panelListClasses.th}>{t("Clicks")}</th>
                        <th className={panelListClasses.th}>{t("Orders")}</th>
                        <th className={panelListClasses.th}>{t("Est. Commission")}</th>
                        <th className={panelListClasses.th}>{t("Items Sold")}</th>
                        <th className={panelListClasses.th}>{t("Order Amount")}</th>
                        <th className={panelListClasses.th}>{t("New Buyers")}</th>
                      </tr>
                    </thead>
                    <tbody className={panelListClasses.tbody}>
                      {pagedRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={panelListClasses.emptyMatch}>
                            {t("Không có dữ liệu")}
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((d: AffiliateDashboardDailyRow) => (
                          <tr key={d.ymd} className={panelListRowClass()}>
                            <td className={panelListClasses.td}>{formatDateShort(d.ymd)}</td>
                            <td className={panelListClasses.td}>{d.clicks}</td>
                            <td className={panelListClasses.td}>{d.cv_by_order}</td>
                            <td className={panelListClasses.td}>
                              {formatNumber(centsToAmount(d.est_commission))}
                            </td>
                            <td className={panelListClasses.td}>{d.item_sold}</td>
                            <td className={panelListClasses.td}>
                              {formatNumber(centsToAmount(d.order_amount))}
                            </td>
                            <td className={panelListClasses.td}>{d.new_buyer}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PanelListPagination
                  page={safePage}
                  totalPages={totalPages}
                  pageSize={PAGE_SIZE}
                  pageSizeOptions={[PAGE_SIZE]}
                  from={dailyRowsDesc.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
                  to={Math.min(safePage * PAGE_SIZE, dailyRowsDesc.length)}
                  total={dailyRowsDesc.length}
                  onPageChange={setPage}
                  onPageSizeChange={() => {}}
                />
              </div>
            </>
          )}
        </div>
      </Dialog.Body>
    </Dialog>
  );
}

export function RevenuePanel() {
  const { t } = useTranslation();
  const toast = useToast();

  const [groups, setGroups] = useState<GpmLoginGroupOption[]>([]);
  const [profiles, setProfiles] = useState<GpmLoginProfileOption[]>([]);
  const [users, setUsers] = useState<AffiliatePlusUser[]>([]);
  const [records, setRecords] = useState<Record<string, RevenueRecord>>({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [localUsers, savedRecords] = await Promise.all([
        loadUsers().catch(() => []),
        loadRevenueRecords().catch(() => []),
      ]);
      setUsers(localUsers);
      setRecords(Object.fromEntries(savedRecords.map((r) => [r.profileId, r])));

      const st = await fetchGpmLoginStatus();
      if (!st.agentOnline) {
        throw new Error(
          st.message || (t("Chưa thấy Local Agent — mở Shopee Scrape Agent") as string)
        );
      }
      if (!st.online) {
        throw new Error(t("GPM Login chưa online (localhost:9495)") as string);
      }
      const [groupList, profileList] = await Promise.all([
        fetchGpmLoginGroups(),
        fetchGpmLoginProfiles(),
      ]);
      setGroups(groupList);
      setProfiles(profileList);
    } catch (err: any) {
      setProfiles([]);
      toast.error(String(err?.message || err || "Không tải được profile"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(g.id, g.name);
    return map;
  }, [groups]);

  const userByProfileId = useMemo(() => {
    const map = new Map<string, AffiliatePlusUser>();
    for (const user of users) {
      const profileId = String(user.gpmProfileId || "").trim();
      if (profileId) map.set(profileId, user);
    }
    return map;
  }, [users]);

  const rows: ProfileRow[] = useMemo(() => {
    return profiles.map((profile) => {
      const user = userByProfileId.get(profile.id);
      const info = getProfileSavedInfo(profile, user);
      return {
        profile,
        user,
        groupName: profile.groupId ? groupNameById.get(profile.groupId) || profile.groupId : "",
        cookie: info.cookie || "",
        domain: resolveProfileDomain(profile, user),
        record: records[profile.id],
      };
    });
  }, [profiles, userByProfileId, groupNameById, records]);

  const normalizedTerm = searchTerm.toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedTerm) return rows;
    return rows.filter((r) =>
      [r.profile.name, r.profile.id, r.groupName].join(" ").toLowerCase().includes(normalizedTerm)
    );
  }, [rows, normalizedTerm]);

  const activeRow = useMemo(
    () => (activeProfileId ? rows.find((r) => r.profile.id === activeProfileId) || null : null),
    [rows, activeProfileId]
  );

  const withCookieCount = useMemo(() => rows.filter((r) => r.cookie).length, [rows]);
  const syncedCount = useMemo(() => rows.filter((r) => r.record && !r.record.error).length, [rows]);

  const summary = useMemo(() => {
    const acc = {
      clicks: 0,
      orders: 0,
      estCommission: 0,
      itemsSold: 0,
      orderAmount: 0,
      newBuyers: 0,
    };
    for (const r of rows) {
      const d = asDetail(r.record?.detail);
      if (!d) continue;
      acc.clicks += Number(d.clicks_sum) || 0;
      acc.orders += Number(d.cv_by_order_sum) || 0;
      acc.estCommission += centsToAmount(d.est_commission_sum);
      acc.itemsSold += Number(d.item_sold_sum) || 0;
      acc.orderAmount += centsToAmount(d.order_amount_sum);
      acc.newBuyers += Number(d.new_buyer_sum) || 0;
    }
    return acc;
  }, [rows]);

  const persistRecord = useCallback(async (record: RevenueRecord) => {
    setRecords((prev) => ({ ...prev, [record.profileId]: record }));
    await saveRevenueRecords([record]);
  }, []);

  const handleSyncOne = useCallback(
    async (row: ProfileRow) => {
      if (!row.cookie) {
        toast.warn(t("Profile chưa có cookie — cập nhật ở tab Quản lý Profile") as string);
        return;
      }
      setSyncingIds((prev) => new Set(prev).add(row.profile.id));
      try {
        const record = await syncOneProfile(row);
        await persistRecord(record);
        if (record.error) {
          toast.error(`${row.profile.name}: ${record.error}`);
        } else {
          toast.success(`${t("Đã đồng bộ")}: ${row.profile.name}`);
        }
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(row.profile.id);
          return next;
        });
      }
    },
    [persistRecord, toast, t]
  );

  const handleSyncAll = useCallback(async () => {
    const targets = rows.filter((r) => r.cookie);
    if (!targets.length) {
      toast.info(t("Chưa có profile nào có cookie để đồng bộ") as string);
      return;
    }
    setSyncBusy(true);
    setSyncProgress({ done: 0, total: targets.length });
    let ok = 0;
    let failed = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const row = targets[i];
        const record = await syncOneProfile(row);
        await persistRecord(record);
        if (record.error) failed += 1;
        else ok += 1;
        setSyncProgress({ done: i + 1, total: targets.length });
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, SYNC_DELAY_MS));
        }
      }
      toast.success(`${t("Đồng bộ xong")}: ${ok} ${t("OK")} · ${failed} ${t("lỗi")}`);
    } finally {
      setSyncBusy(false);
      setSyncProgress(null);
    }
  }, [rows, persistRecord, toast, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: "#ecfdf5", borderColor: "#34d399", color: "#059669" }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#10b981" }} />
            <span className="text-xs font-medium">{t("Profile")}</span>
            <span className="text-sm font-bold">{profiles.length}</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: "#fffbeb", borderColor: "#fbbf24", color: "#b45309" }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f59e0b" }} />
            <span className="text-xs font-medium">{t("Có cookie")}</span>
            <span className="text-sm font-bold">{withCookieCount}</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: "#eff6ff", borderColor: "#60a5fa", color: "#1d4ed8" }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#3b82f6" }} />
            <span className="text-xs font-medium">{t("Đã đồng bộ")}</span>
            <span className="text-sm font-bold">{syncedCount}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSyncAll()}
          disabled={syncBusy || withCookieCount === 0}
          className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50"
          style={{ backgroundColor: "#ee4d2d" }}
        >
          <HiRefresh className={`text-base ${syncBusy ? "animate-spin" : ""}`} />
          {syncBusy && syncProgress
            ? `${t("Đang đồng bộ")} ${syncProgress.done}/${syncProgress.total}`
            : (t("Đồng bộ tất cả") as string)}
        </button>
      </div>

      <div className={panelListClasses.card}>
        <div className="px-4 py-2.5 text-sm font-semibold text-gray-700 border-b border-gray-100">
          {t("Báo cáo tổng")} ({SYNC_RANGE_DAYS} {t("ngày gần nhất mỗi profile")})
        </div>
        {syncedCount === 0 ? (
          <div className={panelListClasses.empty}>
            {t("Chưa có dữ liệu — bấm «Đồng bộ tất cả» để tổng hợp doanh thu")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: t("Clicks"), value: formatNumber(summary.clicks) },
              { label: t("Orders"), value: formatNumber(summary.orders) },
              { label: t("Est. Commission (₫)"), value: formatNumber(summary.estCommission) },
              { label: t("Items Sold"), value: formatNumber(summary.itemsSold) },
              { label: t("Order Amount (₫)"), value: formatNumber(summary.orderAmount) },
              { label: t("New Buyers"), value: formatNumber(summary.newBuyers) },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500">{m.label}</div>
                <div className="text-lg font-bold text-gray-800">{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PanelListCard>
        <PanelListToolbar
          trailing={
            <>
              <PanelListMatchCount term={searchTerm} matched={filteredRows.length} total={rows.length} />
              <button
                type="button"
                onClick={() => void loadAll()}
                disabled={loading}
                className="inline-flex gap-1.5 items-center px-3 h-8 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50"
                style={{ backgroundColor: "#047857" }}
              >
                <HiRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
                {loading ? (t("Đang tải…") as string) : (t("Tải lại profile") as string)}
              </button>
            </>
          }
        >
          <PanelListSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("Tìm profile theo tên / ID / nhóm") as string}
          />
        </PanelListToolbar>

        {loading && profiles.length === 0 ? (
          <div className={panelListClasses.empty}>{t("Đang tải profile…")}</div>
        ) : filteredRows.length === 0 ? (
          <div className={panelListClasses.empty}>{t("Chưa có profile")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={panelListClasses.table}>
              <thead>
                <tr className={panelListClasses.theadTr}>
                  <th className={panelListClasses.th}>{t("Profile")}</th>
                  <th className={panelListClasses.th}>{t("Nhóm")}</th>
                  <th className={panelListClasses.th}>{t("Domain")}</th>
                  <th className={panelListClasses.th}>{t("Clicks")}</th>
                  <th className={panelListClasses.th}>{t("Orders")}</th>
                  <th className={panelListClasses.th}>{t("Est. Commission")}</th>
                  <th className={panelListClasses.th}>{t("Đồng bộ lúc")}</th>
                  <th className={panelListClasses.th}>{t("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className={panelListClasses.tbody}>
                {filteredRows.map((row) => {
                  const d = asDetail(row.record?.detail);
                  const isSyncing = syncingIds.has(row.profile.id);
                  return (
                    <tr key={row.profile.id} className={panelListRowClass()}>
                      <td className={panelListClasses.td}>
                        <div className="font-medium text-gray-800">{row.profile.name}</div>
                        <div className="text-xs text-gray-400">{row.profile.id}</div>
                      </td>
                      <td className={panelListClasses.td}>{row.groupName || "—"}</td>
                      <td className={panelListClasses.td}>
                        <span className="uppercase">{row.domain}</span>
                      </td>
                      <td className={panelListClasses.td}>
                        {d ? formatNumber(d.clicks_sum || 0) : "—"}
                      </td>
                      <td className={panelListClasses.td}>
                        {d ? formatNumber(Number(d.cv_by_order_sum) || 0) : "—"}
                      </td>
                      <td className={panelListClasses.td}>
                        {d ? formatNumber(centsToAmount(d.est_commission_sum)) : "—"}
                      </td>
                      <td className={panelListClasses.td}>
                        {row.record?.error ? (
                          <span className="text-xs text-rose-600" title={row.record.error}>
                            {t("Lỗi")}
                          </span>
                        ) : row.record?.syncedAt ? (
                          <span className="text-xs text-gray-500">
                            {new Date(row.record.syncedAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{t("Chưa đồng bộ")}</span>
                        )}
                      </td>
                      <td className={panelListClasses.td}>
                        <div className="flex gap-1.5 items-center">
                          <button
                            type="button"
                            disabled={!row.cookie}
                            onClick={() => setActiveProfileId(row.profile.id)}
                            title={
                              row.cookie
                                ? undefined
                                : (t("Profile chưa có cookie — cập nhật ở tab Quản lý Profile") as string)
                            }
                            className="inline-flex gap-1.5 items-center px-3 h-8 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-40"
                            style={{ backgroundColor: "#ee4d2d" }}
                          >
                            <HiChartBar className="text-base" />
                            {t("Xem")}
                          </button>
                          <button
                            type="button"
                            disabled={!row.cookie || isSyncing}
                            onClick={() => void handleSyncOne(row)}
                            title={t("Đồng bộ profile này") as string}
                            className="inline-flex justify-center items-center w-8 h-8 text-gray-600 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <HiRefresh className={`text-sm ${isSyncing ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelListCard>

      {activeRow ? (
        <DashboardModal
          row={activeRow}
          onSynced={(record) => void persistRecord(record)}
          onClose={() => setActiveProfileId(null)}
        />
      ) : null}
    </div>
  );
}
