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
  HiOutlineX,
  HiPlay,
  HiRefresh,
  HiSearch,
  HiUpload,
} from "react-icons/hi";
import { RiAddLine, RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { SceneHistoryDropdown } from "../../app/affiliate-video/shared/scene-history-dropdown";
import { VideoDialog } from "../../shared/common/video-dialog";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { formatImportHistoryOption, ImportHistoryItem } from "../import-history";
import { hydrateMergedVideoUrls, resolveMergedPreviewUrl } from "../merged-video";
import { getSessionItems } from "../thread-store";
import { AffiliatePlusUser, createEmptyItem } from "../types";
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
} from "../upload-history";

type UploadStatus = "stopped" | "running" | "success" | "error";

const MAX_UPLOAD_ITEMS = 90;

/**
 * Rải đều `videoCount` video cho `accountCount` account.
 * Mỗi account nhận số lượng gần bằng nhau (lệch tối đa 1), không vượt `cap`.
 */
function computeEvenPerAccountCounts(
  videoCount: number,
  accountCount: number,
  cap: number
): number[] {
  const counts = Array.from({ length: Math.max(0, accountCount) }, () => 0);
  if (accountCount <= 0 || videoCount <= 0 || cap <= 0) return counts;

  const toAssign = Math.min(videoCount, accountCount * cap);
  const base = Math.floor(toAssign / accountCount);
  let rem = toAssign % accountCount;

  for (let i = 0; i < accountCount; i++) {
    const n = base + (rem > 0 ? 1 : 0);
    counts[i] = Math.min(cap, n);
    if (rem > 0) rem--;
  }
  return counts;
}

type ShopeeVideoUploadThread = {
  id: string;
  selected: boolean;
  username: string;
  cookie: string;
  country: string;
  caption: string;
  productLink: string;
  productId: string;
  generateItemId: string;
  videoFile: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  proxy: string;
  error: string;
  status: UploadStatus;
};

async function hydrateUploadThreads(
  list: PersistedUploadThread[]
): Promise<ShopeeVideoUploadThread[]> {
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
    };
  });
}

const COUNTRY_OPTIONS = [
  { value: "VN", label: "VN - Việt Nam" },
  { value: "TH", label: "TH - Thái Lan" },
  { value: "ID", label: "ID - Indonesia" },
  { value: "MY", label: "MY - Malaysia" },
  { value: "PH", label: "PH - Philippines" },
  { value: "SG", label: "SG - Singapore" },
];

function makeThread(
  index: number,
  params: Partial<ShopeeVideoUploadThread>
): ShopeeVideoUploadThread {
  return {
    id: crypto.randomUUID(),
    selected: true,
    username: params.username || `ACC${String(index + 1).padStart(3, "0")}`,
    cookie: params.cookie || "",
    country: params.country || "VN",
    caption: params.caption || "",
    productLink: params.productLink || "",
    productId: params.productId || "",
    generateItemId: params.generateItemId || "",
    videoFile: params.videoFile || "",
    uploaded: params.uploaded ?? 0,
    pending: params.pending ?? 1,
    delayMin: params.delayMin ?? 180,
    delayMax: params.delayMax ?? 240,
    proxy: params.proxy || "",
    error: params.error || "-",
    status: params.status || "stopped",
  };
}

function statusLabel(status: UploadStatus) {
  if (status === "running") return "Đang chạy";
  if (status === "success") return "Xong";
  if (status === "error") return "Lỗi";
  return "Dừng";
}

function aggregateStatus(videos: ShopeeVideoUploadThread[]): UploadStatus {
  if (!videos.length) return "stopped";
  if (videos.some((v) => v.status === "running")) return "running";
  if (videos.some((v) => v.status === "error")) return "error";
  if (videos.every((v) => v.status === "success")) return "success";
  return "stopped";
}

type AccountGroup = {
  key: string;
  username: string;
  cookie: string;
  proxy: string;
  country: string;
  delayMin: number;
  delayMax: number;
  videos: ShopeeVideoUploadThread[];
};

interface Props {
  users: AffiliatePlusUser[];
  importHistory: ImportHistoryItem[];
  selectedHistoryId: string | null;
  onUpdateUsers: (users: AffiliatePlusUser[]) => void | Promise<void>;
}

export function ShopeeVideoUploadPanel({
  users,
  importHistory,
  selectedHistoryId,
  onUpdateUsers,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [threads, setThreads] = useState<ShopeeVideoUploadThread[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [delayMin, setDelayMin] = useState(180);
  const [delayMax, setDelayMax] = useState(240);
  const [videosPerAccount, setVideosPerAccount] = useState(MAX_UPLOAD_ITEMS);
  const [country, setCountry] = useState("VN");
  const [autoStart, setAutoStart] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [selectedUploadHistoryId, setSelectedUploadHistoryIdState] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const skipPersistRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUploadHistoryIdRef = useRef<string | null>(null);

  selectedUploadHistoryIdRef.current = selectedUploadHistoryId;

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refreshUploadHistory = useCallback(async () => {
    try {
      const history = await getUploadHistory();
      setUploadHistory(history);
      return history;
    } catch (err) {
      console.warn("[ShopeeVideoUploadPanel] load upload history failed", err);
      return [] as UploadHistoryItem[];
    }
  }, []);

  // Khôi phục phiên upload đã lưu (ưu tiên hơn generateItems trên user)
  useEffect(() => {
    if (restoredRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        const history = await getUploadHistory();
        const selectedId =
          (await getSelectedUploadHistoryId()) || history[0]?.id || null;

        if (cancelled) return;
        setUploadHistory(history);
        setSelectedUploadHistoryIdState(selectedId);
        selectedUploadHistoryIdRef.current = selectedId;

        if (selectedId) {
          const entry = history.find((h) => h.id === selectedId);
          const rawThreads = entry?.data?.threads || [];
          if (rawThreads.length) {
            skipPersistRef.current = true;
            const next = await hydrateUploadThreads(rawThreads);
            if (cancelled) return;
            setThreads(next);
            restoredRef.current = true;
            skipPersistRef.current = false;
            return;
          }
        }

        // Fallback: generateItems trên account (lần đầu chưa có lịch sử upload)
        if (!users.length) {
          restoredRef.current = true;
          return;
        }

        const linkedPairs = users.flatMap((u) => {
          if (u.active === false) return [];
          const items = u.generateItems || [];
          return items
            .filter((g) => g.itemId || g.productId || g.mergedVideoUrl || g.productLink)
            .map((g) => ({ user: u, g }));
        });

        if (!linkedPairs.length) {
          restoredRef.current = true;
          return;
        }

        const pseudoItems = linkedPairs.map(({ g }) =>
          createEmptyItem({
            id: g.itemId || crypto.randomUUID(),
            productId: g.productId || "",
            productName: g.productName || "",
            productLink: g.productLink || "",
            prompt: g.caption || "",
            mergedVideoUrl: g.mergedVideoUrl || "",
          })
        );
        const hydrated = await hydrateMergedVideoUrls(pseudoItems);
        if (cancelled) return;

        const next = linkedPairs.map(({ user, g }, index) => {
          const hydratedItem = hydrated[index];
          const videoFile =
            String(hydratedItem?.mergedVideoUrl || "").trim() ||
            String(g.mergedVideoUrl || "").trim();
          return makeThread(index, {
            username: user.username,
            cookie: user.cookie || "",
            proxy: user.proxy || "",
            country,
            caption: g.caption || g.productName || "",
            productLink: g.productLink || "",
            productId: g.productId || "",
            generateItemId: g.itemId || "",
            videoFile,
            delayMin,
            delayMax,
            pending: 1,
            uploaded: 0,
            status: "stopped",
          });
        });

        skipPersistRef.current = true;
        setThreads(next);
        restoredRef.current = true;
        skipPersistRef.current = false;
      } catch (err) {
        console.warn("[ShopeeVideoUploadPanel] restore failed", err);
        restoredRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Auto-lưu phiên đang chọn khi danh sách luồng đổi
  useEffect(() => {
    if (!restoredRef.current || skipPersistRef.current) return;
    const id = selectedUploadHistoryIdRef.current;
    if (!id) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void updateUploadHistorySession(id, threads as PersistedUploadThread[])
        .then(() => refreshUploadHistory())
        .catch((err) => console.warn("[ShopeeVideoUploadPanel] persist session failed", err));
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

  const accountGroups = useMemo(() => {
    const map = new Map<string, AccountGroup>();
    for (const item of threads) {
      const key = item.username || item.id;
      const existing = map.get(key);
      if (existing) {
        existing.videos.push(item);
      } else {
        map.set(key, {
          key,
          username: item.username,
          cookie: item.cookie,
          proxy: item.proxy,
          country: item.country,
          delayMin: item.delayMin,
          delayMax: item.delayMax,
          videos: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [threads]);

  const stats = useMemo(() => {
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

  const selectedAccountCount = filteredGroups.filter((g) =>
    g.videos.every((v) => v.selected)
  ).length;
  const selectedCount = threads.filter((i) => i.selected).length;
  const allVisibleSelected =
    filteredGroups.length > 0 && filteredGroups.every((g) => g.videos.every((v) => v.selected));

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

  const toggleExpandAccount = (key: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startThreads = (ids?: string[]) => {
    const targetIds = ids?.length
      ? new Set(ids)
      : new Set(threads.filter((i) => i.selected).map((i) => i.id));
    setThreads((prev) =>
      prev.map((item) =>
        targetIds.has(item.id)
          ? {
              ...item,
              status: "running",
              error: "-",
            }
          : item
      )
    );
  };

  const pauseThreads = () => {
    setThreads((prev) =>
      prev.map((item) => (item.status === "running" ? { ...item, status: "stopped" } : item))
    );
  };

  const deleteSelected = () => {
    setThreads((prev) => prev.filter((item) => !item.selected));
  };

  const handleSelectUploadHistory = async (id: string) => {
    const entry = uploadHistory.find((h) => h.id === id);
    if (!entry) return;
    try {
      skipPersistRef.current = true;
      const next = await hydrateUploadThreads(entry.data.threads || []);
      setThreads(next);
      setSelectedUploadHistoryIdState(id);
      selectedUploadHistoryIdRef.current = id;
      await setSelectedUploadHistoryId(id);
    } catch (err: any) {
      console.warn("[ShopeeVideoUploadPanel] select upload history failed", err);
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

  const startAccount = (group: AccountGroup) => {
    startThreads(group.videos.map((v) => v.id));
  };

  const deleteAccount = (group: AccountGroup) => {
    const ids = new Set(group.videos.map((v) => v.id));
    setThreads((prev) => prev.filter((row) => !ids.has(row.id)));
  };

  const playVideo = async (video: ShopeeVideoUploadThread) => {
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
      console.warn("[ShopeeVideoUploadPanel] playVideo failed", err);
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

      // Rãi đều video nối cho các account; lệch tối đa 1; không vượt cap setting
      const perAccountCap = Math.max(
        1,
        Math.min(MAX_UPLOAD_ITEMS, Math.round(Number(videosPerAccount) || MAX_UPLOAD_ITEMS))
      );
      const perAccountCounts = computeEvenPerAccountCounts(
        readyItems.length,
        accountPool.length,
        perAccountCap
      );
      const next: ShopeeVideoUploadThread[] = [];
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
              cookie: user.cookie || "",
              proxy: user.proxy || "",
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
              status: autoStart ? "running" : "stopped",
            })
          );
          rowIndex += 1;
        }
      }

      if (!next.length) {
        toast.warn(t("Không còn video để gắn cho tài khoản"));
        return;
      }

      const assignedCounts = perAccountCounts.filter((n) => n > 0);
      const minPer = assignedCounts.length ? Math.min(...assignedCounts) : 0;
      const maxPer = assignedCounts.length ? Math.max(...assignedCounts) : 0;

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
      toast.success(
        minPer === maxPer
          ? t("Đã tạo {{count}} luồng — {{per}} video/account (rãi đều, max {{cap}})", {
              count: next.length,
              per: maxPer,
              cap: perAccountCap,
            })
          : t("Đã tạo {{count}} luồng — {{min}}–{{max}} video/account (rãi đều, max {{cap}})", {
              count: next.length,
              min: minPer,
              max: maxPer,
              cap: perAccountCap,
            })
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t("Không tải được phiên Generate Video"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: t("Tổng"),
            value: stats.total,
            bg: "#e0f2fe",
            border: "#38bdf8",
            text: "#0284c7",
            dot: "#0ea5e9",
          },
          {
            label: t("Chờ"),
            value: stats.waiting,
            bg: "#fef9c3",
            border: "#fbbf24",
            text: "#ca8a04",
            dot: "#eab308",
          },
          {
            label: t("Đang upload"),
            value: stats.running,
            bg: "#ecfeff",
            border: "#22d3ee",
            text: "#0891b2",
            dot: "#06b6d4",
          },
          {
            label: t("Thành công"),
            value: stats.success,
            bg: "#ecfdf5",
            border: "#34d399",
            text: "#059669",
            dot: "#10b981",
          },
          {
            label: t("Lỗi"),
            value: stats.error,
            bg: "#fff1f2",
            border: "#fb7185",
            text: "#e11d48",
            dot: "#f43f5e",
          },
        ].map((s) => (
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
              disabled={stats.error === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                stats.error === 0
                  ? undefined
                  : { backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }
              }
            >
              <HiRefresh className="text-base" />
              {t("Retry đã lỗi")}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#fff1f2", borderColor: "#fb7185", color: "#e11d48" }
              }
            >
              <HiOutlineTrash className="text-base" />
              {t("Xóa Tasks")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
              style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" }}
            >
              <HiClock className="text-sm" />
              {t("Chạy lại lúc")} 07:00 SA
            </span>
            <button
              type="button"
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#e0f2fe", borderColor: "#38bdf8", color: "#0284c7" }}
            >
              <HiCheck className="text-base" />
              Check 24h
            </button>
            <button
              type="button"
              onClick={() => startThreads()}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
              }
            >
              <HiPlay className="text-base" />
              {t("Bắt Đầu")}
            </button>
            <button
              type="button"
              onClick={pauseThreads}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#ffedd5", borderColor: "#fb923c", color: "#c2410c" }}
            >
              <HiOutlinePause className="text-base" />
              {t("Tạm Dừng")}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedCount}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !selectedCount
                  ? undefined
                  : { backgroundColor: "#fff1f2", borderColor: "#fb7185", color: "#e11d48" }
              }
            >
              <HiBan className="text-base" />
              {t("Xóa Chọn")}
              {selectedAccountCount > 0 ? ` (${selectedAccountCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        {threads.length === 0 ? (
          <div className="py-16 text-sm text-center text-gray-400">
            {t("Chưa có luồng đăng video. Nhấn Nhập Excel & Tạo Luồng để bắt đầu.")}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="relative flex-1 max-w-md" style={{ minWidth: 240 }}>
                <HiSearch className="absolute left-3 top-1/2 text-base text-gray-400 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("Tìm username / caption / proxy...") as string}
                  className="pr-9 pl-9 w-full h-9 text-sm bg-white rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex absolute right-2 top-1/2 justify-center items-center w-6 h-6 text-gray-400 rounded-md -translate-y-1/2 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t("Xóa tìm kiếm")}
                  >
                    <HiOutlineX className="text-sm" />
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2 items-center text-xs text-gray-500">
                {normalizedTerm ? (
                  <span>
                    {t("Khớp")}: <b className="text-gray-800">{filteredGroups.length}</b>/
                    {accountGroups.length}
                  </span>
                ) : (
                  <span>
                    {t("Tổng")}: <b className="text-gray-800">{accountGroups.length}</b>{" "}
                    {t("tài khoản")} ({threads.length} video)
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 1100 }}>
                <thead>
                  <tr className="font-bold tracking-wide text-left text-gray-600 uppercase bg-gray-50 text-10">
                    <th className="px-3 py-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectVisible(e.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-2 w-12">#</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2 text-center">{t("Video")}</th>
                    <th className="px-3 py-2">Cookie</th>
                    <th className="px-3 py-2 text-center">Quốc gia</th>
                    <th className="px-3 py-2 text-center">Uploaded</th>
                    <th className="px-3 py-2 text-center">Pending</th>
                    <th className="px-3 py-2 text-center">Delay</th>
                    <th className="px-3 py-2">Proxy</th>
                    <th className="px-3 py-2 text-center">Trạng thái</th>
                    <th className="px-3 py-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-10 text-sm text-center text-gray-400">
                        {t("Không có luồng nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group, index) => {
                      const expanded = Boolean(expandedAccounts[group.key]);
                      const accountSelected = group.videos.every((v) => v.selected);
                      const status = aggregateStatus(group.videos);
                      const uploadedSum = group.videos.reduce((s, v) => s + v.uploaded, 0);
                      const pendingSum = group.videos.reduce((s, v) => s + v.pending, 0);
                      const totalVideos = group.videos.length;

                      return (
                        <Fragment key={group.key}>
                          <tr className="bg-white border-b border-gray-100">
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={accountSelected}
                                onChange={(e) => toggleSelectAccount(group, e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">{index + 1}</td>
                            <td className="px-3 py-2 font-bold text-gray-900">
                              <div className="flex gap-1.5 items-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandAccount(group.key)}
                                  className="inline-flex justify-center items-center w-6 h-6 text-gray-600 rounded border border-gray-200 hover:bg-gray-100"
                                  title={
                                    expanded ? t("Ẩn danh sách video") : t("Hiện danh sách video")
                                  }
                                >
                                  {expanded ? <HiChevronDown /> : <HiChevronRight />}
                                </button>
                                <span>{group.username}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandAccount(group.key)}
                                className="inline-flex gap-1 items-center px-2 h-6 font-bold text-purple-700 bg-purple-50 rounded-full border border-purple-200"
                                title={t("Danh sách video đã gắn")}
                              >
                                <RiVideoFill className="text-sm" />
                                {totalVideos}
                              </button>
                            </td>
                            <td
                              className="px-3 py-2 font-mono truncate text-10 text-danger"
                              style={{ maxWidth: 180 }}
                            >
                              {group.cookie || "-"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                                {group.country}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {uploadedSum}/{uploadedSum + pendingSum}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex justify-center items-center px-2 h-6 font-bold text-yellow-900 bg-yellow-400 rounded-full min-w-6">
                                {pendingSum}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {group.delayMin}-{group.delayMax}s
                            </td>
                            <td
                              className="px-3 py-2 font-mono truncate text-10 text-pink"
                              style={{ maxWidth: 220 }}
                            >
                              {group.proxy || "-"}
                            </td>
                            <td className="px-3 py-2 text-center">
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
                                  className="inline-flex justify-center items-center w-7 h-7 text-white rounded-md bg-success"
                                  title={t("Chạy")}
                                >
                                  {status === "running" ? (
                                    <RiLoader4Line className="animate-spin" />
                                  ) : (
                                    <HiPlay />
                                  )}
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
                            <tr key={`${group.key}-videos`} className="border-b border-gray-200">
                              <td colSpan={12} className="px-3 py-3 bg-gray-50">
                                <div className="ml-8 space-y-2">
                                  <div className="flex gap-2 items-center text-xs font-semibold text-gray-600">
                                    <RiVideoFill className="text-purple-500" />
                                    {t("Danh sách video đã gắn")} ({totalVideos})
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
                                          }`}
                                        >
                                          <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-xs font-bold text-purple-700 bg-purple-50 rounded-full border border-purple-200">
                                            {videoIdx + 1}
                                          </div>

                                          <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
                                            <div
                                              className="text-xs font-semibold text-gray-900 truncate"
                                              title={title}
                                            >
                                              {title}
                                            </div>
                                            {video.productLink ? (
                                              <a
                                                href={video.productLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block mt-0.5 text-10 text-blue-600 truncate hover:underline"
                                                title={video.productLink}
                                              >
                                                {video.productLink}
                                              </a>
                                            ) : (
                                              <div className="mt-0.5 text-10 text-gray-400">
                                                {t("Chưa có link sản phẩm")}
                                              </div>
                                            )}
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

                                          <span className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
                                            {video.uploaded}/{video.uploaded + video.pending}
                                          </span>

                                          {video.pending > 0 ? (
                                            <span className="inline-flex flex-shrink-0 justify-center items-center px-2 h-6 font-bold text-yellow-900 bg-yellow-300 rounded-full text-10 min-w-6">
                                              {video.pending}
                                            </span>
                                          ) : null}

                                          <div className="flex flex-shrink-0 gap-1 items-center ml-auto">
                                            <button
                                              type="button"
                                              disabled={!canPlay}
                                              onClick={() => void playVideo(video)}
                                              className="inline-flex gap-1 items-center px-2.5 h-7 text-xs font-semibold text-purple-700 bg-purple-50 rounded-md border border-purple-200 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                              title={t("Xem video")}
                                            >
                                              <RiVideoFill className="text-sm" />
                                              {t("Play")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => startThreads([video.id])}
                                              className="inline-flex justify-center items-center w-7 h-7 text-white rounded-md bg-success"
                                              title={t("Chạy upload")}
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
                                              title={t("Xóa")}
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
      </div>

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
                className="px-3 w-full h-9 text-sm bg-white rounded border border-gray-300 outline-none focus:border-blue-400"
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
                    if (!Number.isFinite(n)) {
                      setVideosPerAccount(1);
                      return;
                    }
                    setVideosPerAccount(Math.max(1, Math.min(MAX_UPLOAD_ITEMS, Math.round(n))));
                  }}
                  className="px-3 w-full h-9 text-sm bg-white rounded border border-gray-300 outline-none focus:border-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    "Rãi đều video nối cho mọi account (lệch tối đa 1). Mỗi account ≤ {{max}} video, không trùng video.",
                    {
                      max: Math.max(
                        1,
                        Math.min(MAX_UPLOAD_ITEMS, Math.round(Number(videosPerAccount) || 1))
                      ),
                    }
                  )}
                </p>
              </div>

              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  {t("Quốc gia")}
                </label>
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
                <span className="flex items-center px-3 text-xs text-gray-500 whitespace-nowrap bg-gray-50">
                  {t("đến")}
                </span>
                <input
                  type="number"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value) || 0)}
                  className="px-3 w-full h-9 text-sm outline-none"
                />
                <span className="flex items-center px-3 text-xs text-gray-500 whitespace-nowrap bg-gray-50">
                  {t("giây")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t("Random delay giữa mỗi video upload")}
              </p>
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
              className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-4 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
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
