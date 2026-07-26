import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaPhotoVideo } from "react-icons/fa";
import {
  HiBan,
  HiCheck,
  HiClock,
  HiCog,
  HiDownload,
  HiOutlinePause,
  HiOutlinePhotograph,
  HiOutlineTrash,
  HiOutlineX,
  HiPencil,
  HiPlay,
  HiRefresh,
  HiUpload,
} from "react-icons/hi";
import { RiArrowDownSLine, RiDatabase2Line, RiFileExcel2Line, RiLoader4Line, RiVideoFill } from "react-icons/ri";
import {
  MediaGenerationJobError,
  useMediaGenerationJob,
} from "../../../lib/hooks/useMediaGenerationJob";
import { useToast } from "../../../lib/providers/toast-provider";
import { useConcurrencyLimits } from "../../app/affiliate-video/hook/useConcurrencyLimits";
import { zipAndDownload } from "../../app/affiliate-video/shared/batchDownloadMedia";
import { SceneHistoryDropdown } from "../../app/affiliate-video/shared/scene-history-dropdown";
import {
  PanelListCard,
  PanelListMatchCount,
  PanelListPagination,
  PanelListSearch,
  PanelListToolbar,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { ImageDialog } from "../../shared/utilities/dialog/image-dialog";
import { Button, Field, Form, Input } from "../../shared/utilities/form";
import { Popover } from "../../shared/utilities/popover/popover";
import {
  buildMergedVideoFileBase,
  exportAffiliatePlusCSV,
  parseAffiliatePlusCSV,
  parseAffiliatePlusExcel,
} from "../csv-parser";
import { ThreadMetaRecord } from "../idb";
import { formatImportHistoryOption, ImportHistoryItem } from "../import-history";
import {
  getMergedVideoBlob,
  getMergedVideoStorageKey,
  hasExistingGeneratedVideo,
  hasMergedVideoRef,
  hasVariantVideoUrls,
  hydrateMergedVideoUrls,
  mergeVideosToIndexedDb,
  persistProductVideosWithEnrichment,
  removeMergedVideoFromIndexedDb,
  resolveMergedPreviewUrl,
  resolveVariantPreviewUrls,
} from "../merged-video";
import {
  formatDuration,
  formatSessionTime,
  listScrapeCsvSessions,
  ScrapeCsvSession,
  sessionDisplayName,
} from "../scrape-csv-history";
import { prepareShopeeImageInput } from "../shopee-image";
import { loadGenerateVideoConfig } from "../storage";
import { ThreadRunner } from "../thread-runner";
import {
  countSelectedInSession,
  DEFAULT_SESSION_ID,
  getSessionItems,
  getSessionMeta,
  getThreadItem,
  normalizeSearch,
  patchThread,
  queryThreadPage,
  removeThread,
  removeThreads,
  replaceSessionThreads,
  sessionHasMergedVideos,
  subscribeThreadEvents,
} from "../thread-store";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  buildActivePromptFromConfig,
  CharacterProfile,
  GenerateVideoConfig,
  getMergeableVideoUrls,
  padVideoSlots,
  pickCharacterImage,
  ThreadStatus,
} from "../types";
import { GenerateVideoConfigDialog } from "./generate-video-config-dialog";

type EditField = "shopName" | "shopId" | "productName" | "imageUrl" | "cookie" | "hostPort" | null;

type VideoPreviewState =
  | {
      kind: "variants";
      title: string;
      itemId: string;
      slots: string[];
      disabled: boolean[];
      index: number;
      regenerating: Record<number, boolean>;
    }
  | {
      kind: "merged";
      title: string;
      itemId: string;
      urls: string[];
      index: number;
      /** Có URL nhưng không play được / không resolve được blob */
      error?: string;
    };

const EDIT_FIELD_LABELS: Record<Exclude<EditField, null>, string> = {
  shopName: "Tên shop",
  shopId: "ID shop",
  productName: "Tên sản phẩm",
  imageUrl: "Ảnh sản phẩm",
  cookie: "Cookie",
  hostPort: "Host Port",
};

function getCharacterPreview(config: GenerateVideoConfig): {
  url: string;
  name: string;
} {
  const character: CharacterProfile | undefined =
    config.characters.find((c) => c.id === config.characterId) || config.characters[0];
  if (!character) return { url: "", name: "" };
  const picked = pickCharacterImage(character);
  return {
    url: picked.url,
    name: character.characterName || character.name || "",
  };
}

interface ThreadManagementPanelProps {
  items: AffiliatePlusItem[];
  settings: AffiliatePlusSettings;
  isGlobalRunning: boolean;
  importHistory: ImportHistoryItem[];
  selectedHistoryId: string | null;
  onUpdateItems: (items: AffiliatePlusItem[]) => void;
  onImportComplete: (fileName: string, items: AffiliatePlusItem[]) => void | Promise<void>;
  onSelectHistory: (id: string) => void | Promise<void>;
  onDeleteHistorySession: (id: string) => void | Promise<void>;
  onClearHistory: () => void | Promise<void>;
  onAddLog: (message: string, level?: AffiliatePlusLog["level"], threadId?: string) => void;
}

export function ThreadManagementPanel({
  items,
  settings,
  isGlobalRunning,
  importHistory,
  selectedHistoryId,
  onUpdateItems,
  onImportComplete,
  onSelectHistory,
  onDeleteHistorySession,
  onClearHistory,
  onAddLog,
}: ThreadManagementPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { VIDEO_CONCURRENCY } = useConcurrencyLimits();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLButtonElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const sessionId = selectedHistoryId || DEFAULT_SESSION_ID;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const runnerRef = useRef<ThreadRunner | null>(null);
  const parentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [listMeta, setListMeta] = useState<ThreadMetaRecord | null>(null);
  const [visibleItems, setVisibleItems] = useState<AffiliatePlusItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalMatched, setListTotalMatched] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasMergedVideos, setHasMergedVideos] = useState(false);

  const [editField, setEditField] = useState<EditField>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [generateConfigOpen, setGenerateConfigOpen] = useState(false);
  const [scrapeImportOpen, setScrapeImportOpen] = useState(false);
  const [scrapeSessions, setScrapeSessions] = useState<ScrapeCsvSession[]>([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);
  const [importingAction, setImportingAction] = useState<"replace" | "merge" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  /** Tăng mỗi lần load — bỏ kết quả await cũ khi đổi phiên / search / trang. */
  const loadGenRef = useRef(0);
  const searchTermRef = useRef(searchTerm);
  const pageRef = useRef(page);
  const pageSizeRef = useRef(pageSize);
  searchTermRef.current = searchTerm;
  pageRef.current = page;
  pageSizeRef.current = pageSize;
  const [genConfig, setGenConfig] = useState<GenerateVideoConfig | null>(null);
  const [characterPreview, setCharacterPreview] = useState<{ url: string; name: string }>({
    url: "",
    name: "",
  });
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState | null>(null);
  const [zoomImage, setZoomImage] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Record<string, boolean>>({});
  const [mergingIds, setMergingIds] = useState<Record<string, boolean>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [downloadingMerged, setDownloadingMerged] = useState(false);
  const [clearingIdb, setClearingIdb] = useState(false);
  const pauseAllRef = useRef(false);
  /** threadId → jobId server đang chạy — dùng để cancel khi tạm dừng. */
  const activeJobIdsRef = useRef<Record<string, string>>({});
  /** ThreadRunner đang chạy batch — tránh auto-merge effect tranh ffmpeg với generate. */
  const batchRunningRef = useRef(false);
  const shopeeVideoJob = useMediaGenerationJob<{
    videoUri?: string | null;
    videoUris?: string[];
    mimeType?: string;
  }>();

  const cancelServerJobs = useCallback(
    async (threadIds?: string[]) => {
      const entries = Object.entries(activeJobIdsRef.current);
      const toCancel = threadIds?.length
        ? entries.filter(([tid]) => threadIds.includes(tid))
        : entries;
      if (!toCancel.length) return;
      await Promise.all(
        toCancel.map(async ([tid, jobId]) => {
          try {
            await shopeeVideoJob.cancel(jobId);
          } catch {
            // best-effort
          }
          delete activeJobIdsRef.current[tid];
        })
      );
    },
    [shopeeVideoJob]
  );

  const scheduleParentSync = useCallback(() => {
    const scheduledSessionId = sessionIdRef.current;
    if (parentSyncTimerRef.current) clearTimeout(parentSyncTimerRef.current);
    parentSyncTimerRef.current = setTimeout(() => {
      const activeSessionId = sessionIdRef.current;
      // Bỏ qua sync cũ sau import / đổi phiên — tránh ghi đè items & số luồng về 0
      if (activeSessionId !== scheduledSessionId) return;
      void getSessionItems(activeSessionId)
        .then(onUpdateItems)
        .catch((err) => console.warn("[thread-panel] parent sync failed", err));
    }, 400);
  }, [onUpdateItems]);

  const totalPages = Math.max(1, Math.ceil(listTotalMatched / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const safePageRef = useRef(safePage);
  safePageRef.current = safePage;

  const loadPage = useCallback(async (override?: { page?: number; q?: string }) => {
    const gen = ++loadGenRef.current;
    const requestedSessionId = sessionIdRef.current;
    const pageNum = override?.page ?? safePageRef.current;
    const q = override?.q ?? searchTermRef.current;
    const limit = pageSizeRef.current;
    const offset = (Math.max(1, pageNum) - 1) * limit;
    setListLoading(true);
    try {
      const [pageResult, meta, selected, hasMerged] = await Promise.all([
        queryThreadPage(requestedSessionId, { offset, limit, q }),
        getSessionMeta(requestedSessionId),
        countSelectedInSession(requestedSessionId),
        sessionHasMergedVideos(requestedSessionId),
      ]);
      if (gen !== loadGenRef.current || sessionIdRef.current !== requestedSessionId) return;
      const hydrated = await hydrateMergedVideoUrls(pageResult.items, requestedSessionId);
      if (gen !== loadGenRef.current || sessionIdRef.current !== requestedSessionId) return;
      setVisibleItems(hydrated);
      setListTotalMatched(pageResult.totalMatched);
      setListTotal(pageResult.total);
      setListMeta(meta);
      setSelectedCount(selected);
      setHasMergedVideos(hasMerged);
    } catch (err) {
      if (gen !== loadGenRef.current || sessionIdRef.current !== requestedSessionId) return;
      console.error("[thread-panel] loadPage failed", err);
    } finally {
      if (gen === loadGenRef.current && sessionIdRef.current === requestedSessionId) {
        setListLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Reset UI ngay khi đổi phiên — tránh giữ list/search của phiên cũ
    pageRef.current = 1;
    searchTermRef.current = "";
    setPage(1);
    setSearchQuery("");
    setSearchTerm("");
    setVisibleItems([]);
    setListTotal(0);
    setListTotalMatched(0);
    setListMeta(null);
    setSelectedCount(0);
    setHasMergedVideos(false);

    let cancelled = false;
    (async () => {
      if (!cancelled) await loadPage({ page: 1, q: "" });
    })();
    return () => {
      cancelled = true;
      loadGenRef.current += 1;
      if (parentSyncTimerRef.current) {
        clearTimeout(parentSyncTimerRef.current);
        parentSyncTimerRef.current = null;
      }
    };
  }, [sessionId, loadPage]);

  useEffect(() => {
    void loadPage({ page: safePage, q: searchTerm });
  }, [loadPage, safePage, pageSize, searchTerm]);

  useEffect(() => {
    return subscribeThreadEvents((ev) => {
      if (ev.sessionId !== sessionId) return;
      if (ev.type === "patch") {
        setVisibleItems((prev) => prev.map((i) => (i.id === ev.id ? ev.next : i)));
        if ("selected" in ev.patch) {
          void countSelectedInSession(sessionId).then(setSelectedCount);
        }
        if ("mergedVideoUrl" in ev.patch) {
          void sessionHasMergedVideos(sessionId).then(setHasMergedVideos);
        }
        scheduleParentSync();
      } else if (ev.type === "removed") {
        void loadPage();
        scheduleParentSync();
      } else if (ev.type === "meta") {
        setListMeta(ev.meta);
      }
    });
  }, [sessionId, loadPage, scheduleParentSync]);

  useEffect(() => {
    return () => {
      if (parentSyncTimerRef.current) clearTimeout(parentSyncTimerRef.current);
      runnerRef.current?.stop();
      const jobIds = Object.values(activeJobIdsRef.current);
      activeJobIdsRef.current = {};
      for (const jobId of jobIds) {
        void shopeeVideoJob.cancel(jobId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVideoPreviewMerged = (
    title: string,
    itemId: string,
    urls: string[],
    error?: string
  ) => {
    const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
    setVideoPreview({
      kind: "merged",
      title,
      itemId,
      urls: clean,
      index: 0,
      error: error || (clean.length ? undefined : t("Không có file video nối")),
    });
  };

  /** Preview variant: đủ số tab = config; slot trống = lỗi (tab đỏ). */
  const openVariantPreview = async (item: AffiliatePlusItem) => {
    const config = genConfig || (await loadGenerateVideoConfig());
    const slotCount = Math.max(item.videoUrls?.length || 0, config.videosPerJob || 1, 1);
    const slots = await resolveVariantPreviewUrls(item, slotCount, sessionId);
    const paddedSlots = Array.from({ length: slotCount }, (_, i) => slots[i] || "");
    const disabled = Array.from({ length: slotCount }, (_, i) => Boolean(item.videoDisabled?.[i]));
    setVideoPreview({
      kind: "variants",
      title: t("Kết quả video"),
      itemId: item.id,
      slots: paddedSlots,
      disabled,
      index: 0,
      regenerating: {},
    });
  };

  /** Preview video nối file: luôn mở dialog; lỗi thì không render <video>. */
  const openMergedPreview = async (item: AffiliatePlusItem) => {
    const title = t("Video nối file");
    try {
      let url = await resolveMergedPreviewUrl(item, sessionId);
      // Race ngắn: blob vừa ghi / enrich vừa ghi đè — thử lại 1 lần
      if (!url && hasMergedVideoRef(item.mergedVideoUrl)) {
        await new Promise((r) => setTimeout(r, 120));
        url = await resolveMergedPreviewUrl(item, sessionId);
      }
      if (!url) {
        openVideoPreviewMerged(title, item.id, [], t("Không mở được video — thử Nối lại"));
        return;
      }
      openVideoPreviewMerged(title, item.id, [url]);
    } catch (err: any) {
      console.warn("[openMergedPreview]", err);
      openVideoPreviewMerged(
        title,
        item.id,
        [],
        err?.message || t("Không mở được video")
      );
    }
  };

  const autoMergeAttemptedRef = useRef<Record<string, boolean>>({});

  /** Hoãn merge ffmpeg — nhường event loop để worker enqueue/poll job generate tiếp theo. */
  const MERGE_DEFER_MS = 400;

  const scheduleBackgroundMerge = useCallback(
    (mergeItemId: string, mergeKey: string, mergeUrls: string[], deferMs = MERGE_DEFER_MS) => {
      autoMergeAttemptedRef.current[mergeItemId] = true;
      setMergingIds((prev) => ({ ...prev, [mergeItemId]: true }));
      onAddLog(
        t("Đang nối {{count}} video...", { count: mergeUrls.length }),
        "info",
        mergeItemId
      );

      window.setTimeout(() => {
        if (pauseAllRef.current) {
          setMergingIds((prev) => {
            const next = { ...prev };
            delete next[mergeItemId];
            return next;
          });
          return;
        }

        void (async () => {
          try {
            const mergedUrl = await mergeVideosToIndexedDb(mergeKey, mergeUrls);
            if (pauseAllRef.current) return;
            await patchThread(sessionId, mergeItemId, { mergedVideoUrl: mergedUrl, error: "" });
            onAddLog(t("Đã nối video và lưu IndexedDB"), "success", mergeItemId);
            scheduleParentSync();
          } catch (mergeErr: any) {
            console.error(mergeErr);
            const msg = mergeErr?.message || t("Nối video thất bại");
            await patchThread(sessionId, mergeItemId, { error: msg });
            onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", mergeItemId);
            scheduleParentSync();
          } finally {
            setMergingIds((prev) => {
              const next = { ...prev };
              delete next[mergeItemId];
              return next;
            });
          }
        })();
      }, deferMs);
    },
    [MERGE_DEFER_MS, onAddLog, scheduleParentSync, sessionId, t]
  );

  const runPendingAutoMerge = useCallback(async () => {
    if (batchRunningRef.current) return;

    const all = await getSessionItems(sessionId);
    const hydrated = await hydrateMergedVideoUrls(all, sessionId);

    const pending = hydrated.filter((i) => {
      const mergeUrls = getMergeableVideoUrls(i);
      return (
        mergeUrls.length >= 2 &&
        !hasMergedVideoRef(i.mergedVideoUrl) &&
        !mergingIds[i.id] &&
        !generatingIds[i.id] &&
        !autoMergeAttemptedRef.current[i.id]
      );
    });

    if (!pending.length) {
      if (hydrated.some((i, idx) => i.mergedVideoUrl !== all[idx]?.mergedVideoUrl)) {
        void loadPage();
      }
      return;
    }

    for (const item of pending) {
      if (batchRunningRef.current) return;
      scheduleBackgroundMerge(
        item.id,
        getMergedVideoStorageKey(item, sessionId),
        getMergeableVideoUrls(item),
        0
      );
    }
  }, [generatingIds, loadPage, mergingIds, scheduleBackgroundMerge, sessionId]);

  // Tự nối lại các item đã có ≥2 video nhưng chưa có merged (và chưa có trong IDB)
  useEffect(() => {
    if (batchRunningRef.current) return;

    let cancelled = false;
    void (async () => {
      await runPendingAutoMerge();
      if (!cancelled) void loadPage();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, listMeta?.success, generatingIds, mergingIds, batchRunning]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await loadGenerateVideoConfig();
        if (cancelled) return;
        setGenConfig(config);
        setCharacterPreview(getCharacterPreview(config));
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generateConfigOpen]);

  const stats = useMemo(() => {
    return {
      total: listMeta?.total ?? listTotal,
      waiting: listMeta?.waiting ?? 0,
      uploading: listMeta?.uploading ?? 0,
      success: listMeta?.success ?? 0,
      error: listMeta?.error ?? 0,
    };
  }, [listMeta, listTotal]);

  const getErrorItems = (list: AffiliatePlusItem[]) =>
    list.filter((i) => i.status === "error" || Boolean(String(i.error || "").trim()));

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const patchItem = async (id: string, patch: Partial<AffiliatePlusItem>) => {
    const next = await patchThread(sessionId, id, patch);
    if (next) {
      setVisibleItems((prev) => prev.map((i) => (i.id === id ? next : i)));
      if ("selected" in patch) {
        setSelectedCount(await countSelectedInSession(sessionId));
      }
      scheduleParentSync();
    }
  };

  const updateItem = (id: string, patch: Partial<AffiliatePlusItem>) => {
    void patchItem(id, patch);
  };

  const updateAll = (fn: (item: AffiliatePlusItem) => AffiliatePlusItem) => {
    void (async () => {
      const all = await getSessionItems(sessionId);
      const next = all.map(fn);
      await replaceSessionThreads(sessionId, next);
      await loadPage();
      scheduleParentSync();
    })();
  };

  /** Apply patch cho tập item hiện hữu; khi đang search chỉ áp lên item khớp. */
  const applyToVisible = (fn: (item: AffiliatePlusItem) => AffiliatePlusItem) => {
    void (async () => {
      const q = searchTerm.trim() ? searchTerm : undefined;
      const { items: matched } = await queryThreadPage(sessionId, {
        offset: 0,
        limit: 999999,
        q,
      });
      for (const item of matched) {
        const next = fn(item);
        if (next !== item) await patchThread(sessionId, item.id, next);
      }
      await loadPage();
      scheduleParentSync();
    })();
  };

  const prepareImportItems = async (parsed: AffiliatePlusItem[]) => {
    if (!parsed.length) {
      toast.warn(
        t(
          "Không đọc được dữ liệu sản phẩm. Cần các cột: Tên shop, Tên sản phẩm, Ảnh, Link sản phẩm / Link affiliate"
        )
      );
      return null;
    }
    const genConfigLoaded = await loadGenerateVideoConfig();
    return parsed.map((item) => ({
      ...item,
      prompt: item.prompt || genConfigLoaded.activePrompt || "",
    }));
  };

  /** Import thay thế — clear danh sách hiện tại, tạo phiên mới. */
  const handleImportParsed = async (fileName: string, parsed: AffiliatePlusItem[]) => {
    const withPrompt = await prepareImportItems(parsed);
    if (!withPrompt) return false;

    await onImportComplete(fileName, withPrompt);
    // loadPage + parent sync chạy qua useEffect [sessionId] sau khi parent cập nhật phiên mới
    onAddLog(t("Đã import {{count}} luồng từ file", { count: withPrompt.length }), "success");
    toast.success(t("Đã import {{count}} sản phẩm", { count: withPrompt.length }));
    return true;
  };

  /** Import gộp — thêm vào danh sách đang hiển thị, giữ phiên hiện tại. */
  const handleMergeImportParsed = async (fileName: string, parsed: AffiliatePlusItem[]) => {
    const withPrompt = await prepareImportItems(parsed);
    if (!withPrompt) return false;

    const existing = await getSessionItems(sessionId);
    const merged = [...existing, ...withPrompt];
    await replaceSessionThreads(sessionId, merged);
    await loadPage();
    scheduleParentSync();
    onAddLog(
      t("Đã gộp thêm {{count}} luồng từ {{file}} (tổng {{total}})", {
        count: withPrompt.length,
        file: fileName,
        total: merged.length,
      }),
      "success"
    );
    toast.success(
      t("Đã gộp thêm {{count}} sản phẩm (tổng {{total}})", {
        count: withPrompt.length,
        total: merged.length,
      })
    );
    return true;
  };

  const handleImport = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseAffiliatePlusExcel(buffer);
      await handleImportParsed(file.name, parsed);
    } catch (err) {
      console.error("Import affiliate file failed:", err);
      toast.error(t("Không thể đọc file. Thử lại với file .csv hoặc .xlsx từ Shopee Affiliate."));
    }
  };

  const openScrapeImportDialog = async () => {
    setScrapeImportOpen(true);
    setScrapeLoading(true);
    try {
      setScrapeSessions(await listScrapeCsvSessions());
    } catch (err) {
      console.error("Load scrape CSV sessions failed:", err);
      toast.error(t("Không tải được danh sách CSV từ IndexedDB"));
      setScrapeSessions([]);
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleImportScrapeSession = async (
    session: ScrapeCsvSession,
    action: "replace" | "merge" = "replace"
  ) => {
    if (importingSessionId) return;
    setImportingSessionId(session.id);
    setImportingAction(action);
    try {
      const parsed = parseAffiliatePlusCSV(session.csv || "");
      const display = sessionDisplayName(session);
      const fileName =
        display && display !== "—"
          ? `scrape-${display.replace(/[^\w\u00C0-\u024F\s-]+/gi, "_").trim()}-${session.id}.csv`
          : `scrape-${session.id}.csv`;
      const ok =
        action === "merge"
          ? await handleMergeImportParsed(fileName, parsed)
          : await handleImportParsed(fileName, parsed);
      // Replace: đóng dialog. Merge: giữ mở để gộp thêm phiên khác.
      if (ok && action === "replace") setScrapeImportOpen(false);
    } catch (err) {
      console.error("Import scrape session failed:", err);
      toast.error(t("Không import được phiên CSV này"));
    } finally {
      setImportingSessionId(null);
      setImportingAction(null);
    }
  };

  const domainLabel = (host: string) => {
    if (!host) return "—";
    const m = host.match(/^affiliate\.shopee\.(.+)$/i);
    if (!m) return host;
    const code = m[1].split(".").pop()?.toUpperCase() || "";
    return code ? `${code} — ${host}` : host;
  };

  const handleRetryErrors = async () => {
    const all = await getSessionItems(sessionId);
    const errorItems = getErrorItems(all);
    if (!errorItems.length) {
      toast.warn(t("Không có luồng lỗi"));
      return;
    }
    const ids = errorItems.map((i) => i.id);
    for (const id of ids) {
      await patchThread(sessionId, id, {
        status: "waiting" as ThreadStatus,
        error: "",
        countdown: 0,
      });
    }
    await loadPage();
    scheduleParentSync();
    onAddLog(t("Retry {{count}} luồng lỗi", { count: ids.length }), "warning");
    void handleStart(ids);
  };

  const handleDeleteSelectedHistory = async (opts?: { skipConfirm?: boolean }) => {
    const id = selectedHistoryId;
    if (!id || clearingIdb || batchRunning) return;
    if (!opts?.skipConfirm) {
      const entry = importHistory.find((h) => h.id === id);
      const label = entry?.label || id;
      const ok = window.confirm(
        t(
          "Xóa phiên \"{{label}}\"?\n\n• Lịch sử + luồng của phiên này\n• Video variant + video nối trong IndexedDB (nếu không còn phiên khác dùng)\n\nCấu hình Generate Video vẫn giữ.",
          { label }
        ) as string
      );
      if (!ok) return;
    }

    setClearingIdb(true);
    try {
      if (id === sessionId) {
        pauseAllRef.current = true;
        runnerRef.current?.pause();
        await cancelServerJobs();
        setVideoPreview(null);
        autoMergeAttemptedRef.current = {};
        setMergingIds({});
        setGeneratingIds({});
      }
      await onDeleteHistorySession(id);
      if (id === sessionId) {
        setVisibleItems([]);
        setListTotal(0);
        setListTotalMatched(0);
        setListMeta(null);
        setSelectedCount(0);
        setHasMergedVideos(false);
        await loadPage();
      }
      onAddLog(t("Đã xóa phiên lịch sử + video cache"), "warning");
      toast.success(t("Đã xóa phiên và giải phóng video cache"));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t("Xóa phiên thất bại"));
    } finally {
      pauseAllRef.current = false;
      setClearingIdb(false);
    }
  };

  const handleClearGenerateVideoIdb = async (opts?: { skipConfirm?: boolean }) => {
    if (clearingIdb || batchRunning) return;
    if (!opts?.skipConfirm) {
      const ok = window.confirm(
        t(
          "Xóa toàn bộ dữ liệu Generate Video trong IndexedDB?\n\n• Lịch sử phiên / luồng\n• Video variant + video nối đã lưu\n→ Giải phóng bộ nhớ trình duyệt.\n\nCấu hình Generate Video (prompt) vẫn giữ."
        ) as string
      );
      if (!ok) return;
    }

    setClearingIdb(true);
    try {
      pauseAllRef.current = true;
      runnerRef.current?.pause();
      await cancelServerJobs();
      setVideoPreview(null);
      await onClearHistory();
      autoMergeAttemptedRef.current = {};
      setMergingIds({});
      setGeneratingIds({});
      setVisibleItems([]);
      setListTotal(0);
      setListTotalMatched(0);
      setListMeta(null);
      setSelectedCount(0);
      setHasMergedVideos(false);
      await loadPage();
      onAddLog(t("Đã xóa IndexedDB Generate Video (kèm video cache)"), "warning");
      toast.success(t("Đã xóa cache video / IndexedDB — đã giải phóng bộ nhớ"));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t("Xóa IndexedDB thất bại"));
    } finally {
      pauseAllRef.current = false;
      setClearingIdb(false);
    }
  };

  const handleDownloadAllMerged = async () => {
    if (downloadingMerged) return;
    const candidates = (await getSessionItems(sessionId)).filter(
      (i) => Boolean(i.mergedVideoUrl) || Boolean(i.productId) || Boolean(i.productLink)
    );
    if (!candidates.length) {
      toast.warn(t("Chưa có video đã nối để tải"));
      return;
    }

    setDownloadingMerged(true);
    try {
      const files: { fileName: string; blob: Blob }[] = [];
      const usedNames = new Set<string>();

      for (const item of candidates) {
        const blob = await getMergedVideoBlob(item, sessionId);
        if (!blob) continue;

        // itemId.mp4 (vd. 42874449161.mp4 từ /product/{shopId}/{itemId})
        const base =
          buildMergedVideoFileBase(item) ||
          getMergedVideoStorageKey(item, sessionId) ||
          "merged-video";
        let fileName = `${base}.mp4`;
        let n = 2;
        while (usedNames.has(fileName.toLowerCase())) {
          fileName = `${base}-${n}.mp4`;
          n += 1;
        }
        usedNames.add(fileName.toLowerCase());
        files.push({ fileName, blob });
      }

      if (!files.length) {
        toast.warn(t("Chưa có video đã nối để tải"));
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      await zipAndDownload(files, `video-da-noi-${stamp}.zip`);
      onAddLog(t("Đã tải {{count}} video đã nối (ZIP)", { count: files.length }), "success");
      toast.success(t("Đã tải {{count}} video đã nối", { count: files.length }));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t("Tải video thất bại"));
    } finally {
      setDownloadingMerged(false);
    }
  };

  const handleStart = async (ids?: string[]) => {
    if (batchRunningRef.current) {
      toast.warn(t("Batch đang chạy — đợi hoàn tất hoặc bấm Tạm dừng"));
      return;
    }

    const allItems = await getSessionItems(sessionId);
    const candidates = ids?.length
      ? allItems.filter((i) => ids.includes(i.id))
      : allItems.filter((i) => i.selected);
    if (!candidates.length) {
      toast.warn(t("Chưa bật switch luồng nào để chạy"));
      return;
    }

    // Bỏ qua luồng đã có video (variant / video nối / IndexedDB) — không generate lại
    const presence = await Promise.all(
      candidates.map(async (item) => {
        const hasVideo = await hasExistingGeneratedVideo(item, sessionId);
        return { item, hasVideo };
      })
    );
    const skippedDone = presence.filter((p) => p.hasVideo).map((p) => p.item);
    const targets = presence.filter((p) => !p.hasVideo).map((p) => p.item);

    if (skippedDone.length) {
      // Gỡ status "running" bị kẹt — tránh spinner nút Chạy dù đã có video
      await Promise.all(
        skippedDone
          .filter((i) => i.status === "running" || i.status === "uploading")
          .map((i) =>
            patchThread(sessionId, i.id, {
              status: "success" as ThreadStatus,
              countdown: 0,
              error: "",
            })
          )
      );
      setGeneratingIds((prev) => {
        const next = { ...prev };
        for (const i of skippedDone) delete next[i.id];
        return next;
      });
      setMergingIds((prev) => {
        const next = { ...prev };
        for (const i of skippedDone) delete next[i.id];
        return next;
      });
      onAddLog(
        t("Bỏ qua {{count}} luồng đã có video", { count: skippedDone.length }),
        "info"
      );
      void loadPage();
    }

    if (!targets.length) {
      toast.warn(
        skippedDone.length
          ? t("Tất cả luồng đã có video — không cần generate lại")
          : t("Chưa bật switch luồng nào để chạy")
      );
      return;
    }

    let config = genConfig;
    if (!config) {
      try {
        config = await loadGenerateVideoConfig();
        setGenConfig(config);
        setCharacterPreview(getCharacterPreview(config));
      } catch (err) {
        console.error(err);
        toast.error(t("Không tải được cấu hình generate video"));
        return;
      }
    }

    const preview = getCharacterPreview(config);
    if (!preview.url) {
      toast.warn(t("Chưa có ảnh nhân vật trong config. Vào Quản lý Nhân Vật để thêm ảnh."));
      return;
    }

    const missingProduct = targets.filter((i) => !i.imageUrl?.trim());
    if (missingProduct.length) {
      toast.warn(t("{{count}} luồng thiếu ảnh sản phẩm", { count: missingProduct.length }));
      return;
    }

    const prompt = buildActivePromptFromConfig(config).trim() || config.activePrompt?.trim() || "";
    if (!prompt) {
      toast.warn(t("Chưa có prompt trong cấu hình Generate Video"));
      return;
    }

    pauseAllRef.current = false;
    runnerRef.current?.stop();
    // Concurrency = số luồng video của customer (googlePackage), không dùng threadCount trong config
    const concurrency = Math.max(1, Math.min(50, Math.round(VIDEO_CONCURRENCY || 1)));
    onAddLog(
      t("Bắt đầu {{count}} luồng (song song {{n}})", {
        count: targets.length,
        n: concurrency,
      }),
      "info"
    );
    toast.success(t("Đã bắt đầu {{count}} luồng", { count: targets.length }));

    let characterPreparedFixed: Awaited<ReturnType<typeof prepareShopeeImageInput>> | null = null;
    try {
      characterPreparedFixed = await prepareShopeeImageInput(preview.url);
    } catch (err: any) {
      toast.error(t("Không xử lý được ảnh nhân vật: {{msg}}", { msg: err?.message || "" }));
      return;
    }

    const runJob = async (
      target: AffiliatePlusItem,
      ctx: { isPaused: () => boolean }
    ): Promise<"success" | "error" | "cancelled"> => {
      if (ctx.isPaused() || pauseAllRef.current) return "cancelled";

      setGeneratingIds((prev) => ({ ...prev, [target.id]: true }));
      await patchThread(sessionId, target.id, {
        status: "running" as ThreadStatus,
        error: "",
        countdown: 99999,
      });

      try {
        if (ctx.isPaused() || pauseAllRef.current) return "cancelled";

        const fresh = (await getThreadItem(sessionId, target.id)) || target;
        const characterPrepared = characterPreparedFixed;
        if (!characterPrepared) throw new Error(t("Chưa có ảnh nhân vật"));

        const productPrepared = await prepareShopeeImageInput(fresh.imageUrl);
        const images = [characterPrepared, productPrepared];

        // Retry khi 429 (hết slot luồng server) — đợi slot trống thay vì đánh error cả queue.
        let result: Awaited<ReturnType<typeof shopeeVideoJob.run>>;
        for (let attempt = 0; ; attempt++) {
          if (ctx.isPaused() || pauseAllRef.current) return "cancelled";
          try {
            result = await shopeeVideoJob.run({
              url: "/api/app/generation-shopee-video/",
              body: {
                prompt: fresh.prompt?.trim() || prompt,
                images,
                characterImage: characterPrepared,
                productImage: productPrepared,
                videosPerJob: config!.videosPerJob,
                variantCount: config!.videosPerJob,
                videoModel: config!.videoModel,
                config: {
                  prompt: fresh.prompt?.trim() || prompt,
                  aspectRatio: "9:16",
                  videosPerJob: config!.videosPerJob,
                  variantCount: config!.videosPerJob,
                  videoModel: config!.videoModel,
                  videoMode: "component",
                },
                _metadata: {
                  threadId: fresh.id,
                  shopName: fresh.shopName,
                  productName: fresh.productName,
                },
              },
              cancelOnUnmount: true,
              onJobEnqueued: (jobId) => {
                activeJobIdsRef.current[fresh.id] = jobId;
              },
              onProgress: (_pct, msg) => {
                if (msg) onAddLog(`${fresh.productName || fresh.id}: ${msg}`, "info", fresh.id);
              },
            });
            break;
          } catch (enqueueErr: any) {
            const isStreamLimit =
              enqueueErr instanceof MediaGenerationJobError &&
              enqueueErr.code === "ENQUEUE_FAILED" &&
              (enqueueErr.httpStatus === 429 ||
                /giới hạn luồng/i.test(String(enqueueErr.message || "")));
            if (!isStreamLimit || attempt >= 90) throw enqueueErr;
            onAddLog(
              t("Chờ slot luồng ({{n}}/90)...", { n: attempt + 1 }),
              "warning",
              fresh.id
            );
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        if (ctx.isPaused() || pauseAllRef.current) return "cancelled";

        const fromUris = ((result.data.videoUris?.length ? result.data.videoUris : []) as string[])
          .map((u) => String(u || "").trim())
          .filter(Boolean);
        const singleUri = String(result.data.videoUri || "").trim();
        const rawUris = Array.from(
          new Set(fromUris.length ? fromUris : singleUri ? [singleUri] : [])
        );
        const slotCount = Math.max(config!.videosPerJob || 1, rawUris.length, 1);
        const { videoUrls, videoDisabled } = padVideoSlots(rawUris, slotCount);
        const filledCount = videoUrls.filter(Boolean).length;

        await patchThread(sessionId, fresh.id, {
          status: "success" as ThreadStatus,
          videoUrls,
          videoDisabled,
          uploaded: filledCount,
          pending: Math.max(slotCount - filledCount, 0),
          error: "",
          countdown: 0,
        });

        setGeneratingIds((prev) => {
          const next = { ...prev };
          delete next[fresh.id];
          return next;
        });

        try {
          await persistProductVideosWithEnrichment(getMergedVideoStorageKey(fresh, sessionId), videoUrls);
        } catch (persistErr) {
          console.warn("[persistProductVideosWithEnrichment]", persistErr);
        }

        // Nối video chạy nền — KHÔNG giữ slot concurrency của ThreadRunner.
        // (Trước đây await merge → UI đã success nhưng pool không lấy job mới.)
        const mergeUrls = videoUrls
          .map((u, idx) => ({ u, disabled: videoDisabled[idx] }))
          .filter((x) => x.u && !x.disabled)
          .map((x) => x.u);
        const willMerge = mergeUrls.length >= 2 && !ctx.isPaused() && !pauseAllRef.current;
        if (willMerge) {
          scheduleBackgroundMerge(fresh.id, getMergedVideoStorageKey(fresh, sessionId), mergeUrls);
        }

        if (!ctx.isPaused() && !pauseAllRef.current) {
          onAddLog(
            t("Hoàn tất video cho {{name}} ({{count}} file{{merged}})", {
              name: fresh.productName || fresh.shopName || fresh.id,
              count: filledCount || 1,
              merged: willMerge ? `, ${t("đang nối")}` : "",
            }),
            "success",
            fresh.id
          );
        }
        scheduleParentSync();
        return "success";
      } catch (err: any) {
        const isCancelled =
          ctx.isPaused() ||
          pauseAllRef.current ||
          (err instanceof MediaGenerationJobError &&
            (err.code === "JOB_CANCELLED" || err.code === "JOB_NOT_FOUND"));
        if (isCancelled) {
          try {
            await patchThread(sessionId, target.id, {
              status: "stopped" as ThreadStatus,
              countdown: 0,
              error: "",
            });
          } catch {
            // ignore
          }
          return "cancelled";
        }
        console.error(err);
        await patchThread(sessionId, target.id, {
          status: "error" as ThreadStatus,
          error: err?.message || t("Generate video thất bại"),
          countdown: 0,
        });
        onAddLog(
          t("Lỗi generate video: {{msg}}", {
            msg: err?.message || "unknown",
          }),
          "error",
          target.id
        );
        scheduleParentSync();
        return "error";
      } finally {
        delete activeJobIdsRef.current[target.id];
        setGeneratingIds((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
    };

    const runner = new ThreadRunner({
      sessionId,
      concurrency,
      autoPatchStatus: false,
      runJob,
      onEvent: (ev) => {
        if (ev.type === "finished") {
          scheduleParentSync();
          const total = ev.success + ev.error + ev.cancelled;
          onAddLog(
            t("Batch xong: {{ok}}/{{total}} thành công, {{err}} lỗi{{cancel}}", {
              ok: ev.success,
              total,
              err: ev.error,
              cancel: ev.cancelled ? `, ${ev.cancelled} huỷ` : "",
            }),
            ev.error ? "warning" : "success"
          );
        }
      },
    });
    runnerRef.current = runner;
    batchRunningRef.current = true;
    setBatchRunning(true);
    try {
      await runner.run(targets);
    } finally {
      batchRunningRef.current = false;
      setBatchRunning(false);
      runnerRef.current = null;
    }
    await loadPage();
  };

  const handlePause = async (ids?: string[]) => {
    pauseAllRef.current = true;
    runnerRef.current?.pause();
    // Tạm dừng = huỷ job trên server (giống generate image/video tool).
    // pauseAllRef luôn dừng cả batch → cancel hết job đang chạy.
    await cancelServerJobs();

    if (!ids?.length) {
      setGeneratingIds({});
      setMergingIds({});
      const running = await getSessionItems(sessionId);
      for (const i of running) {
        if (i.status === "running" || i.status === "uploading") {
          await patchThread(sessionId, i.id, {
            status: "stopped" as ThreadStatus,
            countdown: 0,
          });
        }
      }
      await loadPage();
      scheduleParentSync();
      onAddLog(t("Tạm dừng tất cả luồng"), "warning");
      toast.success(t("Đã tạm dừng tất cả"));
      return;
    }

    const pausedIds = new Set(ids);
    setGeneratingIds((prev) => {
      const next = { ...prev };
      pausedIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setMergingIds((prev) => {
      const next = { ...prev };
      pausedIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    for (const id of ids) {
      const item = await getThreadItem(sessionId, id);
      if (item && (item.status === "running" || item.status === "uploading")) {
        await patchThread(sessionId, id, { status: "stopped" as ThreadStatus, countdown: 0 });
      }
    }
    await loadPage();
    scheduleParentSync();
    onAddLog(t("Tạm dừng luồng"), "warning");
    toast.success(t("Đã tạm dừng"));
  };

  /** Xóa hẳn các luồng đang tick (checkbox). */
  const handleDeleteSelected = async () => {
    const all = await getSessionItems(sessionId);
    const selected = all.filter((i) => i.selected);
    if (!selected.length) {
      toast.warn(t("Chọn ít nhất một task để xóa"));
      return;
    }
    if (!confirm(t("Xóa {{count}} task đã chọn?", { count: selected.length }))) return;
    await cancelServerJobs(selected.map((i) => i.id));
    selected.forEach((i) => {
      if (i.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(i.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
      void removeMergedVideoFromIndexedDb(i, sessionId);
    });
    await removeThreads(
      sessionId,
      selected.map((i) => i.id)
    );
    await loadPage();
    scheduleParentSync();
    onAddLog(t("Đã xóa {{count}} tasks", { count: selected.length }), "warning");
  };

  /** Chỉ bỏ tick — không xóa luồng. */
  const clearSelection = () => {
    if (!selectedCount) {
      toast.warn(t("Chưa có mục nào được chọn"));
      return;
    }
    const n = selectedCount;
    updateAll((item) => (item.selected ? { ...item, selected: false } : item));
    toast.info(t("Đã bỏ chọn {{count}} mục", { count: n }));
  };

  const handleDelete = async (id: string) => {
    await cancelServerJobs([id]);
    const target = (await getThreadItem(sessionId, id)) || items.find((i) => i.id === id);
    if (target?.mergedVideoUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(target.mergedVideoUrl);
      } catch {
        // ignore
      }
    }
    if (target) void removeMergedVideoFromIndexedDb(target, sessionId);
    else void removeMergedVideoFromIndexedDb(id);
    await removeThread(sessionId, id);
    await loadPage();
    scheduleParentSync();
    onAddLog(t("Xóa luồng"), "warning", id);
  };

  const handleRetryMerge = async (item: AffiliatePlusItem) => {
    const urls = getMergeableVideoUrls(item);
    if (urls.length < 2) {
      toast.warn(t("Cần ít nhất 2 video (không bị tắt) để nối"));
      return;
    }
    if (mergingIds[item.id]) return;

    setMergingIds((prev) => ({ ...prev, [item.id]: true }));
    await patchThread(sessionId, item.id, { error: "" });
    try {
      // Revoke blob cũ nếu có
      if (item.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
      const mergedUrl = await mergeVideosToIndexedDb(getMergedVideoStorageKey(item, sessionId), urls);
      await patchThread(sessionId, item.id, { mergedVideoUrl: mergedUrl, error: "" });
      scheduleParentSync();
      autoMergeAttemptedRef.current[item.id] = true;
      onAddLog(t("Đã nối video và lưu IndexedDB"), "success", item.id);
      toast.success(t("Đã nối lại video"));

      // Cập nhật dialog nếu đang mở preview merged của item này
      try {
        const previewUrl = await resolveMergedPreviewUrl({
          ...item,
          mergedVideoUrl: mergedUrl,
        }, sessionId);
        setVideoPreview((prev) =>
          prev?.kind === "merged" && prev.itemId === item.id
            ? {
                ...prev,
                urls: previewUrl ? [previewUrl] : [],
                index: 0,
                error: previewUrl ? undefined : t("Không mở được video — thử Nối lại"),
              }
            : prev
        );
      } catch {
        setVideoPreview((prev) =>
          prev?.kind === "merged" && prev.itemId === item.id
            ? { ...prev, urls: [], index: 0, error: t("Không mở được video — thử Nối lại") }
            : prev
        );
      }
    } catch (err: any) {
      const msg = err?.message || t("Nối video thất bại");
      await patchThread(sessionId, item.id, { error: msg });
      scheduleParentSync();
      onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", item.id);
      toast.error(msg);
      setVideoPreview((prev) =>
        prev?.kind === "merged" && prev.itemId === item.id
          ? { ...prev, urls: [], error: msg }
          : prev
      );
    } finally {
      setMergingIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  /** Tạo lại 1 slot variant (gắn vào đúng tab; URL → IDB → base64 ngầm). */
  const regenerateVariantSlot = async (itemId: string, slotIndex: number) => {
    const target =
      (await getThreadItem(sessionId, itemId)) || itemsRef.current.find((i) => i.id === itemId);
    if (!target) return;

    setVideoPreview((prev) =>
      prev?.kind === "variants" && prev.itemId === itemId
        ? { ...prev, regenerating: { ...prev.regenerating, [slotIndex]: true }, index: slotIndex }
        : prev
    );

    try {
      const config = genConfig || (await loadGenerateVideoConfig());
      const character =
        config.characters.find((c) => c.id === config.characterId) || config.characters[0];
      const characterImage = character ? pickCharacterImage(character).url : "";
      if (!characterImage) {
        toast.error(t("Chưa có ảnh nhân vật trong cấu hình"));
        return;
      }

      const characterPrepared = await prepareShopeeImageInput(characterImage);
      const productPrepared = await prepareShopeeImageInput(target.imageUrl);
      const prompt = target.prompt?.trim() || buildActivePromptFromConfig(config);

      const result = await shopeeVideoJob.run({
        url: "/api/app/generation-shopee-video/",
        body: {
          prompt,
          images: [characterPrepared, productPrepared],
          characterImage: characterPrepared,
          productImage: productPrepared,
          videosPerJob: 1,
          variantCount: 1,
          videoModel: config.videoModel,
          config: {
            prompt,
            aspectRatio: "9:16",
            videosPerJob: 1,
            variantCount: 1,
            videoModel: config.videoModel,
            videoMode: "component",
          },
          _metadata: {
            threadId: target.id,
            shopName: target.shopName,
            productName: target.productName,
            slotIndex,
          },
        },
        cancelOnUnmount: true,
        onJobEnqueued: (jobId) => {
          activeJobIdsRef.current[itemId] = jobId;
        },
      });

      const fromUris = ((result.data.videoUris?.length ? result.data.videoUris : []) as string[])
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      const singleUri = String(result.data.videoUri || "").trim();
      const newUri = fromUris[0] || singleUri;
      if (!newUri) throw new Error(t("Không nhận được video"));

      const slotCount = Math.max(
        target.videoUrls?.length || 0,
        config.videosPerJob || 1,
        slotIndex + 1
      );
      const nextUrls = Array.from({ length: slotCount }, (_, i) =>
        i === slotIndex ? newUri : String(target.videoUrls?.[i] || "").trim()
      );
      const nextDisabled = Array.from({ length: slotCount }, (_, i) =>
        Boolean(target.videoDisabled?.[i])
      );
      const filledCount = nextUrls.filter(Boolean).length;

      await patchThread(sessionId, itemId, {
        videoUrls: nextUrls,
        videoDisabled: nextDisabled,
        uploaded: filledCount,
        pending: Math.max(slotCount - filledCount, 0),
        status: "success" as ThreadStatus,
        error: "",
        mergedVideoUrl: "",
      });
      scheduleParentSync();
      autoMergeAttemptedRef.current[itemId] = false;

      await persistProductVideosWithEnrichment(getMergedVideoStorageKey(target, sessionId), nextUrls);

      const previewSlots = await resolveVariantPreviewUrls(
        { ...target, videoUrls: nextUrls },
        slotCount,
        sessionId
      );

      setVideoPreview((prev) =>
        prev?.kind === "variants" && prev.itemId === itemId
          ? {
              ...prev,
              slots: Array.from({ length: slotCount }, (_, i) => previewSlots[i] || ""),
              disabled: nextDisabled,
            }
          : prev
      );

      onAddLog(t("Đã tạo lại video {{n}}", { n: slotIndex + 1 }), "success", itemId);
      toast.success(t("Đã tạo lại Video {{n}}", { n: slotIndex + 1 }));
    } catch (err: any) {
      const isCancelled =
        pauseAllRef.current ||
        (err instanceof MediaGenerationJobError &&
          (err.code === "JOB_CANCELLED" || err.code === "JOB_NOT_FOUND"));
      if (!isCancelled) {
        console.error(err);
        toast.error(err?.message || t("Tạo lại video thất bại"));
        onAddLog(
          t("Tạo lại video {{n}} thất bại: {{msg}}", {
            n: slotIndex + 1,
            msg: err?.message || "unknown",
          }),
          "error",
          itemId
        );
      }
    } finally {
      delete activeJobIdsRef.current[itemId];
      setVideoPreview((prev) => {
        if (prev?.kind !== "variants" || prev.itemId !== itemId) return prev;
        const regenerating = { ...prev.regenerating };
        delete regenerating[slotIndex];
        return { ...prev, regenerating };
      });
    }
  };

  const regenerateAllFailedSlots = async (itemId: string) => {
    const preview = videoPreview;
    if (preview?.kind !== "variants" || preview.itemId !== itemId) return;
    const failedIndexes = preview.slots
      .map((s, idx) => (!String(s || "").trim() ? idx : -1))
      .filter((idx) => idx >= 0);
    if (!failedIndexes.length) {
      toast.warn(t("Không có tab lỗi"));
      return;
    }
    for (const idx of failedIndexes) {
      await regenerateVariantSlot(itemId, idx);
    }
  };

  const toggleVariantDisabled = async (itemId: string, slotIndex: number) => {
    const target =
      (await getThreadItem(sessionId, itemId)) || itemsRef.current.find((i) => i.id === itemId);
    if (!target) return;
    const slotCount = Math.max(target.videoUrls?.length || 0, slotIndex + 1, 1);
    const nextDisabled = Array.from({ length: slotCount }, (_, i) =>
      i === slotIndex ? !Boolean(target.videoDisabled?.[i]) : Boolean(target.videoDisabled?.[i])
    );
    await patchThread(sessionId, itemId, {
      videoDisabled: nextDisabled,
      mergedVideoUrl: "",
    });
    scheduleParentSync();
    autoMergeAttemptedRef.current[itemId] = false;
    setVideoPreview((prev) =>
      prev?.kind === "variants" && prev.itemId === itemId
        ? { ...prev, disabled: nextDisabled }
        : prev
    );
  };

  const openEdit = (item: AffiliatePlusItem, field: EditField) => {
    if (!field) return;
    setEditItemId(item.id);
    setEditField(field);
    setEditValue(item[field] || "");
  };

  const saveEdit = () => {
    if (!editItemId || !editField) return;
    updateItem(editItemId, { [editField]: editValue } as Partial<AffiliatePlusItem>);
    setEditItemId(null);
    setEditField(null);
    toast.success(t("Đã cập nhật"));
  };

  const toggleSelectAll = (checked: boolean) => {
    applyToVisible((i) => ({ ...i, selected: checked }));
  };

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => i.selected);

  const normalizedTerm = useMemo(() => normalizeSearch(searchTerm), [searchTerm]);

  const handleSaveGenerateConfig = (config: GenerateVideoConfig, promptForAll: string) => {
    setGenConfig(config);
    setCharacterPreview(getCharacterPreview(config));
    void (async () => {
      const all = await getSessionItems(sessionId);
      const next = all.map((i) => ({ ...i, prompt: promptForAll }));
      await replaceSessionThreads(sessionId, next);
      await loadPage();
      scheduleParentSync();
      onAddLog(
        t("Đã áp dụng prompt generate video cho {{count}} luồng", { count: next.length }),
        "success"
      );
    })();
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
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
            value: stats.uploading,
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
            key={s.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-sm font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <SceneHistoryDropdown
          items={importHistory}
          selectedId={selectedHistoryId}
          onSelect={(id) => void onSelectHistory(id)}
          onDeleteSelected={() => void handleDeleteSelectedHistory({ skipConfirm: true })}
          onClear={() => void handleClearGenerateVideoIdb({ skipConfirm: true })}
          formatOptionLabel={formatImportHistoryOption}
          deleteSelectedTitle={t("Xóa phiên đang chọn + video IndexedDB") as string}
          deleteSelectedConfirmLabel={t("Xóa phiên") as string}
          clearTitle={t("Xóa tất cả lịch sử + video IndexedDB (giải phóng bộ nhớ)") as string}
          clearConfirmLabel={t("Xóa hết") as string}
          className="px-2 py-2 mb-3 rounded-lg"
        />
        <div className="flex flex-col gap-3 justify-between lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = "";
              }}
            />
            <button
              ref={importMenuRef}
              type="button"
              onClick={() => setImportMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <RiDatabase2Line className="text-base" />
              {t("Nhập dữ liệu")}
              <RiArrowDownSLine className="text-sm opacity-80" />
            </button>
            <Popover
              reference={importMenuRef}
              trigger="click"
              placement="bottom-start"
              arrow={false}
              maxWidth={280}
              visible={importMenuOpen}
              hideOnClickOutside
              zIndex={10050}
              onHidden={() => setImportMenuOpen(false)}
              onClickOutside={() => setImportMenuOpen(false)}
            >
              <div className="py-1 min-w-[240px]">
                {[
                  {
                    label: t("Nhập từ Data"),
                    hint: t("Chọn phiên cào đã lưu để tạo luồng"),
                    icon: <RiDatabase2Line className="text-base text-blue-600" />,
                    action: () => {
                      setImportMenuOpen(false);
                      void openScrapeImportDialog();
                    },
                  },
                  {
                    label: t("Nhập thủ công"),
                    hint: t("Upload file CSV / Excel"),
                    icon: <RiFileExcel2Line className="text-base text-blue-600" />,
                    action: () => {
                      setImportMenuOpen(false);
                      fileInputRef.current?.click();
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex gap-2.5 items-start px-3 py-2 w-full text-left transition-colors hover:bg-gray-50"
                    onClick={item.action}
                  >
                    <span className="mt-0.5 shrink-0">{item.icon}</span>
                    <span>
                      <span className="block text-xs font-medium text-gray-800">{item.label}</span>
                      <span className="block mt-0.5 text-[11px] text-gray-400">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Popover>
            <button
              type="button"
              onClick={() => setGenerateConfigOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <HiCog className="text-base" />
              {t("Cấu hình Generate Video")}
            </button>
            <button
              type="button"
              onClick={handleRetryErrors}
              disabled={stats.error === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                stats.error === 0
                  ? undefined
                  : { backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }
              }
            >
              <HiRefresh className="text-base" />
              {t("Retry Lỗi")}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={selectedCount === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                selectedCount === 0
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
              onClick={() => void handleDownloadAllMerged()}
              disabled={downloadingMerged || !hasMergedVideos}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                downloadingMerged || !hasMergedVideos
                  ? undefined
                  : { backgroundColor: "#ecfdf5", borderColor: "#34d399", color: "#059669" }
              }
            >
              {downloadingMerged ? (
                <RiLoader4Line className="text-base animate-spin" />
              ) : (
                <HiDownload className="text-base" />
              )}
              {downloadingMerged ? t("Đang tải...") : t("Tải tất cả video nối")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
              style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" }}
            >
              <HiClock className="text-sm" />
              {t("Chạy lại lúc")} {settings.scheduleTime} SA
            </span>
            <button
              type="button"
              onClick={() => {
                onAddLog(t("Check 24h hoàn tất"), "info");
                toast.success(t("Đã kiểm tra 24h"));
              }}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#e0f2fe", borderColor: "#38bdf8", color: "#0284c7" }}
            >
              <HiCheck className="text-base" />
              Check 24h
            </button>
            <button
              type="button"
              onClick={() => handleStart()}
              disabled={selectedCount === 0 || batchRunning}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                selectedCount === 0 || batchRunning
                  ? undefined
                  : { backgroundColor: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
              }
            >
              <HiPlay className="text-base" />
              {batchRunning ? t("Đang chạy...") : t("Bắt Đầu")}
            </button>
            <button
              type="button"
              onClick={() => handlePause()}
              disabled={
                Object.keys(generatingIds).length === 0 &&
                Object.keys(mergingIds).length === 0 &&
                stats.uploading === 0
              }
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                Object.keys(generatingIds).length === 0 &&
                Object.keys(mergingIds).length === 0 &&
                stats.uploading === 0
                  ? undefined
                  : { backgroundColor: "#ffedd5", borderColor: "#fb923c", color: "#c2410c" }
              }
            >
              <HiOutlinePause className="text-base" />
              {t("Tạm Dừng")}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedCount === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={
                selectedCount === 0
                  ? undefined
                  : { backgroundColor: "#f1f5f9", borderColor: "#94a3b8", color: "#475569" }
              }
              title={t("Bỏ tick các mục đã chọn — không xóa task") as string}
            >
              <HiBan className="text-base" />
              {t("Xóa Chọn")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <PanelListCard>
        {listTotal === 0 ? (
          <div className={panelListClasses.empty}>
            {t('Chưa có luồng. Nhấn "Nhập Excel & Tạo Luồng" để bắt đầu.')}
          </div>
        ) : (
          <>
            <PanelListToolbar
              trailing={
                <>
                  <PanelListMatchCount
                    term={normalizedTerm}
                    matched={listTotalMatched}
                    total={listTotal}
                  />
                  {listLoading ? (
                    <RiLoader4Line className="text-sm text-gray-400 animate-spin" />
                  ) : null}
                </>
              }
            >
              <PanelListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("Tìm tên shop / tên sản phẩm...") as string}
              />
            </PanelListToolbar>

            <div className="overflow-x-auto">
              <table className={panelListClasses.table}>
                <thead>
                  <tr className={panelListClasses.theadTr}>
                    <th className={`${panelListClasses.th} w-12`}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className={panelListClasses.checkbox}
                      />
                    </th>
                    <th className={`${panelListClasses.th} w-10 text-left`}>#</th>
                    <th
                      className={`${panelListClasses.th} text-left`}
                      style={{ maxWidth: 300, width: 300 }}
                    >
                      {t("Shop / Sản phẩm")}
                    </th>
                    <th className={`${panelListClasses.th} w-28 text-center`}>{t("Ảnh sản phẩm")}</th>
                    <th className={`${panelListClasses.th} w-28 text-center`}>{t("Ảnh nhân vật")}</th>
                    <th className={`${panelListClasses.th} min-w-[140px] text-center`}>{t("Video")}</th>
                    <th className={`${panelListClasses.th} w-32 text-center`}>{t("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={panelListClasses.emptyMatch}>
                        {t("Không có luồng nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : null}
                  {visibleItems.map((item, localIdx) => {
                    const idx = pageStartIndex + localIdx;
                    return (
                      <tr
                        key={item.id}
                        className={panelListRowClass({
                          selected: item.selected,
                          error: Boolean(item.error),
                        })}
                      >
                        <td className={panelListClasses.td}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => updateItem(item.id, { selected: e.target.checked })}
                            className={panelListClasses.checkbox}
                          />
                        </td>
                        <td className={`${panelListClasses.td} font-mono text-xs text-gray-400`}>
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 300, width: 300 }}>
                          <div className="overflow-hidden space-y-1" style={{ maxWidth: 300 }}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="block flex-1 min-w-0 font-semibold text-gray-900 truncate"
                                title={item.shopName || undefined}
                              >
                                {item.shopName || "—"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEdit(item, "shopName")}
                                className="text-sky-500 shrink-0 hover:text-sky-700"
                              >
                                <HiPencil className="text-xs" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="block flex-1 min-w-0 text-gray-600 truncate"
                                title={item.productName || undefined}
                              >
                                {item.productName || "—"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEdit(item, "productName")}
                                className="text-sky-500 shrink-0 hover:text-sky-700"
                              >
                                <HiPencil className="text-xs" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-center">
                            {item.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => setZoomImage(item.imageUrl)}
                                title={t("Xem ảnh sản phẩm")}
                                className="rounded-lg border border-gray-200 transition-colors hover:border-sky-400"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName || t("Ảnh sản phẩm")}
                                  className="object-cover w-16 h-16 rounded-lg cursor-zoom-in"
                                />
                              </button>
                            ) : (
                              <div className="flex justify-center items-center w-16 h-16 text-gray-400 bg-gray-100 rounded-lg border border-gray-200">
                                <HiOutlinePhotograph className="text-xl" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(item, "imageUrl")}
                              className="text-sky-600 text-10 hover:underline"
                            >
                              {t("Sửa")}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-center">
                            {characterPreview.url ? (
                              <button
                                type="button"
                                onClick={() => setZoomImage(characterPreview.url)}
                                title={characterPreview.name || t("Ảnh nhân vật từ config")}
                                className="rounded-lg border border-gray-200 transition-colors hover:border-sky-400"
                              >
                                <img
                                  src={characterPreview.url}
                                  alt={characterPreview.name || t("Ảnh nhân vật")}
                                  className="object-cover w-16 h-16 rounded-lg cursor-zoom-in"
                                />
                              </button>
                            ) : (
                              <div
                                className="flex justify-center items-center w-16 h-16 text-gray-400 bg-gray-100 rounded-lg border border-gray-200"
                                title={t("Chưa có ảnh nhân vật trong config")}
                              >
                                <HiOutlinePhotograph className="text-xl" />
                              </div>
                            )}
                            {characterPreview.name ? (
                              <span
                                className="max-w-[88px] truncate text-10 text-gray-500"
                                title={characterPreview.name}
                              >
                                {characterPreview.name}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 items-center min-w-4xs">
                            <div className="flex gap-2 justify-center items-center">
                              {(() => {
                                const isGenerating = Boolean(generatingIds[item.id]);
                                const filledUrls = (item.videoUrls || []).filter((u) =>
                                  String(u || "").trim()
                                );
                                const slotCount = item.videoUrls?.length || 0;
                                const hasVideos = slotCount > 0;
                                const filled = filledUrls.length;
                                const configTotal = Math.max(
                                  1,
                                  Math.min(4, genConfig?.videosPerJob || slotCount || 1)
                                );

                                if (isGenerating) {
                                  return (
                                    <div
                                      className="flex relative justify-center items-center w-9 h-9 text-purple-600 bg-purple-50 rounded-full border border-purple-300 shadow-sm"
                                      title={t("Đang tạo video...")}
                                    >
                                      <RiLoader4Line className="text-xl animate-spin" />
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    disabled={!hasVideos}
                                    onClick={() => void openVariantPreview(item)}
                                    className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors disabled:opacity-100 ${
                                      hasVideos
                                        ? "text-white bg-purple-500 border-purple-500 cursor-pointer hover:border-purple-600 hover:bg-purple-600"
                                        : "text-gray-400 bg-gray-200 border-gray-300 cursor-default"
                                    }`}
                                    title={
                                      hasVideos
                                        ? t("{{filled}}/{{total}} video — xem", {
                                            filled,
                                            total: configTotal,
                                          })
                                        : t("Chưa có video")
                                    }
                                  >
                                    <FaPhotoVideo
                                      className={`text-lg ${
                                        hasVideos ? "text-white" : "text-gray-400"
                                      }`}
                                    />
                                    {hasVideos ? (
                                      <span
                                        className={`flex absolute -top-1 -left-1 justify-center items-center px-1 h-4 font-semibold text-white rounded-full min-w-4 text-10 whitespace-nowrap ${
                                          filled !== configTotal ? "bg-danger" : "bg-purple-700"
                                        }`}
                                      >
                                        {filled}/{configTotal}
                                      </span>
                                    ) : null}
                                    {hasVideos && filled >= configTotal ? (
                                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-success shadow-sm ring-1 ring-success">
                                        <HiCheck className="text-[11px] font-bold" />
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })()}
                              {(() => {
                                const hasMerged = hasMergedVideoRef(item.mergedVideoUrl);
                                const isMerging = Boolean(mergingIds[item.id]);
                                const canMerge = getMergeableVideoUrls(item).length >= 2;

                                if (isMerging) {
                                  return (
                                    <div
                                      className="flex relative justify-center items-center w-9 h-9 text-purple-600 bg-purple-50 rounded-full border border-purple-300 shadow-sm"
                                      title={t("Đang nối video...")}
                                    >
                                      <RiLoader4Line className="text-xl animate-spin" />
                                    </div>
                                  );
                                }

                                if (hasMerged) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => void openMergedPreview(item)}
                                      className="flex relative justify-center items-center w-9 h-9 text-white rounded-full border shadow-sm transition-colors bg-success border-success hover:bg-success hover:border-success"
                                      title={t("Video nối file")}
                                    >
                                      <RiVideoFill className="text-lg text-white" />
                                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-green-600 shadow-sm ring-1 ring-green-500">
                                        <HiCheck className="text-[11px] font-bold" />
                                      </span>
                                    </button>
                                  );
                                }

                                if (canMerge) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => void handleRetryMerge(item)}
                                      className="flex justify-center items-center w-9 h-9 text-amber-600 bg-amber-50 rounded-full border border-amber-400 shadow-sm transition-colors hover:bg-amber-100"
                                      title={
                                        item.error
                                          ? `${t("Nối lại")}: ${item.error}`
                                          : t("Chưa nối — bấm để nối video")
                                      }
                                    >
                                      <RiVideoFill className="text-lg text-amber-600" />
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    disabled
                                    className="flex justify-center items-center w-9 h-9 text-gray-400 bg-gray-200 rounded-full border border-gray-300 shadow-sm cursor-default disabled:opacity-100"
                                    title={t("Chưa có video đã nối")}
                                  >
                                    <RiVideoFill className="text-lg text-gray-400" />
                                  </button>
                                );
                              })()}
                            </div>
                            {item.error ? (
                              <div
                                className="w-full max-w-[160px] text-center text-10 leading-snug text-danger line-clamp-3"
                                title={item.error}
                              >
                                {item.error}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            // Chỉ dựa state thực sự đang gen/nối — không dùng status "running" kẹt
                            // (item đã 2/2 + video nối vẫn bị spinner nếu chỉ nhìn status).
                            const isItemRunning =
                              Boolean(generatingIds[item.id]) || Boolean(mergingIds[item.id]);
                            const alreadyDone =
                              hasMergedVideoRef(item.mergedVideoUrl) ||
                              hasVariantVideoUrls(item);
                            return (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStart([item.id])}
                                  disabled={isItemRunning}
                                  className={`flex justify-center items-center w-8 h-8 rounded-full border shadow-sm transition-colors ${
                                    isItemRunning
                                      ? "text-purple-600 bg-purple-50 border-purple-300 cursor-default"
                                      : alreadyDone
                                      ? "text-green-600 bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300"
                                      : "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
                                  }`}
                                  title={
                                    isItemRunning
                                      ? t("Đang chạy...")
                                      : alreadyDone
                                      ? t("Đã có video — bỏ qua khi Bắt Đầu")
                                      : t("Chạy")
                                  }
                                >
                                  {isItemRunning ? (
                                    <RiLoader4Line className="text-sm animate-spin" />
                                  ) : (
                                    <HiPlay className="text-lg" />
                                  )}
                                </button>
                                {isItemRunning ? (
                                  <button
                                    type="button"
                                    onClick={() => handlePause([item.id])}
                                    className="flex justify-center items-center w-8 h-8 rounded-full border shadow-sm transition-colors text-warning bg-warning/10 border-warning hover:bg-warning/20"
                                    title={t("Tạm dừng")}
                                  >
                                    <HiOutlinePause className="text-sm" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="flex justify-center items-center w-8 h-8 rounded-full border shadow-sm transition-colors text-danger bg-danger/10 border-danger hover:bg-danger/20"
                                  title={t("Xóa")}
                                >
                                  <HiOutlineTrash className="text-sm" />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {listTotalMatched > 0 ? (
              <PanelListPagination
                page={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                from={pageStartIndex + 1}
                to={Math.min(safePage * pageSize, listTotalMatched)}
                total={listTotalMatched}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : null}
          </>
        )}
      </PanelListCard>

      {/* Quick export */}
      {listTotal > 0 && (
        <div className="flex justify-end">
          <Button
            text={t("Xuất CSV")}
            onClick={() => {
              void (async () => {
                const all = await getSessionItems(sessionId);
                const csv = exportAffiliatePlusCSV(all);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `video-affiliate-plus-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              })();
            }}
          />
        </div>
      )}

      {/* Inline edit dialog */}
      <Form
        dialog
        isOpen={!!editItemId && !!editField}
        onClose={() => {
          setEditItemId(null);
          setEditField(null);
        }}
        width="420px"
        title={t("Chỉnh sửa")}
      >
        <Dialog.Body>
          <Field label={editField ? t(EDIT_FIELD_LABELS[editField]) : ""}>
            <Input value={editValue} onChange={setEditValue} />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            text={t("Hủy")}
            onClick={() => {
              setEditItemId(null);
              setEditField(null);
            }}
          />
          <Button primary text={t("Lưu")} onClick={saveEdit} />
        </Dialog.Footer>
      </Form>

      <GenerateVideoConfigDialog
        isOpen={generateConfigOpen}
        onClose={() => setGenerateConfigOpen(false)}
        onSaveAndApply={handleSaveGenerateConfig}
      />

      <Dialog
        isOpen={scrapeImportOpen}
        onClose={() => {
          if (importingSessionId) return;
          setScrapeImportOpen(false);
        }}
        width="820px"
        maxWidth="95vw"
        hasCloseIcon={false}
        slideFromBottom="mobile-only"
      >
        <Dialog.Header>
          <div className="flex flex-wrap flex-1 gap-2 justify-between items-center mt-4 w-full">
            <div className="min-w-0">
              <p className="m-0 text-base font-bold text-gray-800">{t("Chọn CSV từ Data")}</p>
              <p className="m-0 mt-0.5 text-xs text-gray-500">
                {t("Import = thay mới · Import (gộp data) = thêm vào danh sách hiện tại")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center shrink-0">
              <button
                type="button"
                disabled={!!importingSessionId}
                onClick={() => {
                  setScrapeImportOpen(false);
                  fileInputRef.current?.click();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <RiFileExcel2Line />
                {t("Nhập thủ công")}
              </button>
              <button
                type="button"
                disabled={!!importingSessionId}
                onClick={() => setScrapeImportOpen(false)}
                className="flex justify-center items-center w-8 h-8 text-gray-400 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label={t("Đóng")}
              >
                <HiOutlineX className="text-lg" />
              </button>
            </div>
          </div>
        </Dialog.Header>
        <Dialog.Body>
          {scrapeLoading ? (
            <div className="flex gap-2 justify-center items-center py-10 text-sm text-gray-500">
              <RiLoader4Line className="text-lg animate-spin" />
              {t("Đang tải danh sách...")}
            </div>
          ) : !scrapeSessions.length ? (
            <div className="py-8 space-y-3 text-center">
              <p className="m-0 text-sm text-gray-500">
                {t("Chưa có CSV trong IndexedDB. Cào dữ liệu trước hoặc nhập thủ công.")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setScrapeImportOpen(false);
                  fileInputRef.current?.click();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <RiFileExcel2Line />
                {t("Nhập thủ công")}
              </button>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px] rounded-lg border border-gray-100">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("Thời gian")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Tên")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Domain")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Keyword")}</th>
                    <th className="px-3 py-2 font-semibold">{t("SP")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Thực hiện")}</th>
                    <th className="px-3 py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {scrapeSessions.map((s) => {
                    const busy = importingSessionId === s.id;
                    return (
                      <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatSessionTime(s.createdAt)}
                        </td>
                        <td
                          className="px-3 py-2 max-w-[160px] truncate font-semibold text-gray-800"
                          title={sessionDisplayName(s)}
                        >
                          {sessionDisplayName(s)}
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate" title={s.marketHost}>
                          {domainLabel(s.marketHost)}
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate" title={s.keyword}>
                          {s.keyword || "—"}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{s.productCount}</td>
                        <td className="px-3 py-2 text-gray-600">{formatDuration(s.durationMs)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex gap-1.5 justify-end items-center">
                            <button
                              type="button"
                              disabled={!!importingSessionId}
                              onClick={() => void handleImportScrapeSession(s, "replace")}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-10 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                              title={t("Thay thế toàn bộ danh sách hiện tại")}
                            >
                              {busy && importingAction === "replace" ? (
                                <RiLoader4Line className="animate-spin" />
                              ) : (
                                <HiUpload />
                              )}
                              {t("Import")}
                            </button>
                            <button
                              type="button"
                              disabled={!!importingSessionId}
                              onClick={() => void handleImportScrapeSession(s, "merge")}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 text-10 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
                              title={t("Thêm vào danh sách đang hiển thị")}
                            >
                              {busy && importingAction === "merge" ? (
                                <RiLoader4Line className="animate-spin" />
                              ) : (
                                <HiUpload />
                              )}
                              {t("Import (gộp data)")}
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
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={!!videoPreview}
        onClose={() => setVideoPreview(null)}
        title={videoPreview?.title || t("Xem video")}
        width="440px"
      >
        <Dialog.Body>
          {videoPreview?.kind === "merged" ? (
            <div className="space-y-3">
              {(() => {
                const src = String(videoPreview.urls[videoPreview.index] || "").trim();
                const showPlayer = Boolean(src) && !videoPreview.error;
                const mergedItem = items.find((i) => i.id === videoPreview.itemId);
                const canRetry = mergedItem && getMergeableVideoUrls(mergedItem).length >= 2;
                const isRetrying = Boolean(mergingIds[videoPreview.itemId]);

                return (
                  <>
                    <div className="overflow-hidden bg-black rounded-lg min-h-[220px] flex items-center justify-center">
                      {showPlayer ? (
                        <video
                          key={`${src}-${videoPreview.index}`}
                          src={src}
                          controls
                          autoPlay
                          playsInline
                          className="mx-auto max-h-[70vh] w-full object-contain"
                          onError={() => {
                            setVideoPreview((prev) =>
                              prev?.kind === "merged"
                                ? {
                                    ...prev,
                                    error: t("File video lỗi / không phát được"),
                                  }
                                : prev
                            );
                          }}
                        />
                      ) : (
                        <div className="flex flex-col gap-2 items-center px-6 py-12 text-center">
                          <div className="flex justify-center items-center w-12 h-12 rounded-full bg-danger/20 text-danger">
                            <RiVideoFill className="text-xl" />
                          </div>
                          <p className="m-0 text-sm font-semibold text-white">
                            {videoPreview.error || t("Không có file video nối")}
                          </p>
                          <p className="m-0 text-xs text-white/60">
                            {t("Dialog vẫn mở — thử Nối lại nếu còn đủ video nguồn")}
                          </p>
                        </div>
                      )}
                    </div>
                    {canRetry ? (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          disabled={isRetrying}
                          onClick={() => mergedItem && void handleRetryMerge(mergedItem)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-warning bg-warning/10 px-3 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
                        >
                          {isRetrying ? (
                            <RiLoader4Line className="text-sm animate-spin" />
                          ) : (
                            <HiRefresh className="text-sm" />
                          )}
                          {isRetrying ? t("Đang nối lại...") : t("Nối lại")}
                        </button>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}

          {videoPreview?.kind === "variants" ? (
            <div className="space-y-3">
              {(() => {
                const idx = videoPreview.index;
                const src = String(videoPreview.slots[idx] || "").trim();
                const isFailed = !src;
                const isDisabled = Boolean(videoPreview.disabled[idx]);
                const isRegen = Boolean(videoPreview.regenerating[idx]);
                const failedCount = videoPreview.slots.filter(
                  (s) => !String(s || "").trim()
                ).length;
                const anyRegen = Object.values(videoPreview.regenerating).some(Boolean);

                return (
                  <>
                    <div className="overflow-hidden bg-black rounded-lg min-h-[220px] flex items-center justify-center relative">
                      {isRegen ? (
                        <div className="flex flex-col gap-2 items-center py-16 text-white/90">
                          <RiLoader4Line className="text-3xl text-purple-300 animate-spin" />
                          <span className="text-xs">{t("Đang tạo lại...")}</span>
                        </div>
                      ) : isFailed ? (
                        <div className="flex flex-col gap-3 items-center px-6 py-12 text-center">
                          <div className="flex justify-center items-center w-12 h-12 rounded-full bg-danger/20 text-danger">
                            <HiRefresh className="text-xl" />
                          </div>
                          <div>
                            <p className="m-0 text-sm font-semibold text-white">
                              {t("Video {{n}} lỗi / thiếu", { n: idx + 1 })}
                            </p>
                            <p className="m-0 mt-1 text-xs text-white/60">
                              {t("Tạo lại để gắn kết quả vào tab này")}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={anyRegen}
                            onClick={() => void regenerateVariantSlot(videoPreview.itemId, idx)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
                          >
                            <HiRefresh className="text-sm" />
                            {t("Tạo lại")}
                          </button>
                        </div>
                      ) : (
                        <video
                          key={`${src}-${idx}`}
                          src={src}
                          controls
                          autoPlay
                          playsInline
                          className={`mx-auto max-h-[70vh] w-full object-contain ${
                            isDisabled ? "opacity-40" : ""
                          }`}
                        />
                      )}
                      {isDisabled && src && !isRegen ? (
                        <div className="absolute inset-x-0 bottom-0 py-1.5 text-center text-10 font-semibold text-white bg-black/70">
                          {t("Đã tắt — bỏ khỏi nối video")}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                      {!isFailed ? (
                        <>
                          <button
                            type="button"
                            disabled={anyRegen}
                            onClick={() => void regenerateVariantSlot(videoPreview.itemId, idx)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
                          >
                            {isRegen ? (
                              <RiLoader4Line className="text-sm animate-spin" />
                            ) : (
                              <HiRefresh className="text-sm" />
                            )}
                            {t("Tạo lại")}
                          </button>
                          <button
                            type="button"
                            disabled={anyRegen}
                            onClick={() => toggleVariantDisabled(videoPreview.itemId, idx)}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isDisabled
                                ? "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200"
                                : "border-warning bg-warning/10 text-warning hover:bg-warning/20"
                            }`}
                            title={
                              isDisabled
                                ? t("Bật lại để nối video")
                                : t("Tắt — bỏ tab này khi nối video")
                            }
                          >
                            <HiBan className="text-sm" />
                            {isDisabled ? t("Bật nối") : t("Tắt nối")}
                          </button>
                        </>
                      ) : null}
                      {failedCount > 0 ? (
                        <button
                          type="button"
                          disabled={anyRegen}
                          onClick={() => void regenerateAllFailedSlots(videoPreview.itemId)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger bg-danger/10 px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                        >
                          <HiRefresh className="text-sm" />
                          {t("Tạo lại tất cả tab lỗi")} ({failedCount})
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {videoPreview.slots.map((slot, tabIdx) => {
                        const active = tabIdx === videoPreview.index;
                        const failed = !String(slot || "").trim();
                        const disabled = Boolean(videoPreview.disabled[tabIdx]);
                        const regen = Boolean(videoPreview.regenerating[tabIdx]);
                        return (
                          <button
                            key={`vp-${tabIdx}`}
                            type="button"
                            onClick={() =>
                              setVideoPreview((prev) =>
                                prev?.kind === "variants" ? { ...prev, index: tabIdx } : prev
                              )
                            }
                            className={`relative min-w-[72px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                              failed
                                ? active
                                  ? "border-danger bg-danger text-white shadow-sm ring-2 ring-red-200"
                                  : "border-danger/60 bg-danger/10 text-danger hover:bg-danger/20"
                                : active
                                ? "border-green-600 bg-green-500 text-white shadow-sm ring-2 ring-green-200"
                                : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700"
                            } ${disabled && !failed ? "opacity-55 line-through" : ""}`}
                          >
                            {regen ? (
                              <span className="inline-flex gap-1 items-center">
                                <RiLoader4Line className="animate-spin" />
                                {tabIdx + 1}
                              </span>
                            ) : (
                              <>
                                {t("Video")} {tabIdx + 1}
                              </>
                            )}
                            {disabled && !failed ? (
                              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-white">
                                <HiBan className="text-[9px]" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </Dialog.Body>
      </Dialog>

      <ImageDialog
        isOpen={!!zoomImage}
        image={zoomImage}
        onClose={() => setZoomImage("")}
        imageDialogClassName="object-contain max-w-full max-h-[80vh]"
      />
    </div>
  );
}
