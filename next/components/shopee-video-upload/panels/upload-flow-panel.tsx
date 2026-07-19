/**
 * Tab Đăng video Shope — Quản lý luồng (module tách riêng).
 *
 * - Tạo luồng từ phiên Generate Video (bridge video-affiliate-plus)
 * - Bắt Đầu → enqueue backend /api/app/shopee-video-upload/*
 * - Không giả lập success client-side
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBan,
  HiCheck,
  HiChevronDown,
  HiChevronRight,
  HiClock,
  HiOutlinePause,
  HiOutlineTrash,
  HiPlay,
  HiRefresh,
  HiUpload,
} from "react-icons/hi";
import { RiAddLine, RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { SceneHistoryDropdown } from "../../app/affiliate-video/shared/scene-history-dropdown";
import { VideoDialog } from "../../shared/common/video-dialog";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import {
  formatImportHistoryOption,
  ImportHistoryItem,
} from "../../video-affiliate-plus/import-history";
import {
  hydrateMergedVideoUrls,
  removeMergedVideoFromIndexedDb,
  resolveMergedPreviewUrl,
} from "../../video-affiliate-plus/merged-video";
import {
  PanelListCard,
  PanelListMatchCount,
  PanelListSearch,
  PanelListToolbar,
  panelListClasses,
  panelListRowClass,
} from "../../video-affiliate-plus/shared/panel-list-ui";
import { getSessionItems } from "../../video-affiliate-plus/thread-store";
import {
  AffiliatePlusProxy,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  buildProxyRaw,
  createEmptyItem,
  resolveUserCookie,
  resolveUserProxy,
} from "../../video-affiliate-plus/types";
import {
  clearUploadHistory,
  formatUploadHistoryOption,
  getSelectedUploadHistoryId,
  getUploadHistory,
  PersistedUploadThread,
  pushUploadHistory,
  setSelectedUploadHistoryId,
  updateUploadHistorySession,
  UploadHistoryItem,
} from "../../video-affiliate-plus/upload-history";
import {
  check24hApi,
  pauseUploadThreads,
  retryUploadThreads,
  startUploadThreads,
} from "../api/client";
import { useUploadJobPoller } from "../hooks/use-upload-jobs";
import {
  AccountGroup,
  aggregateStatus,
  Check24hResult,
  computeEvenPerAccountCounts,
  computeTaskStats,
  COUNTRY_OPTIONS,
  formatCountdown,
  groupThreadsByAccount,
  makeThread,
  MAX_UPLOAD_ITEMS,
  randomDelaySeconds,
  ShopeeUploadThread,
  statusLabel,
} from "../types";

async function hydrateUploadThreads(
  list: PersistedUploadThread[]
): Promise<ShopeeUploadThread[]> {
  if (!list.length) return [];
  const pseudoItems = list.map((row) =>
    createEmptyItem({
      id: row.generateItemId || row.id,
      productId: row.productId || "",
      productName: row.caption || "",
      productLink: row.productLink || "",
      prompt: row.caption || "",
      mergedVideoUrl: row.videoFile || "",
    })
  );
  const hydrated = await hydrateMergedVideoUrls(pseudoItems);
  return list.map((row, index) => {
    const merged =
      String(hydrated[index]?.mergedVideoUrl || "").trim() || String(row.videoFile || "").trim();
    return {
      ...row,
      videoFile: merged,
      status: row.status === "running" ? "stopped" : row.status,
      nextRunAt: 0,
      jobId: undefined,
    } as ShopeeUploadThread;
  });
}

interface Props {
  users: AffiliatePlusUser[];
  proxies: AffiliatePlusProxy[];
  settings: AffiliatePlusSettings;
  importHistory: ImportHistoryItem[];
  selectedHistoryId: string | null;
  onUpdateUsers: (users: AffiliatePlusUser[]) => void | Promise<void>;
  onUpdateSettings: (settings: AffiliatePlusSettings) => void;
  onAddLog?: (message: string, level?: "info" | "success" | "warning" | "error") => void;
}

export function ShopeeUploadFlowPanel({
  users,
  proxies,
  settings,
  importHistory,
  selectedHistoryId,
  onUpdateUsers,
  onUpdateSettings,
  onAddLog,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [threads, setThreads] = useState<ShopeeUploadThread[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [delayMin, setDelayMin] = useState(settings.defaultDelayMin ?? 180);
  const [delayMax, setDelayMax] = useState(settings.defaultDelayMax ?? 240);
  const [videosPerAccount, setVideosPerAccount] = useState(MAX_UPLOAD_ITEMS);
  const [country, setCountry] = useState(settings.defaultCountry || "VN");
  const [autoStart, setAutoStart] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [selectedUploadHistoryId, setSelectedUploadHistoryIdState] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState(settings.scheduleTime || "07:00");
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [check24hCache, setCheck24hCache] = useState<Record<string, Check24hResult>>({});
  const [editingProxyKey, setEditingProxyKey] = useState<string | null>(null);
  const [proxyDraft, setProxyDraft] = useState("");
  const [editingCountryKey, setEditingCountryKey] = useState<string | null>(null);
  const [editingCookieKey, setEditingCookieKey] = useState<string | null>(null);
  const [cookieDraft, setCookieDraft] = useState("");
  const [editingUsernameKey, setEditingUsernameKey] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");

  const restoredRef = useRef(false);
  const skipPersistRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUploadHistoryIdRef = useRef<string | null>(null);
  const lastDailyResetKeyRef = useRef("");
  const delayQueueRef = useRef<Map<string, number>>(new Map());

  selectedUploadHistoryIdRef.current = selectedUploadHistoryId;

  useUploadJobPoller(threads, setThreads, true);

  useEffect(() => {
    setScheduleTime(settings.scheduleTime || "07:00");
  }, [settings.scheduleTime]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const log = useCallback(
    (message: string, level: "info" | "success" | "warning" | "error" = "info") => {
      onAddLog?.(message, level);
    },
    [onAddLog]
  );

  const refreshUploadHistory = useCallback(async () => {
    try {
      const history = await getUploadHistory();
      setUploadHistory(history);
      return history;
    } catch (err) {
      console.warn("[ShopeeUploadFlowPanel] load upload history failed", err);
      return [] as UploadHistoryItem[];
    }
  }, []);

  // Khôi phục phiên
  useEffect(() => {
    if (restoredRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const history = await getUploadHistory();
        const selectedId = (await getSelectedUploadHistoryId()) || history[0]?.id || null;
        if (cancelled) return;
        setUploadHistory(history);
        setSelectedUploadHistoryIdState(selectedId);
        selectedUploadHistoryIdRef.current = selectedId;
        if (selectedId) {
          const entry = history.find((h) => h.id === selectedId);
          const raw = entry?.data?.threads || [];
          if (raw.length) {
            skipPersistRef.current = true;
            setThreads(await hydrateUploadThreads(raw));
            restoredRef.current = true;
            skipPersistRef.current = false;
            return;
          }
        }
        restoredRef.current = true;
      } catch {
        restoredRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist
  useEffect(() => {
    if (!restoredRef.current || skipPersistRef.current) return;
    const id = selectedUploadHistoryIdRef.current;
    if (!id) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void updateUploadHistorySession(id, threads as PersistedUploadThread[])
        .then(() => refreshUploadHistory())
        .catch(() => undefined);
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [threads, refreshUploadHistory]);

  useEffect(() => {
    if (!importOpen) return;
    const preferred =
      (selectedHistoryId && importHistory.some((h) => h.id === selectedHistoryId)
        ? selectedHistoryId
        : "") ||
      importHistory[0]?.id ||
      "";
    setSelectedSessionId(preferred);
  }, [importOpen, importHistory, selectedHistoryId]);

  // Daily reset theo giờ (MLS) — chỉ reset status, không auto-enqueue
  useEffect(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const current = `${hh}:${mm}`;
    const target = String(scheduleTime || "07:00").trim() || "07:00";
    const dayKey = `${now.toISOString().slice(0, 10)}_${target}`;
    if (current !== target || lastDailyResetKeyRef.current === dayKey) return;
    lastDailyResetKeyRef.current = dayKey;
    if (!threads.length) return;
    setThreads((prev) =>
      prev.map((item) => ({
        ...item,
        status: "stopped" as const,
        uploaded: 0,
        pending: 1,
        error: "-",
        nextRunAt: 0,
        jobId: undefined,
      }))
    );
    log(t("Đã reset luồng theo lịch {{time}}", { time: scheduleTime }), "info");
    toast.info(t("Đã chạy lại theo lịch {{time}}", { time: scheduleTime }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowSec]);

  const accountGroups = useMemo(() => groupThreadsByAccount(threads), [threads]);
  const taskStats = useMemo(() => computeTaskStats(threads), [threads]);
  const accountStats = useMemo(() => {
    const statuses = accountGroups.map((g) => aggregateStatus(g.videos));
    return {
      total: accountGroups.length,
      waiting: statuses.filter((s) => s === "stopped").length,
      running: statuses.filter((s) => s === "running").length,
      success: statuses.filter((s) => s === "success").length,
      error: statuses.filter((s) => s === "error").length,
    };
  }, [accountGroups]);

  const normalizedTerm = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);
  const filteredGroups = useMemo(() => {
    if (!normalizedTerm) return accountGroups;
    return accountGroups.filter((group) => {
      const haystack = [
        group.username,
        group.cookie,
        group.proxy,
        group.country,
        ...group.videos.flatMap((v) => [v.caption, v.productLink, v.videoFile, v.error]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [accountGroups, normalizedTerm]);

  const selectedCount = threads.filter((i) => i.selected).length;
  const allVisibleSelected =
    filteredGroups.length > 0 && filteredGroups.every((g) => g.videos.every((v) => v.selected));
  const activeProxyPool = useMemo(
    () => proxies.filter((p) => p.active !== false && String(p.raw || "").trim()),
    [proxies]
  );

  const toggleSelectVisible = (checked: boolean) => {
    const ids = new Set(filteredGroups.flatMap((g) => g.videos.map((v) => v.id)));
    setThreads((prev) =>
      prev.map((item) => (ids.has(item.id) ? { ...item, selected: checked } : item))
    );
  };

  const toggleSelectAccount = (group: AccountGroup, checked: boolean) => {
    const ids = new Set(group.videos.map((v) => v.id));
    setThreads((prev) =>
      prev.map((item) => (ids.has(item.id) ? { ...item, selected: checked } : item))
    );
  };

  const toggleSelectVideo = (id: string, checked: boolean) => {
    setThreads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: checked } : item))
    );
  };

  const toggleExpandAccount = (key: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** Enqueue upload lên backend (có delay theo account) */
  const enqueueThreads = async (targets: ShopeeUploadThread[]) => {
    if (!targets.length) {
      toast.warn(t("Chọn ít nhất một video để bắt đầu"));
      return;
    }

    // Áp delay tuần tự theo account: video đầu nextRunAt=0, các video sau + delay
    const byUser = new Map<string, ShopeeUploadThread[]>();
    for (const item of targets) {
      const k = item.username || item.id;
      const arr = byUser.get(k) || [];
      arr.push(item);
      byUser.set(k, arr);
    }

    const now = Math.floor(Date.now() / 1000);
    const withDelay: ShopeeUploadThread[] = [];
    Array.from(byUser.values()).forEach((list) => {
      let cursor = now;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const due = i === 0 ? now : cursor;
        withDelay.push({ ...item, nextRunAt: due, status: "running", error: "-" });
        cursor =
          due + randomDelaySeconds(item.delayMin || delayMin, item.delayMax || delayMax);
      }
    });

    // Đánh dấu UI running ngay; enqueue khi đến hạn (hoặc ngay nếu due<=now)
    const idSet = new Set(withDelay.map((x) => x.id));
    setThreads((prev) =>
      prev.map((row) => {
        const next = withDelay.find((x) => x.id === row.id);
        return next
          ? { ...row, status: "running", error: "-", nextRunAt: next.nextRunAt, jobId: undefined }
          : row;
      })
    );

    const ready = withDelay.filter((x) => (x.nextRunAt || 0) <= now);
    const later = withDelay.filter((x) => (x.nextRunAt || 0) > now);
    for (const x of later) {
      delayQueueRef.current.set(x.id, x.nextRunAt || 0);
    }

    if (ready.length) {
      await fireEnqueue(ready);
    }
    log(t("Đã xếp hàng {{count}} video upload", { count: targets.length }), "info");
  };

  const fireEnqueue = async (ready: ShopeeUploadThread[]) => {
    try {
      const res = await startUploadThreads(
        ready.map((t) => ({
          id: t.id,
          username: t.username,
          cookie: t.cookie,
          country: t.country,
          proxy: t.proxy,
          caption: t.caption,
          productLink: t.productLink,
          productId: t.productId,
          videoUrl: t.videoFile?.startsWith("http") ? t.videoFile : undefined,
          videoFile: t.videoFile,
        }))
      );
      const jobs = res.jobs || [];
      setThreads((prev) =>
        prev.map((row) => {
          const j = jobs.find((x) => x.threadId === row.id);
          return j ? { ...row, jobId: j.jobId, status: "running" } : row;
        })
      );
      toast.success(t("Đã gửi {{count}} job upload", { count: jobs.length }));
    } catch (err: any) {
      toast.error(err?.message || t("Không enqueue được"));
      setThreads((prev) =>
        prev.map((row) =>
          ready.some((r) => r.id === row.id)
            ? { ...row, status: "error", error: err?.message || "Enqueue failed" }
            : row
        )
      );
    }
  };

  // Poll delay queue → enqueue khi đến hạn
  useEffect(() => {
    const dueIds: string[] = [];
    Array.from(delayQueueRef.current.entries()).forEach(([id, due]) => {
      if (due <= nowSec) dueIds.push(id);
    });
    if (!dueIds.length) return;
    for (const id of dueIds) delayQueueRef.current.delete(id);
    const ready = threads.filter((t) => dueIds.includes(t.id) && t.status === "running" && !t.jobId);
    if (ready.length) void fireEnqueue(ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowSec]);

  const startThreads = (ids?: string[]) => {
    // Chỉ chạy item đã checked (trừ khi gọi tường minh 1 id từ nút Play từng video)
    const targetIds = ids?.length
      ? new Set(ids)
      : new Set(
          threads
            .filter((i) => i.selected && i.status !== "running" && i.status !== "success")
            .map((i) => i.id)
        );
    const targets = threads.filter(
      (t) =>
        targetIds.has(t.id) &&
        t.status !== "running" &&
        t.status !== "success" &&
        (ids?.length ? true : t.selected)
    );
    if (!targets.length) {
      toast.warn(t("Chọn ít nhất một video để bắt đầu"));
      return;
    }
    void enqueueThreads(targets);
  };

  const pauseThreads = async () => {
    const list = threads.filter((i) => i.selected && i.status === "running");
    if (!list.length) {
      toast.warn(t("Chọn ít nhất một luồng đang chạy để tạm dừng"));
      return;
    }
    const ids = list.map((i) => i.id);
    for (const id of ids) delayQueueRef.current.delete(id);
    try {
      await pauseUploadThreads(ids);
    } catch {
      /* ignore */
    }
    setThreads((prev) =>
      prev.map((item) =>
        ids.includes(item.id)
          ? { ...item, status: "stopped", nextRunAt: 0, jobId: undefined }
          : item
      )
    );
    log(t("Đã tạm dừng {{count}} video", { count: ids.length }), "warning");
  };

  const deleteSelected = () => {
    if (!selectedCount) {
      toast.warn(t("Chọn ít nhất một task để xóa"));
      return;
    }
    if (!confirm(t("Xóa {{count}} task đã chọn?", { count: selectedCount }))) return;
    const n = selectedCount;
    setThreads((prev) => prev.filter((item) => !item.selected));
    log(t("Đã xóa {{count}} tasks", { count: n }), "warning");
  };

  /** Chỉ bỏ tick — không xóa task */
  const clearSelection = () => {
    if (!selectedCount) {
      toast.warn(t("Chưa có mục nào được chọn"));
      return;
    }
    setThreads((prev) => prev.map((item) => ({ ...item, selected: false })));
    toast.info(t("Đã bỏ chọn {{count}} mục", { count: selectedCount }));
  };

  const deleteCompletedAccounts = () => {
    const doneKeys = new Set(
      accountGroups.filter((g) => aggregateStatus(g.videos) === "success").map((g) => g.key)
    );
    if (!doneKeys.size) {
      toast.warn(t('Không có luồng nào ở trạng thái "Xong"'));
      return;
    }
    if (!confirm(t("Xóa {{count}} luồng đã xong?", { count: doneKeys.size }))) return;
    setThreads((prev) => prev.filter((row) => !doneKeys.has(row.username || row.id)));
  };

  /** Xóa blob video nối của task đã success (MLS: Xóa Video OK) */
  const cleanupCompletedVideos = async () => {
    const done = threads.filter((t) => t.status === "success");
    if (!done.length) {
      toast.warn(t("Không có video OK để xóa"));
      return;
    }
    if (!confirm(t("Xóa file video nối của {{count}} task đã thành công?", { count: done.length }))) {
      return;
    }
    let n = 0;
    for (const v of done) {
      try {
        await removeMergedVideoFromIndexedDb({
          id: v.generateItemId || v.id,
          productId: v.productId,
          productLink: v.productLink,
          mergedVideoUrl: v.videoFile,
        });
        n += 1;
      } catch {
        /* ignore */
      }
    }
    setThreads((prev) =>
      prev.map((row) =>
        row.status === "success" ? { ...row, videoFile: "" } : row
      )
    );
    toast.success(t("Đã xóa {{count}} video OK khỏi bộ nhớ", { count: n }));
    log(t("Xóa Video OK: {{count}}", { count: n }), "warning");
  };

  const handleRetryErrors = async () => {
    const errors = threads.filter((t) => t.status === "error");
    if (!errors.length) {
      toast.warn(t("Không có video lỗi để retry"));
      return;
    }
    setThreads((prev) =>
      prev.map((item) =>
        item.status === "error"
          ? { ...item, status: "stopped", error: "-", pending: Math.max(1, item.pending || 1) }
          : item
      )
    );
    try {
      const res = await retryUploadThreads(
        errors.map((t) => ({
          id: t.id,
          username: t.username,
          cookie: t.cookie,
          country: t.country,
          proxy: t.proxy,
          caption: t.caption,
          productLink: t.productLink,
          productId: t.productId,
          videoUrl: t.videoFile?.startsWith("http") ? t.videoFile : undefined,
          videoFile: t.videoFile,
        }))
      );
      const jobs = res.jobs || [];
      setThreads((prev) =>
        prev.map((row) => {
          const j = jobs.find((x) => x.threadId === row.id);
          return j
            ? { ...row, jobId: j.jobId, status: "running", error: "-" }
            : row;
        })
      );
      toast.success(t("Retry {{count}} video lỗi", { count: jobs.length }));
    } catch (err: any) {
      toast.error(err?.message || t("Retry thất bại"));
    }
  };

  const saveScheduleTime = () => {
    const value = String(scheduleTime || "").trim() || "07:00";
    if (!/^\d{1,2}:\d{2}$/.test(value)) {
      toast.error(t("Giờ không hợp lệ (HH:mm)"));
      return;
    }
    setScheduleTime(value);
    onUpdateSettings({ ...settings, scheduleTime: value });
    toast.success(t("Đã lưu giờ chạy lại: {{time}}", { time: value }));
  };

  const runCheck24h = async (usernames?: string[]) => {
    const targets =
      usernames?.length && usernames.length > 0
        ? usernames
        : accountGroups.filter((g) => g.videos.every((v) => v.selected)).map((g) => g.username);
    if (!targets.length) {
      toast.warn(t("Chọn ít nhất 1 luồng để check 24h"));
      return;
    }
    toast.info(t("Đang check {{count}} luồng...", { count: targets.length }));
    const nextCache = { ...check24hCache };
    for (const username of targets) {
      const group = accountGroups.find((g) => g.username === username);
      const cookie = String(group?.cookie || "").trim();
      if (!cookie) {
        nextCache[username] = { success: false, error: "Thiếu cookie" };
        continue;
      }
      try {
        const data = await check24hApi({
          cookie,
          country: group?.country,
          proxy: group?.proxy,
          username,
        });
        if (data.success) {
          nextCache[username] = {
            success: true,
            count: data.count24h ?? 0,
            canPost: data.canPost !== false,
          };
        } else {
          nextCache[username] = {
            success: false,
            error: data.error,
            banned: data.banned,
          };
        }
      } catch (err: any) {
        nextCache[username] = { success: false, error: err?.message || "Lỗi" };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setCheck24hCache(nextCache);
    log(t("Check 24h hoàn tất ({{count}} account)", { count: targets.length }), "info");
    toast.success(t("Đã kiểm tra 24h"));
  };

  const patchAccountField = (
    group: AccountGroup,
    patch: Partial<
      Pick<ShopeeUploadThread, "cookie" | "country" | "proxy" | "delayMin" | "delayMax" | "username">
    >
  ) => {
    const ids = new Set(group.videos.map((v) => v.id));
    setThreads((prev) => prev.map((row) => (ids.has(row.id) ? { ...row, ...patch } : row)));
    const user = users.find((u) => u.username === group.username);
    if (user && (patch.cookie !== undefined || patch.proxy !== undefined || patch.username !== undefined)) {
      void onUpdateUsers(
        users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                cookie: patch.cookie !== undefined ? patch.cookie : resolveUserCookie(u),
                proxy: patch.proxy !== undefined ? patch.proxy : resolveUserProxy(u),
                username: patch.username !== undefined ? patch.username : u.username,
              }
            : u
        )
      );
    }
  };

  const applyRandomProxy = (group: AccountGroup) => {
    if (!activeProxyPool.length) {
      toast.warn(t("Chưa có proxy active trong Quản lý Proxy"));
      return;
    }
    const pick = activeProxyPool[Math.floor(Math.random() * activeProxyPool.length)];
    const raw =
      pick.raw ||
      buildProxyRaw({
        host: pick.host,
        port: pick.port,
        username: pick.username,
        password: pick.password,
      });
    patchAccountField(group, { proxy: raw });
    toast.success(t("Đã đổi proxy ngẫu nhiên"));
  };

  const startAccount = (group: AccountGroup) => {
    const status = aggregateStatus(group.videos);
    if (status === "running") {
      const toPause = group.videos.filter((v) => v.selected && v.status === "running");
      if (!toPause.length) {
        toast.warn(t("Chọn ít nhất một video đang chạy trong luồng để tạm dừng"));
        return;
      }
      const ids = toPause.map((v) => v.id);
      for (const id of ids) delayQueueRef.current.delete(id);
      void pauseUploadThreads(ids).catch(() => {});
      setThreads((prev) =>
        prev.map((item) =>
          ids.includes(item.id)
            ? { ...item, status: "stopped", nextRunAt: 0, jobId: undefined }
            : item
        )
      );
      return;
    }
    const targets = group.videos.filter(
      (v) => v.selected && v.status !== "success" && v.status !== "running"
    );
    if (!targets.length) {
      toast.warn(t("Chọn ít nhất một video trong luồng để chạy"));
      return;
    }
    startThreads(targets.map((v) => v.id));
  };

  const deleteAccount = (group: AccountGroup) => {
    if (!confirm(t("Xóa luồng {{name}}?", { name: group.username }))) return;
    const ids = new Set(group.videos.map((v) => v.id));
    setThreads((prev) => prev.filter((row) => !ids.has(row.id)));
  };

  const handleSelectUploadHistory = async (id: string) => {
    const entry = uploadHistory.find((h) => h.id === id);
    if (!entry) return;
    try {
      skipPersistRef.current = true;
      setThreads(await hydrateUploadThreads(entry.data.threads || []));
      setSelectedUploadHistoryIdState(id);
      selectedUploadHistoryIdRef.current = id;
      await setSelectedUploadHistoryId(id);
    } catch (err: any) {
      toast.error(err?.message || t("Không tải được phiên"));
    } finally {
      skipPersistRef.current = false;
    }
  };

  const handleClearUploadHistory = async () => {
    if (!confirm(t("Xóa toàn bộ lịch sử phiên Đăng video Shope?"))) return;
    try {
      skipPersistRef.current = true;
      await clearUploadHistory();
      setUploadHistory([]);
      setSelectedUploadHistoryIdState(null);
      selectedUploadHistoryIdRef.current = null;
      setThreads([]);
      toast.success(t("Đã xóa lịch sử phiên upload"));
    } catch (err: any) {
      toast.error(err?.message || t("Không xóa được lịch sử"));
    } finally {
      skipPersistRef.current = false;
    }
  };

  const playVideo = async (video: ShopeeUploadThread) => {
    try {
      const url = await resolveMergedPreviewUrl({
        id: video.generateItemId || video.id,
        productId: video.productId,
        productLink: video.productLink,
        mergedVideoUrl: video.videoFile,
      });
      if (!url) {
        toast.warn(t("Không mở được video — dữ liệu blob đã hết hạn, hãy tạo luồng lại"));
        return;
      }
      setPreviewVideoUrl(url);
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được video"));
    }
  };

  const handleImportFromSession = async () => {
    if (!selectedSessionId) {
      toast.warn(t("Chưa chọn phiên Generate Video"));
      return;
    }
    const accountPool = users.filter((u) => u.active !== false && String(u.username || "").trim());
    if (!accountPool.length) {
      toast.warn(t("Chưa có tài khoản trong Quản lý Người Dùng"));
      return;
    }
    setImporting(true);
    try {
      const sessionItems = await getSessionItems(selectedSessionId);
      if (!sessionItems.length) {
        toast.warn(t("Phiên này chưa có dữ liệu"));
        return;
      }
      const hydrated = await hydrateMergedVideoUrls(sessionItems);
      const readyItems = hydrated.filter((item) =>
        Boolean(String(item.mergedVideoUrl || "").trim())
      );
      if (!readyItems.length) {
        toast.warn(t("Không có item nào đã hoàn thành video nối trong phiên này"));
        return;
      }
      const perAccountCap = Math.max(
        1,
        Math.min(MAX_UPLOAD_ITEMS, Math.round(Number(videosPerAccount) || MAX_UPLOAD_ITEMS))
      );
      const perAccountCounts = computeEvenPerAccountCounts(
        readyItems.length,
        accountPool.length,
        perAccountCap
      );
      const next: ShopeeUploadThread[] = [];
      const assignedAt = Date.now();
      const updatedUsers = users.map((u) => ({ ...u, generateItems: u.generateItems || [] }));
      let rowIndex = 0;
      let itemCursor = 0;

      for (let ai = 0; ai < accountPool.length; ai++) {
        const user = accountPool[ai];
        const take = perAccountCounts[ai] || 0;
        if (take <= 0 || itemCursor >= readyItems.length) {
          const userIndex = updatedUsers.findIndex((u) => u.id === user.id);
          if (userIndex >= 0) {
            updatedUsers[userIndex] = {
              ...updatedUsers[userIndex],
              generateItems: [],
              generateItem: null,
            };
          }
          continue;
        }
        const chunk = readyItems.slice(itemCursor, itemCursor + take);
        itemCursor += chunk.length;
        const links = chunk.map((item) => {
          const mergedVideoUrl = String(item.mergedVideoUrl || "").trim();
          const caption = item.prompt || item.productName || "";
          return {
            sessionId: selectedSessionId,
            itemId: item.id,
            productId: item.productId || "",
            productName: item.productName || "",
            productLink: item.productLink || "",
            caption,
            mergedVideoUrl:
              mergedVideoUrl.startsWith("blob:") || mergedVideoUrl.startsWith("data:")
                ? ""
                : mergedVideoUrl,
            assignedAt,
            _rawMerged: mergedVideoUrl,
            _country: item.country || country,
          };
        });
        const userIndex = updatedUsers.findIndex((u) => u.id === user.id);
        if (userIndex >= 0) {
          updatedUsers[userIndex] = {
            ...updatedUsers[userIndex],
            generateItems: links.map(({ _rawMerged, _country, ...link }) => link),
            generateItem: null,
          };
        }
        for (const link of links) {
          next.push(
            makeThread(rowIndex, {
              username: user.username,
              cookie: resolveUserCookie(user),
              proxy: resolveUserProxy(user),
              country: link._country,
              caption: link.caption || link.productName || "",
              productLink: link.productLink || "",
              productId: link.productId || "",
              generateItemId: link.itemId || "",
              videoFile: link._rawMerged || link.mergedVideoUrl,
              delayMin,
              delayMax,
              pending: 1,
              uploaded: 0,
              status: "stopped",
              nextRunAt: 0,
            })
          );
          rowIndex += 1;
        }
      }

      if (!next.length) {
        toast.warn(t("Không còn video để gắn cho tài khoản"));
        return;
      }

      await onUpdateUsers(updatedUsers);
      const genEntry = importHistory.find((h) => h.id === selectedSessionId);
      const genName = genEntry?.data?.fileName || genEntry?.label || "Generate";

      skipPersistRef.current = true;
      setThreads(next);
      const entry = await pushUploadHistory({
        fileName: `Upload – ${genName}`,
        threads: next as PersistedUploadThread[],
        generateSessionId: selectedSessionId,
      });
      setSelectedUploadHistoryIdState(entry.id);
      selectedUploadHistoryIdRef.current = entry.id;
      await refreshUploadHistory();
      skipPersistRef.current = false;
      setImportOpen(false);

      toast.success(t("Đã tạo {{count}} luồng", { count: next.length }));
      log(t("Tạo {{count}} luồng upload từ phiên Generate", { count: next.length }), "success");

      if (autoStart) {
        const selected = next.filter((i) => i.selected);
        void enqueueThreads(selected.length ? selected : next);
      }
    } catch (err: any) {
      toast.error(err?.message || t("Không tải được phiên Generate Video"));
    } finally {
      setImporting(false);
    }
  };

  const check24hBadge = (username: string) => {
    const cached = check24hCache[username];
    if (!cached) return null;
    if (cached.success) {
      const c = cached.count ?? 0;
      if (!cached.canPost) return `${c}/BAN`;
      return String(c);
    }
    if (cached.banned) return "BAN";
    return "!";
  };

  const statCards = [
    { label: t("Tổng task"), value: taskStats.total, bg: "#e0f2fe", border: "#38bdf8", text: "#0284c7", dot: "#0ea5e9" },
    { label: t("Chờ"), value: taskStats.waiting, bg: "#fef9c3", border: "#fbbf24", text: "#ca8a04", dot: "#eab308" },
    { label: t("Đang upload"), value: taskStats.running, bg: "#ecfeff", border: "#22d3ee", text: "#0891b2", dot: "#06b6d4" },
    { label: t("Thành công"), value: taskStats.success, bg: "#ecfdf5", border: "#34d399", text: "#059669", dot: "#10b981" },
    { label: t("Lỗi"), value: taskStats.error, bg: "#fff1f2", border: "#fb7185", text: "#e11d48", dot: "#f43f5e" },
    { label: t("Account"), value: accountStats.total, bg: "#f3e8ff", border: "#c084fc", text: "#7e22ce", dot: "#a855f7" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {statCards.map((s) => (
          <div
            key={String(s.label)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-sm font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <SceneHistoryDropdown
          items={uploadHistory}
          selectedId={selectedUploadHistoryId}
          onSelect={(id) => void handleSelectUploadHistory(id)}
          onClear={() => void handleClearUploadHistory()}
          formatOptionLabel={formatUploadHistoryOption}
          className="px-2 py-2 mb-3 rounded-lg"
        />

        <div className="flex flex-col gap-3 justify-between lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <RiAddLine className="text-base" />
              {t("Tạo Luồng")}
            </button>
            <button
              type="button"
              onClick={() => void handleRetryErrors()}
              disabled={taskStats.error === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                taskStats.error === 0
                  ? undefined
                  : { backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }
              }
            >
              <HiRefresh className="text-base" />
              {t("Retry Lỗi")}
            </button>
            <button
              type="button"
              onClick={deleteCompletedAccounts}
              disabled={accountStats.success === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                accountStats.success === 0
                  ? undefined
                  : { backgroundColor: "#fff1f2", borderColor: "#fb7185", color: "#e11d48" }
              }
            >
              <HiOutlineTrash className="text-base" />
              {t("Xóa Xong")}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#fff1f2", borderColor: "#fb7185", color: "#e11d48" }
              }
            >
              <HiOutlineTrash className="text-base" />
              {t("Xóa Tasks")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => void cleanupCompletedVideos()}
              disabled={taskStats.success === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                taskStats.success === 0
                  ? undefined
                  : { backgroundColor: "#ecfdf5", borderColor: "#34d399", color: "#059669" }
              }
              title={t("Xóa file video gốc của tasks đã post thành công")}
            >
              <HiOutlineTrash className="text-base" />
              {t("Xóa Video OK")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium"
              style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" }}
            >
              <HiClock className="text-sm" />
              <span>{t("Chạy lại lúc")}</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                onBlur={saveScheduleTime}
                className="px-1 h-6 text-xs bg-white rounded border border-gray-300 outline-none"
                style={{ maxWidth: 110 }}
              />
            </div>
            <button
              type="button"
              onClick={() => void runCheck24h()}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border"
              style={{ backgroundColor: "#e0f2fe", borderColor: "#38bdf8", color: "#0284c7" }}
            >
              <HiCheck className="text-base" />
              Check 24h
            </button>
            <button
              type="button"
              onClick={() => startThreads()}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
              }
            >
              <HiPlay className="text-base" />
              {t("Bắt Đầu")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => void pauseThreads()}
              disabled={!threads.some((i) => i.selected && i.status === "running")}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={{ backgroundColor: "#ffedd5", borderColor: "#fb923c", color: "#c2410c" }}
            >
              <HiOutlinePause className="text-base" />
              {t("Tạm Dừng")}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#f1f5f9", borderColor: "#94a3b8", color: "#475569" }
              }
              title={t("Bỏ tick các mục đã chọn — không xóa task")}
            >
              <HiBan className="text-base" />
              {t("Xóa Chọn")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      <PanelListCard>
        {threads.length === 0 ? (
          <div className={panelListClasses.empty}>
            {t("Chưa có luồng đăng video. Nhấn Tạo Luồng để lấy video từ phiên Generate Video.")}
          </div>
        ) : (
          <>
            <PanelListToolbar
              trailing={
                <PanelListMatchCount
                  term={normalizedTerm}
                  matched={filteredGroups.length}
                  total={accountGroups.length}
                  totalExtra={
                    !normalizedTerm ? (
                      <>
                        {" "}
                        {t("tài khoản")} ({threads.length} video)
                      </>
                    ) : null
                  }
                />
              }
            >
              <PanelListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("Tìm username / caption / proxy...") as string}
              />
            </PanelListToolbar>

            <div className="overflow-x-auto">
              <table className={panelListClasses.table} style={{ minWidth: 1280 }}>
                <thead>
                  <tr className={panelListClasses.theadTr}>
                    <th className={`${panelListClasses.th} w-12`}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectVisible(e.target.checked)}
                        className={panelListClasses.checkbox}
                      />
                    </th>
                    <th className={`${panelListClasses.th} w-10 text-left`}>#</th>
                    <th className={`${panelListClasses.th} text-left`}>Username</th>
                    <th className={`${panelListClasses.th} text-center`}>{t("Video")}</th>
                    <th className={`${panelListClasses.th} text-left`}>Cookie</th>
                    <th className={`${panelListClasses.th} text-center`}>Quốc gia</th>
                    <th className={`${panelListClasses.th} text-left`}>Caption</th>
                    <th className={`${panelListClasses.th} text-center`}>Uploaded</th>
                    <th className={`${panelListClasses.th} text-center`}>Pending</th>
                    <th className={`${panelListClasses.th} text-center`}>Delay</th>
                    <th className={`${panelListClasses.th} text-left`}>Proxy</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Lỗi")}</th>
                    <th className={`${panelListClasses.th} text-center`}>Trạng thái</th>
                    <th className={`${panelListClasses.th} text-center`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={14} className={panelListClasses.emptyMatch}>
                        {t("Không có luồng nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group, index) => {
                      const expanded = Boolean(expandedAccounts[group.key]);
                      const accountSelected =
                        group.videos.length > 0 && group.videos.every((v) => v.selected);
                      const accountPartial =
                        !accountSelected && group.videos.some((v) => v.selected);
                      const status = aggregateStatus(group.videos);
                      const uploadedSum = group.videos.reduce((s, v) => s + v.uploaded, 0);
                      const pendingSum = group.videos.reduce((s, v) => s + v.pending, 0);
                      const totalVideos = group.videos.length;
                      const nextDue = Math.max(
                        0,
                        ...group.videos
                          .filter((v) => v.status === "running")
                          .map((v) => Number(v.nextRunAt) || 0)
                      );
                      const errorText =
                        group.videos.map((v) => v.error).find((e) => e && e !== "-") || "-";
                      const captionPreview =
                        group.videos[0]?.caption?.split("\n")[0]?.slice(0, 40) || "-";
                      const badge24 = check24hBadge(group.username);

                      return (
                        <Fragment key={group.key}>
                          <tr className={panelListRowClass({ selected: accountSelected })}>
                            <td className={panelListClasses.td}>
                              <input
                                type="checkbox"
                                checked={accountSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = accountPartial;
                                }}
                                onChange={(e) => toggleSelectAccount(group, e.target.checked)}
                                className={panelListClasses.checkbox}
                              />
                            </td>
                            <td className={`${panelListClasses.td} font-mono text-xs text-gray-400`}>
                              {index + 1}
                            </td>
                            <td className={`${panelListClasses.td} font-semibold text-gray-900`}>
                              <div className="flex gap-1.5 items-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandAccount(group.key)}
                                  className="inline-flex justify-center items-center w-6 h-6 text-gray-600 rounded border border-gray-200 hover:bg-gray-100"
                                >
                                  {expanded ? <HiChevronDown /> : <HiChevronRight />}
                                </button>
                                {editingUsernameKey === group.key ? (
                                  <div className="flex gap-1 items-center">
                                    <input
                                      value={usernameDraft}
                                      onChange={(e) => setUsernameDraft(e.target.value)}
                                      className="px-1 w-24 h-7 text-xs rounded border"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      className="px-1 h-7 text-white rounded bg-success text-10"
                                      onClick={() => {
                                        const name = usernameDraft.trim();
                                        if (!name) return;
                                        patchAccountField(group, { username: name });
                                        setEditingUsernameKey(null);
                                      }}
                                    >
                                      OK
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="hover:underline"
                                    onClick={() => {
                                      setEditingUsernameKey(group.key);
                                      setUsernameDraft(group.username);
                                    }}
                                    title={t("Sửa username")}
                                  >
                                    {group.username}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              <button
                                type="button"
                                onClick={() => toggleExpandAccount(group.key)}
                                className="inline-flex gap-1 items-center px-2 h-6 font-bold text-purple-700 bg-purple-50 rounded-full border border-purple-200"
                              >
                                <RiVideoFill className="text-sm" />
                                {totalVideos}
                              </button>
                            </td>
                            <td className={`${panelListClasses.td} font-mono text-10`} style={{ maxWidth: 160 }}>
                              {editingCookieKey === group.key ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    value={cookieDraft}
                                    onChange={(e) => setCookieDraft(e.target.value)}
                                    className="px-1 w-full h-7 text-xs rounded border"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="px-1 h-7 text-white rounded bg-success text-10"
                                    onClick={() => {
                                      patchAccountField(group, { cookie: cookieDraft.trim() });
                                      setEditingCookieKey(null);
                                    }}
                                  >
                                    OK
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="block truncate text-left text-danger hover:underline"
                                  title={group.cookie || "-"}
                                  onClick={() => {
                                    setEditingCookieKey(group.key);
                                    setCookieDraft(group.cookie || "");
                                  }}
                                >
                                  {group.cookie
                                    ? `${group.cookie.slice(0, 24)}${group.cookie.length > 24 ? "…" : ""}`
                                    : "-"}
                                </button>
                              )}
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              {editingCountryKey === group.key ? (
                                <select
                                  className="h-7 text-xs rounded border"
                                  value={group.country}
                                  onChange={(e) => {
                                    patchAccountField(group, { country: e.target.value });
                                    setEditingCountryKey(null);
                                  }}
                                  onBlur={() => setEditingCountryKey(null)}
                                  autoFocus
                                >
                                  {COUNTRY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.value}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  className="rounded bg-gray-100 px-2 py-0.5 font-semibold"
                                  onClick={() => setEditingCountryKey(group.key)}
                                >
                                  {group.country}
                                </button>
                              )}
                            </td>
                            <td
                              className={`${panelListClasses.td} text-xs text-gray-600 truncate`}
                              style={{ maxWidth: 140 }}
                              title={group.videos[0]?.caption || ""}
                            >
                              {captionPreview}
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              {uploadedSum}/{totalVideos}
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              <span className="inline-flex justify-center items-center px-2 h-6 font-bold text-yellow-900 bg-yellow-400 rounded-full min-w-6">
                                {pendingSum}
                              </span>
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              <div className="text-xs">
                                {group.delayMin}-{group.delayMax}s
                              </div>
                              {status === "running" ? (
                                <span
                                  className={`mt-0.5 inline-flex rounded px-1.5 text-[10px] font-bold ${
                                    nextDue > nowSec
                                      ? "bg-yellow-200 text-yellow-900"
                                      : "bg-green-200 text-green-800"
                                  }`}
                                >
                                  {formatCountdown(nextDue, nowSec)}
                                </span>
                              ) : null}
                            </td>
                            <td className={`${panelListClasses.td} font-mono text-10`} style={{ maxWidth: 200 }}>
                              {editingProxyKey === group.key ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    value={proxyDraft}
                                    onChange={(e) => setProxyDraft(e.target.value)}
                                    placeholder="IP:PORT:USER:PASS"
                                    className="px-1 w-full h-7 text-xs rounded border"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="px-1.5 h-7 text-white rounded bg-success text-10"
                                    onClick={() => {
                                      patchAccountField(group, { proxy: proxyDraft.trim() });
                                      setEditingProxyKey(null);
                                    }}
                                  >
                                    OK
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="truncate" title={group.proxy || "-"}>
                                    {group.proxy || "-"}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-blue-600 underline text-10"
                                    onClick={() => {
                                      setEditingProxyKey(group.key);
                                      setProxyDraft(group.proxy || "");
                                    }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    className="text-green-700 underline text-10"
                                    onClick={() => applyRandomProxy(group)}
                                  >
                                    Đổi Proxy
                                  </button>
                                </div>
                              )}
                            </td>
                            <td
                              className={`${panelListClasses.td} truncate text-10 text-danger`}
                              style={{ maxWidth: 120 }}
                              title={errorText}
                            >
                              {errorText}
                            </td>
                            <td className={`${panelListClasses.td} text-center`}>
                              <span
                                className={`inline-flex h-6 items-center rounded-full px-2 text-10 font-bold text-white ${
                                  status === "running"
                                    ? "bg-success"
                                    : status === "success"
                                    ? "bg-info"
                                    : status === "error"
                                    ? "bg-danger"
                                    : "bg-gray-500"
                                }`}
                              >
                                {statusLabel(status)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1 justify-center">
                                <button
                                  type="button"
                                  onClick={() => startAccount(group)}
                                  className={`inline-flex justify-center items-center w-7 h-7 text-white rounded-md ${
                                    status === "running" ? "bg-warning" : "bg-success"
                                  }`}
                                  title={status === "running" ? t("Tạm dừng") : t("Chạy")}
                                >
                                  {status === "running" ? <HiOutlinePause /> : <HiPlay />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void runCheck24h([group.username])}
                                  className="inline-flex gap-0.5 justify-center items-center px-1.5 h-7 text-xs font-bold text-sky-700 rounded-md border border-sky-300 bg-sky-50"
                                  title={t("Check video 24h")}
                                >
                                  <HiClock className="text-sm" />
                                  {badge24 ? <span>{badge24}</span> : null}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteAccount(group)}
                                  className="inline-flex justify-center items-center w-7 h-7 rounded-md border border-danger bg-danger-light text-danger-dark"
                                  title={t("Xóa")}
                                >
                                  <HiOutlineTrash />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {expanded ? (
                            <tr className="border-b border-gray-200">
                              <td colSpan={14} className="px-3 py-3 bg-gray-50">
                                <div className="ml-8 space-y-2">
                                  <div className="flex gap-2 items-center text-xs font-semibold text-gray-600">
                                    <RiVideoFill className="text-purple-500" />
                                    {t("Danh sách video đã gắn")} ({totalVideos})
                                    <span className="font-normal text-gray-400">
                                      — {group.videos.filter((v) => v.selected).length} {t("đã chọn")}
                                    </span>
                                  </div>
                                  <div className="overflow-hidden bg-white rounded-lg border border-gray-200">
                                    {group.videos.map((video, videoIdx) => {
                                      const title =
                                        video.productLink?.match(/\/([^/?#]+)(?:\?|#|$)/)?.[1] ||
                                        video.caption?.split("\n")[0]?.slice(0, 48) ||
                                        `${t("Video")} ${videoIdx + 1}`;
                                      const canPlay = Boolean(
                                        String(video.videoFile || "").trim() ||
                                          String(video.productId || "").trim() ||
                                          String(video.generateItemId || "").trim()
                                      );
                                      return (
                                        <div
                                          key={video.id}
                                          className={`flex flex-wrap gap-3 items-center px-3 py-2.5 ${
                                            videoIdx > 0 ? "border-t border-gray-100" : ""
                                          } ${video.selected ? "bg-blue-50/60" : ""}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={Boolean(video.selected)}
                                            onChange={(e) =>
                                              toggleSelectVideo(video.id, e.target.checked)
                                            }
                                            className={panelListClasses.checkbox}
                                            title={t("Chọn video")}
                                          />
                                          <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-xs font-bold text-purple-700 bg-purple-50 rounded-full border border-purple-200">
                                            {videoIdx + 1}
                                          </div>
                                          <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
                                            <div className="text-xs font-semibold text-gray-900 truncate" title={title}>
                                              {title}
                                            </div>
                                            {video.productLink ? (
                                              <a
                                                href={video.productLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block mt-0.5 text-10 text-blue-600 truncate hover:underline"
                                              >
                                                {video.productLink}
                                              </a>
                                            ) : (
                                              <div className="mt-0.5 text-10 text-gray-400">
                                                {t("Chưa có link sản phẩm")}
                                              </div>
                                            )}
                                            {video.postLink ? (
                                              <a
                                                href={video.postLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block mt-0.5 text-10 text-green-700 truncate hover:underline"
                                              >
                                                Post: {video.postId || video.postLink}
                                              </a>
                                            ) : null}
                                          </div>
                                          <span
                                            className={`inline-flex h-6 flex-shrink-0 items-center rounded-full px-2 text-10 font-bold text-white ${
                                              video.status === "running"
                                                ? "bg-success"
                                                : video.status === "success"
                                                ? "bg-info"
                                                : video.status === "error"
                                                ? "bg-danger"
                                                : "bg-gray-500"
                                            }`}
                                          >
                                            {statusLabel(video.status)}
                                          </span>
                                          <div className="flex flex-shrink-0 gap-1 items-center ml-auto">
                                            <button
                                              type="button"
                                              disabled={!canPlay}
                                              onClick={() => void playVideo(video)}
                                              className="inline-flex gap-1 items-center px-2.5 h-7 text-xs font-semibold text-purple-700 bg-purple-50 rounded-md border border-purple-200 disabled:opacity-40"
                                            >
                                              <RiVideoFill className="text-sm" />
                                              {t("Play")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (video.status === "running") {
                                                  delayQueueRef.current.delete(video.id);
                                                  setThreads((prev) =>
                                                    prev.map((row) =>
                                                      row.id === video.id
                                                        ? {
                                                            ...row,
                                                            status: "stopped",
                                                            nextRunAt: 0,
                                                            jobId: undefined,
                                                          }
                                                        : row
                                                    )
                                                  );
                                                } else if (video.status !== "success") {
                                                  startThreads([video.id]);
                                                }
                                              }}
                                              className="inline-flex justify-center items-center w-7 h-7 text-white rounded-md bg-success"
                                            >
                                              {video.status === "running" ? (
                                                <RiLoader4Line className="animate-spin" />
                                              ) : (
                                                <HiPlay className="text-sm" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setThreads((prev) =>
                                                  prev.filter((row) => row.id !== video.id)
                                                )
                                              }
                                              className="inline-flex justify-center items-center w-7 h-7 rounded-md border border-danger bg-danger-light text-danger-dark"
                                            >
                                              <HiOutlineTrash className="text-sm" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelListCard>

      <Dialog
        isOpen={importOpen}
        onClose={() => {
          if (importing) return;
          setImportOpen(false);
        }}
        title={t("Tạo Luồng")}
        icon={<RiAddLine />}
        width="720px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
      >
        <Dialog.Body>
          <div className="pt-2 space-y-4">
            <div>
              <label className="block mb-1 text-xs font-bold text-gray-700">
                {t("Phiên Generate Video")}
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="px-3 w-full h-9 text-sm bg-white rounded border border-gray-300 outline-none"
              >
                {!importHistory.length ? (
                  <option value="">{t("Chưa có phiên — hãy import ở tab Generate Video")}</option>
                ) : (
                  importHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatImportHistoryOption(item)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  {t("Số lượng video / tài khoản")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_UPLOAD_ITEMS}
                  value={videosPerAccount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setVideosPerAccount(
                      Number.isFinite(n)
                        ? Math.max(1, Math.min(MAX_UPLOAD_ITEMS, Math.round(n)))
                        : 1
                    );
                  }}
                  className="px-3 w-full h-9 text-sm bg-white rounded border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">{t("Quốc gia")}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="px-3 w-full h-9 text-sm bg-white rounded border border-gray-300 outline-none"
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="flex gap-1 items-center mb-1 text-xs font-bold text-gray-700">
                <HiClock />
                {t("Thời gian chờ (giây)")}
              </label>
              <div className="flex overflow-hidden rounded border border-gray-300">
                <input
                  type="number"
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value) || 0)}
                  className="px-3 w-full h-9 text-sm outline-none"
                />
                <span className="flex items-center px-3 text-xs text-gray-500 bg-gray-50">
                  {t("đến")}
                </span>
                <input
                  type="number"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value) || 0)}
                  className="px-3 w-full h-9 text-sm outline-none"
                />
                <span className="flex items-center px-3 text-xs text-gray-500 bg-gray-50">
                  {t("giây")}
                </span>
              </div>
            </div>
            <label className="inline-flex gap-2 items-center text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="w-4 h-4"
              />
              {t("Tự động bắt đầu chạy sau khi import")}
            </label>
          </div>
          <div className="flex gap-2 justify-end w-full">
            <button
              type="button"
              disabled={importing}
              onClick={() => setImportOpen(false)}
              className="px-4 h-9 text-sm font-bold text-white bg-gray-600 rounded hover:bg-gray-700 disabled:opacity-60"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              onClick={() => void handleImportFromSession()}
              disabled={importing || !selectedSessionId}
              className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {importing ? <RiLoader4Line className="animate-spin" /> : <HiUpload />}
              {t("Nhập & Tạo Luồng")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>

      <VideoDialog
        videoUrl={previewVideoUrl}
        isOpen={!!previewVideoUrl}
        onClose={() => setPreviewVideoUrl("")}
        aspectRatio="9:16"
      />
    </div>
  );
}

/** Alias tương thích tên cũ */
export const ShopeeVideoUploadPanel = ShopeeUploadFlowPanel;
