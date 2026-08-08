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
import {
  RiArrowDownSLine,
  RiDatabase2Line,
  RiFileExcel2Line,
  RiLoader4Line,
  RiVideoFill,
} from "react-icons/ri";
import {
  MediaGenerationJobError,
  useMediaGenerationJob,
} from "../../../lib/hooks/useMediaGenerationJob";
import { useToast } from "../../../lib/providers/toast-provider";
import { useConcurrencyLimits } from "../../app/affiliate-video/hook/useConcurrencyLimits";
import { zipAndDownload } from "../../app/affiliate-video/shared/batchDownloadMedia";
import { GeneratedVideoDownloadButtons } from "../../app/affiliate-video/shared/generated-video-download-buttons";
import { SceneHistoryDropdown } from "../../app/affiliate-video/shared/scene-history-dropdown";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { ImageDialog } from "../../shared/utilities/dialog/image-dialog";
import { Button, Field, Form, Input, Switch } from "../../shared/utilities/form";
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
  getGeneratedVideoBlob,
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
import {
  PanelListCard,
  panelListClasses,
  PanelListMatchCount,
  PanelListPagination,
  panelListRowClass,
  PanelListSearch,
  PanelListToolbar,
} from "../shared/panel-list-ui";
import { buildShopeeVideoImages, prepareShopeeImageInput } from "../shopee-image";
import { loadGenerateVideoConfig, saveGenerateVideoConfig } from "../storage";
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
  ensureVideoSlots,
  GenerateVideoConfig,
  getCharacterImagesForRandomMode,
  getMergeableVideoUrls,
  normalizeVideoSlotStatuses,
  padVideoSlots,
  resolveEffectiveSlotPrompt,
  resolveSlotConfig,
  resolveVideoSlotDisplayStatus,
  ThreadStatus,
  VideoSlotStatus,
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
      slotErrors: string[];
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

const MAX_GENERATE_ERROR_RETRIES = 3;
const MAX_MERGE_ERROR_RETRIES = 3;

function getTaskErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message?.trim()) return err.message.trim();
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

function isGenerateRetryableError(err: unknown): boolean {
  const message = getTaskErrorMessage(err, "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("violates the content policy") ||
    message.includes("content policy") ||
    message.includes("hệ thống hiện đang bận") ||
    message.includes("he thong hien dang ban") ||
    message.includes("task_timeout") ||
    message.includes("job timeout") ||
    message.includes("timeout: quá 20 phút không hoàn thành") ||
    message.includes("timeout: qua 20 phut khong hoan thanh") ||
    (message.includes("flow2") && message.includes("timeout"))
  );
}

/** Retry merge khi lỗi tạm; 404/link hết hạn / thiếu binary → không retry. */
function isMergeRetryableError(err: unknown): boolean {
  const message = getTaskErrorMessage(err, "").toLowerCase();
  if (!message) return false;
  // Link flow2 chết / empty — generate lại, không spammed proxy.
  if (
    /http\s*404|http\s*410|proxy\s*404|proxy\s*410|upstream http\s*404|upstream http\s*410/.test(
      message
    ) ||
    message.includes("không còn tồn tại") ||
    message.includes("không tồn tại hoặc đã hết hạn") ||
    message.includes("hết hạn") ||
    message.includes("hãy generate lại") ||
    message.includes("rỗng") ||
    message.includes("indexeddb đầy") ||
    message.includes("cần ít nhất 2 video")
  ) {
    return false;
  }
  // Lỗi tạm: network / WASM / race tải
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load") ||
    message.includes("memory") ||
    message.includes("ffmpeg") ||
    message.includes("quota") ||
    message.includes("đang chờ") ||
    message.includes("thử nối lại")
  );
}

/** Giới hạn số job video chạy đồng thời (dùng chung khi Tách Prompt + Bắt đầu nhiều task). */
function createConcurrencyPool(limit: number) {
  const max = Math.max(1, Math.min(50, Math.round(limit || 1)));
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    async acquire(): Promise<void> {
      if (active < max) {
        active += 1;
        return;
      }
      await new Promise<void>((resolve) => {
        waiters.push(() => {
          active += 1;
          resolve();
        });
      });
    },
    release(): void {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) next();
    },
  };
}

function isMergeRetryCandidate(item: AffiliatePlusItem): boolean {
  return getMergeableVideoUrls(item).length >= 2 && !hasMergedVideoRef(item.mergedVideoUrl);
}

function getRetryCounterLabel(item: AffiliatePlusItem): string {
  const parts: string[] = [];
  if ((item.generateRetryCount || 0) > 0) {
    parts.push(`Gen retry ${item.generateRetryCount}/${MAX_GENERATE_ERROR_RETRIES}`);
  }
  if ((item.mergeRetryCount || 0) > 0) {
    parts.push(`Merge retry ${item.mergeRetryCount}/${MAX_MERGE_ERROR_RETRIES}`);
  }
  return parts.join(" | ");
}

function getCharacterPreview(config: GenerateVideoConfig): {
  urls: string[];
  name: string;
  randomEnabled: boolean;
} {
  const character: CharacterProfile | undefined =
    config.characters.find((c) => c.id === config.characterId) || config.characters[0];
  if (!character) return { urls: [], name: "", randomEnabled: false };
  if (config.useCharacterImage === false) {
    return {
      urls: [],
      name: character.characterName || character.name || "",
      randomEnabled: false,
    };
  }
  const randomEnabled = config.randomImagesEnabled === true;
  const urls = getCharacterImagesForRandomMode(character, randomEnabled);
  return {
    urls,
    name: character.characterName || character.name || "",
    randomEnabled,
  };
}

/** Preview ảnh nhân vật theo từng slot (Tách Prompt → mỗi Video - N một nhân vật). */
function getSlotCharacterPreviews(config: GenerateVideoConfig): Array<{
  slotIndex: number;
  urls: string[];
  name: string;
  enabled: boolean;
  randomEnabled: boolean;
}> {
  const count = config.splitPrompt ? Math.min(4, Math.max(1, Number(config.videosPerJob) || 1)) : 1;
  return Array.from({ length: count }, (_, slotIndex) => {
    const slot = resolveSlotConfig(config, slotIndex);
    const character =
      config.characters.find((c) => c.id === slot.characterId) || config.characters[0];
    if (!character) {
      return { slotIndex, urls: [], name: "", enabled: false, randomEnabled: false };
    }
    if (slot.useCharacterImage === false) {
      return {
        slotIndex,
        urls: [],
        name: character.characterName || character.name || "",
        enabled: false,
        randomEnabled: false,
      };
    }
    const randomEnabled = slot.randomImagesEnabled === true;
    const urls = getCharacterImagesForRandomMode(character, randomEnabled);
    return {
      slotIndex,
      urls,
      name: character.characterName || character.name || "",
      enabled: true,
      randomEnabled,
    };
  });
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
  const [filterBucket, setFilterBucket] = useState<
    "all" | "waiting" | "uploading" | "success" | "error"
  >("all");
  const filterBucketRef = useRef<"all" | "waiting" | "uploading" | "success" | "error">("all");

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
  const [characterPreview, setCharacterPreview] = useState<{
    urls: string[];
    name: string;
    randomEnabled: boolean;
  }>({
    urls: [],
    name: "",
    randomEnabled: false,
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
    flow2RequestId?: string;
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
  filterBucketRef.current = filterBucket;

  const loadPage = useCallback(
    async (override?: {
      page?: number;
      q?: string;
      bucket?: "all" | "waiting" | "uploading" | "success" | "error";
    }) => {
      const gen = ++loadGenRef.current;
      const requestedSessionId = sessionIdRef.current;
      const pageNum = override?.page ?? safePageRef.current;
      const q = override?.q ?? searchTermRef.current;
      const bucket = override?.bucket ?? filterBucketRef.current;
      const limit = pageSizeRef.current;
      const offset = (Math.max(1, pageNum) - 1) * limit;
      setListLoading(true);
      try {
        const [pageResult, meta, selected, hasMerged] = await Promise.all([
          queryThreadPage(requestedSessionId, { offset, limit, q, bucket }),
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
    },
    []
  );

  useEffect(() => {
    // Reset UI ngay khi đổi phiên — tránh giữ list/search của phiên cũ
    pageRef.current = 1;
    searchTermRef.current = "";
    filterBucketRef.current = "all";
    setPage(1);
    setSearchQuery("");
    setSearchTerm("");
    setFilterBucket("all");
    setVisibleItems([]);
    setListTotal(0);
    setListTotalMatched(0);
    setListMeta(null);
    setSelectedCount(0);
    setHasMergedVideos(false);

    let cancelled = false;
    (async () => {
      if (!cancelled) await loadPage({ page: 1, q: "", bucket: "all" });
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

  /** Lấy text lỗi hiển thị cho từng tab variant trong modal Kết quả video. */
  const resolveVariantSlotErrorMessage = (
    item: AffiliatePlusItem | undefined,
    slotIndex: number,
    slotErrors: string[]
  ): string => {
    const direct = String(slotErrors[slotIndex] || "").trim();
    if (direct) return direct;

    const taskErr = String(item?.error || "").trim();
    if (!taskErr) return "";

    const perSlot = taskErr.match(
      new RegExp(`Video\\s*-\\s*${slotIndex + 1}\\s*lỗi:\\s*(.+)$`, "i")
    );
    if (perSlot?.[1]?.trim()) return perSlot[1].trim();

    const failedOnly =
      (item?.videoUrls || []).filter((u) => String(u || "").trim()).length === 0 &&
      !String(item?.videoUrls?.[slotIndex] || "").trim();
    if (failedOnly && taskErr) return taskErr;

    return "";
  };

  /** Preview variant: đủ số tab = config; slot trống = lỗi (tab đỏ). */
  const openVariantPreview = async (item: AffiliatePlusItem, startIndex = 0) => {
    const fresh = (await getThreadItem(sessionId, item.id)) || item;
    const config = genConfig || (await loadGenerateVideoConfig());
    const slotCount = Math.max(fresh.videoUrls?.length || 0, config.videosPerJob || 1, 1);
    const slots = await resolveVariantPreviewUrls(fresh, slotCount, sessionId);
    const paddedSlots = Array.from({ length: slotCount }, (_, i) => slots[i] || "");
    const disabled = Array.from({ length: slotCount }, (_, i) => Boolean(fresh.videoDisabled?.[i]));
    const slotErrors = Array.from({ length: slotCount }, (_, i) =>
      String(fresh.videoSlotErrors?.[i] || "").trim()
    );
    const safeIndex = Math.min(Math.max(0, startIndex), Math.max(0, slotCount - 1));
    setVideoPreview({
      kind: "variants",
      title: t("Kết quả video"),
      itemId: fresh.id,
      slots: paddedSlots,
      disabled,
      slotErrors,
      index: safeIndex,
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
      openVideoPreviewMerged(title, item.id, [], err?.message || t("Không mở được video"));
    }
  };

  const autoMergeAttemptedRef = useRef<Record<string, boolean>>({});

  const executeMergeWithRetry = useCallback(
    async (
      item: AffiliatePlusItem,
      opts?: { urls?: string[]; resetRetryCount?: boolean; keepErrorVisible?: boolean }
    ) => {
      const urls = opts?.urls || getMergeableVideoUrls(item);
      if (urls.length < 2) {
        toast.warn(t("Cần ít nhất 2 video (không bị tắt) để nối"));
        return false;
      }

      const latest = (await getThreadItem(sessionId, item.id)) || item;
      let retriesUsed = opts?.resetRetryCount ? 0 : Number(latest.mergeRetryCount || 0);

      autoMergeAttemptedRef.current[item.id] = true;
      setMergingIds((prev) => ({ ...prev, [item.id]: true }));
      await patchThread(sessionId, item.id, {
        error: opts?.keepErrorVisible ? latest.error || "" : "",
        countdown: 0,
        mergeRetryCount: retriesUsed,
      });

      try {
        if (latest.mergedVideoUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(latest.mergedVideoUrl);
          } catch {
            // ignore
          }
        }

        for (;;) {
          try {
            const mergedUrl = await mergeVideosToIndexedDb(
              getMergedVideoStorageKey(latest, sessionId),
              urls
            );
            await patchThread(sessionId, item.id, {
              mergedVideoUrl: mergedUrl,
              error: "",
              mergeRetryCount: 0,
              ...(latest.status === "error" ? { status: "stopped" as ThreadStatus } : {}),
            });
            scheduleParentSync();
            autoMergeAttemptedRef.current[item.id] = true;
            onAddLog(t("Đã nối video và lưu IndexedDB"), "success", item.id);
            return true;
          } catch (err: any) {
            const msg = getTaskErrorMessage(err, t("Nối video thất bại"));
            if (isMergeRetryableError(err) && retriesUsed < MAX_MERGE_ERROR_RETRIES) {
              retriesUsed += 1;
              await patchThread(sessionId, item.id, {
                error: "",
                countdown: 0,
                mergeRetryCount: retriesUsed,
                ...(latest.status === "error" ? { status: "stopped" as ThreadStatus } : {}),
              });
              onAddLog(
                t("Nối video lỗi, tự retry {{current}}/{{max}}: {{msg}}", {
                  current: retriesUsed,
                  max: MAX_MERGE_ERROR_RETRIES,
                  msg,
                }),
                "warning",
                item.id
              );
              continue;
            }

            await patchThread(sessionId, item.id, {
              error: msg,
              countdown: 0,
              mergeRetryCount: retriesUsed,
            });
            scheduleParentSync();
            onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", item.id);
            toast.error(msg);
            setVideoPreview((prev) =>
              prev?.kind === "merged" && prev.itemId === item.id
                ? { ...prev, urls: [], error: msg }
                : prev
            );
            return false;
          }
        }
      } finally {
        setMergingIds((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [onAddLog, scheduleParentSync, sessionId, t, toast]
  );

  /** Hoãn merge ffmpeg — nhường event loop để worker enqueue/poll job generate tiếp theo. */
  const MERGE_DEFER_MS = 400;

  const scheduleBackgroundMerge = useCallback(
    (mergeItemId: string, _mergeKey: string, mergeUrls: string[], deferMs = MERGE_DEFER_MS) => {
      autoMergeAttemptedRef.current[mergeItemId] = true;
      onAddLog(
        t("Xếp hàng nối {{count}} video (1 SP / lần)...", { count: mergeUrls.length }),
        "info",
        mergeItemId
      );

      window.setTimeout(() => {
        if (pauseAllRef.current) return;

        void (async () => {
          const latest =
            (await getThreadItem(sessionId, mergeItemId)) ||
            itemsRef.current.find((i) => i.id === mergeItemId);
          if (!latest || pauseAllRef.current) return;
          const urlsToMerge = getMergeableVideoUrls(latest);
          if (urlsToMerge.length < 2) return;
          // Full pipeline queue trong mergeVideosToIndexedDb — 1 SP load+merge+lưu IDB / lúc
          await executeMergeWithRetry(latest, { urls: urlsToMerge, resetRetryCount: true });
        })();
      }, deferMs);
    },
    [MERGE_DEFER_MS, executeMergeWithRetry, onAddLog, sessionId, t]
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

    // Tuần tự từng SP (pipeline merge cũng serial) — tránh fire-and-forget ồ ạt
    for (const item of pending) {
      if (batchRunningRef.current || pauseAllRef.current) break;
      autoMergeAttemptedRef.current[item.id] = true;
      const urls = getMergeableVideoUrls(item);
      if (urls.length < 2) continue;
      onAddLog(
        t("Xếp hàng nối {{count}} video (1 SP / lần)...", { count: urls.length }),
        "info",
        item.id
      );
      await executeMergeWithRetry(item, { urls, resetRetryCount: true });
    }
  }, [executeMergeWithRetry, generatingIds, loadPage, mergingIds, onAddLog, sessionId, t]);

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
  }, [searchTerm, pageSize, filterBucket]);

  useEffect(() => {
    void loadPage({ page: 1, bucket: filterBucket });
  }, [filterBucket, loadPage]);

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
    const mergeItems = errorItems.filter(isMergeRetryCandidate);
    const generateItems = errorItems.filter((item) => !isMergeRetryCandidate(item));

    for (const item of generateItems) {
      await patchThread(sessionId, item.id, {
        status: "waiting" as ThreadStatus,
        error: "",
        countdown: 0,
        generateRetryCount: 0,
        mergeRetryCount: 0,
      });
    }
    await loadPage();
    scheduleParentSync();
    onAddLog(
      t("Retry {{count}} luồng lỗi (generate: {{generate}}, merge: {{merge}})", {
        count: errorItems.length,
        generate: generateItems.length,
        merge: mergeItems.length,
      }),
      "warning"
    );
    if (generateItems.length) void handleStart(generateItems.map((item) => item.id));
    if (mergeItems.length) {
      for (const item of mergeItems) {
        void handleRetryMerge(item, { resetRetryCount: true });
      }
    }
  };

  const handleDeleteSelectedHistory = async (opts?: { skipConfirm?: boolean }) => {
    const id = selectedHistoryId;
    if (!id || clearingIdb || batchRunning) return;
    if (!opts?.skipConfirm) {
      const entry = importHistory.find((h) => h.id === id);
      const label = entry?.label || id;
      const ok = window.confirm(
        t(
          'Xóa phiên "{{label}}"?\n\n• Lịch sử + luồng của phiên này\n• Video variant + video nối trong IndexedDB (nếu không còn phiên khác dùng)\n\nCấu hình Generate Video vẫn giữ.',
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

    const config = genConfig || (await loadGenerateVideoConfig());
    if (!genConfig) setGenConfig(config);
    // videosPerJob = 1 → không nối; tải luôn video generate. > 1 → video đã nối.
    const downloadGeneratedOnly = Math.max(1, Number(config.videosPerJob) || 1) <= 1;

    const candidates = (await getSessionItems(sessionId)).filter((i) => {
      if (downloadGeneratedOnly) {
        return hasVariantVideoUrls(i) || Boolean(i.productId) || Boolean(i.productLink);
      }
      return Boolean(i.mergedVideoUrl) || Boolean(i.productId) || Boolean(i.productLink);
    });
    if (!candidates.length) {
      toast.warn(
        downloadGeneratedOnly
          ? t("Chưa có video generate để tải")
          : t("Chưa có video đã nối để tải")
      );
      return;
    }

    setDownloadingMerged(true);
    try {
      const files: { fileName: string; blob: Blob }[] = [];
      const usedNames = new Set<string>();

      for (const item of candidates) {
        let blob: Blob | null = null;
        if (downloadGeneratedOnly) {
          // Slot đầu tiên có URL (videosPerJob = 1 thường chỉ 1 slot)
          const urls = item.videoUrls || [];
          const disabled = item.videoDisabled || [];
          let slot = 0;
          for (let i = 0; i < Math.max(urls.length, 1); i++) {
            if (String(urls[i] || "").trim() && !disabled[i]) {
              slot = i;
              break;
            }
          }
          blob = await getGeneratedVideoBlob(item, sessionId, slot);
        } else {
          blob = await getMergedVideoBlob(item, sessionId);
        }
        if (!blob) continue;

        // Luôn đặt tên theo Id sản phẩm.mp4 (vd. 42874449161.mp4)
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
        toast.warn(
          downloadGeneratedOnly
            ? t("Chưa có video generate để tải")
            : t("Chưa có video đã nối để tải")
        );
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const zipName = downloadGeneratedOnly
        ? `video-generate-${stamp}.zip`
        : `video-da-noi-${stamp}.zip`;
      await zipAndDownload(files, zipName);
      onAddLog(
        downloadGeneratedOnly
          ? t("Đã tải {{count}} video generate (ZIP)", { count: files.length })
          : t("Đã tải {{count}} video đã nối (ZIP)", { count: files.length }),
        "success"
      );
      toast.success(
        downloadGeneratedOnly
          ? t("Đã tải {{count}} video generate", { count: files.length })
          : t("Đã tải {{count}} video đã nối", { count: files.length })
      );
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
      onAddLog(t("Bỏ qua {{count}} luồng đã có video", { count: skippedDone.length }), "info");
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
    // Luôn reload từ IndexedDB — tránh dùng config cũ trong memory
    // (vd. vừa bật "Ảnh ngẫu nhiên" trong Quản lý Nhân Vật nhưng chưa Save & Apply).
    try {
      config = await loadGenerateVideoConfig();
      setGenConfig(config);
      setCharacterPreview(getCharacterPreview(config));
    } catch (err) {
      console.error(err);
      if (!config) {
        toast.error(t("Không tải được cấu hình generate video"));
        return;
      }
    }

    const preview = getCharacterPreview(config);
    const useCharacterImage = config.useCharacterImage !== false;
    // Ảnh nhân vật theo switch cấu hình — tắt thì chỉ dùng ảnh sản phẩm

    const missingProduct = targets.filter((i) => !i.imageUrl?.trim());
    if (missingProduct.length) {
      toast.warn(t("{{count}} luồng thiếu ảnh sản phẩm", { count: missingProduct.length }));
      return;
    }

    const prompt = buildActivePromptFromConfig(config).trim() || config.activePrompt?.trim() || "";
    if (config.splitPrompt) {
      const prompt0 = resolveEffectiveSlotPrompt(config, 0);
      if (!prompt0) {
        toast.warn(t("Chưa có prompt cho Video - 1 trong cấu hình Tách Prompt"));
        return;
      }
    } else if (!prompt) {
      toast.warn(t("Chưa có prompt trong cấu hình Generate Video"));
      return;
    }

    pauseAllRef.current = false;
    runnerRef.current?.stop();
    const isSingleTaskRun = ids?.length === 1;
    const videoConcurrency = Math.max(1, Math.min(50, Math.round(VIDEO_CONCURRENCY || 1)));
    const videoSlotPool = config.splitPrompt ? createConcurrencyPool(videoConcurrency) : null;
    // Không tách prompt: concurrency = số luồng video customer (mỗi task = 1 job).
    // Tách prompt + 1 task: task concurrency = 1, slot song song theo videoConcurrency.
    // Tách prompt + Bắt đầu: mọi task chạy, slot dùng chung pool videoConcurrency.
    const concurrency = config.splitPrompt
      ? isSingleTaskRun
        ? 1
        : Math.max(1, targets.length)
      : videoConcurrency;
    onAddLog(
      t("Bắt đầu {{count}} luồng (song song {{n}})", {
        count: targets.length,
        n: config.splitPrompt ? videoConcurrency : concurrency,
      }),
      "info"
    );
    toast.success(t("Đã bắt đầu {{count}} luồng", { count: targets.length }));

    let characterPreparedFixed: Awaited<ReturnType<typeof prepareShopeeImageInput>>[] = [];
    if (useCharacterImage && preview.urls.length) {
      try {
        characterPreparedFixed = await Promise.all(
          preview.urls.map((url) => prepareShopeeImageInput(url))
        );
      } catch (err: any) {
        toast.error(t("Không xử lý được ảnh nhân vật: {{msg}}", { msg: err?.message || "" }));
        return;
      }
    } else if (!useCharacterImage) {
      onAddLog(t("Đã tắt ảnh nhân vật — generate chỉ với ảnh sản phẩm"), "info");
    } else {
      onAddLog(t("Không có ảnh nhân vật — generate chỉ với ảnh sản phẩm"), "info");
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
        generateRetryCount: 0,
        mergeRetryCount: 0,
      });

      try {
        if (ctx.isPaused() || pauseAllRef.current) return "cancelled";

        for (;;) {
          try {
            const fresh = (await getThreadItem(sessionId, target.id)) || target;
            const productPrepared = await prepareShopeeImageInput(fresh.imageUrl);
            const slotCount = Math.max(1, Math.min(4, config!.videosPerJob || 1));
            const splitPrompt = Boolean(config!.splitPrompt);

            const runOneGenerate = async (opts: {
              promptText: string;
              images: Awaited<ReturnType<typeof buildShopeeVideoImages>>;
              characterPrepared: Awaited<ReturnType<typeof prepareShopeeImageInput>>[];
              productPrepared: Awaited<ReturnType<typeof prepareShopeeImageInput>>;
              videoModel: string;
              slotIndex?: number;
            }) => {
              let result: Awaited<ReturnType<typeof shopeeVideoJob.run>>;
              for (let attempt = 0; ; attempt++) {
                if (ctx.isPaused() || pauseAllRef.current) {
                  throw new MediaGenerationJobError(t("Đã dừng"), "JOB_CANCELLED");
                }
                try {
                  result = await shopeeVideoJob.run({
                    url: "/api/app/generation-shopee-video/",
                    body: {
                      prompt: opts.promptText,
                      images: opts.images,
                      ...(opts.characterPrepared[0]
                        ? { characterImage: opts.characterPrepared[0] }
                        : {}),
                      productImage: opts.productPrepared,
                      videosPerJob: 1,
                      variantCount: 1,
                      videoModel: opts.videoModel,
                      config: {
                        prompt: opts.promptText,
                        aspectRatio: "9:16",
                        videosPerJob: 1,
                        variantCount: 1,
                        videoModel: opts.videoModel,
                        videoMode: "component",
                      },
                      _metadata: {
                        threadId: fresh.id,
                        shopName: fresh.shopName,
                        productName: fresh.productName,
                        ...(opts.slotIndex != null ? { slotIndex: opts.slotIndex } : {}),
                      },
                    },
                    cancelOnUnmount: true,
                    onJobEnqueued: (jobId) => {
                      activeJobIdsRef.current[fresh.id] = jobId;
                    },
                    onProgress: (_pct, msg) => {
                      if (msg)
                        onAddLog(`${fresh.productName || fresh.id}: ${msg}`, "info", fresh.id);
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
              return result!;
            };

            const extractUris = (result: Awaited<ReturnType<typeof shopeeVideoJob.run>>) => {
              const fromUris = (
                (result.data.videoUris?.length ? result.data.videoUris : []) as string[]
              )
                .map((u) => String(u || "").trim())
                .filter(Boolean);
              const singleUri = String(result.data.videoUri || "").trim();
              return Array.from(new Set(fromUris.length ? fromUris : singleUri ? [singleUri] : []));
            };

            let videoUrls: string[] = [];
            let videoDisabled: boolean[] = [];
            let videoFlow2RequestIds: string[] = [];
            let filledCount = 0;

            let splitSlotStatuses: Array<"pending" | "running" | "success" | "error"> | undefined;
            let splitSlotErrors: string[] | undefined;

            if (splitPrompt) {
              // Tách Prompt: mỗi video = 1 job (variantCount=1), prompt/config riêng → rồi mới nối.
              // Cập nhật thread sau mỗi slot để UI hiện Vn xong / lỗi ngay.
              videoUrls = Array.from({ length: slotCount }, () => "");
              videoDisabled = Array.from({ length: slotCount }, () => false);
              videoFlow2RequestIds = Array.from({ length: slotCount }, () => "");
              const slotStatuses: Array<"pending" | "running" | "success" | "error"> = Array.from(
                { length: slotCount },
                () => "pending"
              );
              const slotErrors: string[] = Array.from({ length: slotCount }, () => "");

              await patchThread(sessionId, fresh.id, {
                status: "running" as ThreadStatus,
                videoUrls: [...videoUrls],
                videoDisabled: [...videoDisabled],
                videoFlow2RequestIds: [...videoFlow2RequestIds],
                videoSlotStatuses: [...slotStatuses],
                videoSlotErrors: [...slotErrors],
                uploaded: 0,
                pending: slotCount,
                error: "",
                countdown: 99999,
              });
              scheduleParentSync();

              let slotPatchChain: Promise<void> = Promise.resolve();
              const patchSlotState = (buildPatch: () => Parameters<typeof patchThread>[2]) => {
                slotPatchChain = slotPatchChain.then(async () => {
                  await patchThread(sessionId, fresh.id, buildPatch());
                });
                return slotPatchChain;
              };

              let slotRunCancelled = false;
              const runOneSlot = async (slotIndex: number) => {
                if (slotRunCancelled || ctx.isPaused() || pauseAllRef.current) {
                  slotRunCancelled = true;
                  return;
                }

                await videoSlotPool!.acquire();
                try {
                  if (slotRunCancelled || ctx.isPaused() || pauseAllRef.current) {
                    slotRunCancelled = true;
                    return;
                  }

                  slotStatuses[slotIndex] = "running";
                  slotErrors[slotIndex] = "";
                  await patchSlotState(() => ({
                    videoSlotStatuses: [...slotStatuses],
                    videoSlotErrors: [...slotErrors],
                    status: "running" as ThreadStatus,
                    countdown: 99999,
                  }));
                  scheduleParentSync();

                  const slot = resolveSlotConfig(config!, slotIndex);
                  const slotPrompt =
                    resolveEffectiveSlotPrompt(config!, slotIndex) ||
                    fresh.prompt?.trim() ||
                    prompt;

                  let characterPrepared: Awaited<ReturnType<typeof prepareShopeeImageInput>>[] = [];
                  if (slot.useCharacterImage !== false) {
                    const character =
                      config!.characters.find((c) => c.id === slot.characterId) ||
                      config!.characters[0];
                    if (character) {
                      const urls = getCharacterImagesForRandomMode(
                        character,
                        slot.randomImagesEnabled === true
                      );
                      if (urls.length) {
                        characterPrepared = await Promise.all(
                          urls.map((url) => prepareShopeeImageInput(url))
                        );
                      }
                    }
                  }
                  const images = buildShopeeVideoImages(characterPrepared, productPrepared);

                  for (let slotRetry = 0; ; slotRetry++) {
                    if (slotRunCancelled || ctx.isPaused() || pauseAllRef.current) {
                      slotRunCancelled = true;
                      return;
                    }

                    try {
                      onAddLog(
                        t("Generate Video - {{n}}/{{total}} (Tách Prompt)", {
                          n: slotIndex + 1,
                          total: slotCount,
                        }),
                        "info",
                        fresh.id
                      );

                      const result = await runOneGenerate({
                        promptText: slotPrompt,
                        images,
                        characterPrepared,
                        productPrepared,
                        videoModel: slot.videoModel || config!.videoModel,
                        slotIndex,
                      });

                      if (slotRunCancelled || ctx.isPaused() || pauseAllRef.current) {
                        slotRunCancelled = true;
                        return;
                      }

                      const rawUris = extractUris(result);
                      const uri = rawUris[0] || "";
                      if (!uri) {
                        throw new Error(t("Không nhận được video"));
                      }
                      videoUrls[slotIndex] = uri;
                      videoFlow2RequestIds[slotIndex] = String(
                        result.data.flow2RequestId || ""
                      ).trim();
                      slotStatuses[slotIndex] = "success";
                      slotErrors[slotIndex] = "";

                      const filledSoFar = videoUrls.filter(Boolean).length;
                      await patchSlotState(() => ({
                        status: "running" as ThreadStatus,
                        videoUrls: [...videoUrls],
                        videoDisabled: [...videoDisabled],
                        videoFlow2RequestIds: [...videoFlow2RequestIds],
                        videoSlotStatuses: [...slotStatuses],
                        videoSlotErrors: [...slotErrors],
                        uploaded: filledSoFar,
                        pending: Math.max(slotCount - filledSoFar, 0),
                        error: "",
                        countdown: 99999,
                      }));
                      scheduleParentSync();

                      onAddLog(t("Video - {{n}} xong", { n: slotIndex + 1 }), "success", fresh.id);
                      return;
                    } catch (slotErr: any) {
                      if (
                        ctx.isPaused() ||
                        pauseAllRef.current ||
                        (slotErr instanceof MediaGenerationJobError &&
                          (slotErr.code === "JOB_CANCELLED" || slotErr.code === "JOB_NOT_FOUND"))
                      ) {
                        slotRunCancelled = true;
                        return;
                      }

                      const slotMsg = getTaskErrorMessage(slotErr, t("Generate video thất bại"));
                      if (
                        isGenerateRetryableError(slotErr) &&
                        slotRetry < MAX_GENERATE_ERROR_RETRIES
                      ) {
                        const nextRetry = slotRetry + 1;
                        onAddLog(
                          t("Video - {{n}} lỗi, tự retry {{current}}/{{max}}: {{msg}}", {
                            n: slotIndex + 1,
                            current: nextRetry,
                            max: MAX_GENERATE_ERROR_RETRIES,
                            msg: slotMsg,
                          }),
                          "warning",
                          fresh.id
                        );
                        continue;
                      }

                      slotStatuses[slotIndex] = "error";
                      slotErrors[slotIndex] = slotMsg;
                      videoUrls[slotIndex] = "";
                      videoFlow2RequestIds[slotIndex] = "";

                      const filledSoFar = videoUrls.filter(Boolean).length;
                      await patchSlotState(() => ({
                        status: "running" as ThreadStatus,
                        videoUrls: [...videoUrls],
                        videoDisabled: [...videoDisabled],
                        videoFlow2RequestIds: [...videoFlow2RequestIds],
                        videoSlotStatuses: [...slotStatuses],
                        videoSlotErrors: [...slotErrors],
                        uploaded: filledSoFar,
                        pending: Math.max(slotCount - filledSoFar, 0),
                        error: t("Video - {{n}} lỗi: {{msg}}", {
                          n: slotIndex + 1,
                          msg: slotMsg,
                        }),
                        countdown: 99999,
                      }));
                      scheduleParentSync();
                      onAddLog(
                        t("Video - {{n}} lỗi: {{msg}}", {
                          n: slotIndex + 1,
                          msg: slotMsg,
                        }),
                        "error",
                        fresh.id
                      );
                      return;
                    }
                  }
                } finally {
                  videoSlotPool!.release();
                }
              };

              await Promise.all(
                Array.from({ length: slotCount }, (_, slotIndex) => runOneSlot(slotIndex))
              );
              await slotPatchChain;

              if (slotRunCancelled) return "cancelled";

              splitSlotStatuses = [...slotStatuses];
              splitSlotErrors = [...slotErrors];

              filledCount = videoUrls.filter(Boolean).length;
              // Nếu mọi slot đều lỗi → ném để outer catch đánh error task
              if (filledCount === 0 && slotStatuses.every((s) => s === "error")) {
                const firstErr = slotErrors.find((e) => e.trim()) || t("Generate video thất bại");
                throw new Error(firstErr);
              }
            } else {
              // Giữ hành vi cũ: 1 job với variantCount = videosPerJob
              const characterPrepared = characterPreparedFixed;
              const images = buildShopeeVideoImages(characterPrepared, productPrepared);
              const jobPrompt = fresh.prompt?.trim() || prompt;

              let result: Awaited<ReturnType<typeof shopeeVideoJob.run>>;
              for (let attempt = 0; ; attempt++) {
                if (ctx.isPaused() || pauseAllRef.current) return "cancelled";
                try {
                  result = await shopeeVideoJob.run({
                    url: "/api/app/generation-shopee-video/",
                    body: {
                      prompt: jobPrompt,
                      images,
                      ...(characterPrepared[0] ? { characterImage: characterPrepared[0] } : {}),
                      productImage: productPrepared,
                      videosPerJob: config!.videosPerJob,
                      variantCount: config!.videosPerJob,
                      videoModel: config!.videoModel,
                      config: {
                        prompt: jobPrompt,
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
                      if (msg)
                        onAddLog(`${fresh.productName || fresh.id}: ${msg}`, "info", fresh.id);
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

              const rawUris = extractUris(result!);
              const padded = padVideoSlots(rawUris, Math.max(slotCount, rawUris.length, 1));
              videoUrls = padded.videoUrls;
              videoDisabled = padded.videoDisabled;
              filledCount = videoUrls.filter(Boolean).length;
              const flow2RequestId = String(result!.data.flow2RequestId || "").trim();
              videoFlow2RequestIds = videoUrls.map((u) =>
                u && flow2RequestId ? flow2RequestId : ""
              );
            }

            const normalizedSlots = splitPrompt
              ? normalizeVideoSlotStatuses(
                  videoUrls,
                  splitSlotStatuses,
                  splitSlotErrors
                )
              : null;
            const finalSlotStatuses = normalizedSlots
              ? normalizedSlots.statuses
              : videoUrls.map((u) => (u ? ("success" as const) : ("error" as const)));
            const finalSlotErrors = normalizedSlots
              ? normalizedSlots.errors
              : videoUrls.map(() => "");
            const failedSlots = finalSlotStatuses
              .map((s, i) => (s === "error" ? i + 1 : 0))
              .filter(Boolean);
            const partialError =
              splitPrompt && failedSlots.length
                ? t("Lỗi Video - {{list}}", { list: failedSlots.join(", ") })
                : "";

            await patchThread(sessionId, fresh.id, {
              status: "success" as ThreadStatus,
              videoUrls,
              videoDisabled,
              videoFlow2RequestIds,
              videoSlotStatuses: finalSlotStatuses,
              videoSlotErrors: finalSlotErrors,
              uploaded: filledCount,
              pending: Math.max(slotCount - filledCount, 0),
              error: partialError,
              countdown: 0,
              generateRetryCount: 0,
              mergeRetryCount: 0,
            });

            setGeneratingIds((prev) => {
              const next = { ...prev };
              delete next[fresh.id];
              return next;
            });

            try {
              await persistProductVideosWithEnrichment(
                getMergedVideoStorageKey(fresh, sessionId),
                videoUrls
              );
            } catch (persistErr) {
              console.warn("[persistProductVideosWithEnrichment]", persistErr);
            }

            // Nối video chạy nền — KHÔNG giữ slot concurrency của ThreadRunner.
            // (Trước đây await merge → UI đã success nhưng pool không lấy job mới.)
            const latestForMerge = (await getThreadItem(sessionId, fresh.id)) || fresh;
            const mergeUrls = getMergeableVideoUrls({
              ...latestForMerge,
              videoUrls,
              videoDisabled,
            });
            const willMerge = mergeUrls.length >= 2 && !ctx.isPaused() && !pauseAllRef.current;
            if (willMerge) {
              scheduleBackgroundMerge(
                fresh.id,
                getMergedVideoStorageKey(fresh, sessionId),
                mergeUrls
              );
            }

            if (!ctx.isPaused() && !pauseAllRef.current) {
              onAddLog(
                t("Hoàn tất video cho {{name}} ({{count}} file{{merged}})", {
                  name: fresh.productName || fresh.shopName || fresh.id,
                  count: filledCount || 1,
                  merged: willMerge ? `, ${t("đang nối")}` : "",
                }),
                failedSlots.length ? "warning" : "success",
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

            const latest = (await getThreadItem(sessionId, target.id)) || target;
            const retriesUsed = Number(latest.generateRetryCount || 0);
            const msg = getTaskErrorMessage(err, t("Generate video thất bại"));

            if (isGenerateRetryableError(err) && retriesUsed < MAX_GENERATE_ERROR_RETRIES) {
              const nextRetry = retriesUsed + 1;
              await patchThread(sessionId, target.id, {
                status: "running" as ThreadStatus,
                error: "",
                countdown: 99999,
                generateRetryCount: nextRetry,
              });
              onAddLog(
                t("Generate lỗi, tự retry {{current}}/{{max}}: {{msg}}", {
                  current: nextRetry,
                  max: MAX_GENERATE_ERROR_RETRIES,
                  msg,
                }),
                "warning",
                target.id
              );
              continue;
            }

            console.error(err);
            await patchThread(sessionId, target.id, {
              status: "error" as ThreadStatus,
              error: msg,
              countdown: 0,
              generateRetryCount: retriesUsed,
            });
            onAddLog(
              t("Lỗi generate video: {{msg}}", {
                msg,
              }),
              "error",
              target.id
            );
            scheduleParentSync();
            return "error";
          }
        }
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

  const handleRetryMerge = async (
    item: AffiliatePlusItem,
    opts?: { resetRetryCount?: boolean }
  ) => {
    if (mergingIds[item.id]) return;

    const mergedOk = await executeMergeWithRetry(item, {
      resetRetryCount: opts?.resetRetryCount ?? true,
    });
    if (!mergedOk) return;

    toast.success(t("Đã nối lại video"));

    const latest = (await getThreadItem(sessionId, item.id)) || item;
    try {
      const previewUrl = await resolveMergedPreviewUrl(latest, sessionId);
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
  };

  /** Tạo lại 1 slot variant (gắn vào đúng tab; URL → IDB → base64 ngầm). */
  const regenerateVariantSlot = async (
    itemId: string,
    slotIndex: number,
    opts?: { manageGeneratingState?: boolean }
  ) => {
    const manageGeneratingState = opts?.manageGeneratingState !== false;
    const target =
      (await getThreadItem(sessionId, itemId)) || itemsRef.current.find((i) => i.id === itemId);
    if (!target) return;

    const config = genConfig || (await loadGenerateVideoConfig());
    const slotCount = Math.max(
      target.videoUrls?.length || 0,
      config.videosPerJob || 1,
      slotIndex + 1
    );
    const buildSlotArrays = (base: AffiliatePlusItem) => {
      const statuses = Array.from({ length: slotCount }, (_, i) => {
        if (String(base.videoUrls?.[i] || "").trim()) return "success" as const;
        const prev = base.videoSlotStatuses?.[i];
        if (prev === "error" || prev === "running" || prev === "pending") return prev;
        return "pending" as const;
      });
      const errors = Array.from({ length: slotCount }, (_, i) =>
        String(base.videoSlotErrors?.[i] || "").trim()
      );
      return { statuses, errors };
    };

    if (manageGeneratingState) {
      setGeneratingIds((prev) => ({ ...prev, [itemId]: true }));
    }
    setVideoPreview((prev) =>
      prev?.kind === "variants" && prev.itemId === itemId
        ? { ...prev, regenerating: { ...prev.regenerating, [slotIndex]: true }, index: slotIndex }
        : prev
    );

    const { statuses: startStatuses, errors: startErrors } = buildSlotArrays(target);
    startStatuses[slotIndex] = "running";
    startErrors[slotIndex] = "";
    await patchItem(itemId, {
      status: "running" as ThreadStatus,
      countdown: 99999,
      error: "",
      videoSlotStatuses: startStatuses,
      videoSlotErrors: startErrors,
    });

    let finished = false;
    try {
      const slot = resolveSlotConfig(config, slotIndex);
      const useCharacterImage = slot.useCharacterImage !== false;
      const character =
        config.characters.find((c) => c.id === slot.characterId) || config.characters[0];
      const characterImages =
        useCharacterImage && character
          ? getCharacterImagesForRandomMode(character, slot.randomImagesEnabled === true)
          : [];

      const characterPrepared = characterImages.length
        ? await Promise.all(characterImages.map((image) => prepareShopeeImageInput(image)))
        : [];
      const productPrepared = await prepareShopeeImageInput(target.imageUrl);
      const images = buildShopeeVideoImages(characterPrepared, productPrepared);
      const prompt = config.splitPrompt
        ? resolveEffectiveSlotPrompt(config, slotIndex) ||
          target.prompt?.trim() ||
          buildActivePromptFromConfig(config)
        : target.prompt?.trim() || buildActivePromptFromConfig(config);

      const result = await shopeeVideoJob.run({
        url: "/api/app/generation-shopee-video/",
        body: {
          prompt,
          images,
          ...(characterPrepared[0] ? { characterImage: characterPrepared[0] } : {}),
          productImage: productPrepared,
          videosPerJob: 1,
          variantCount: 1,
          videoModel: slot.videoModel || config.videoModel,
          config: {
            prompt,
            aspectRatio: "9:16",
            videosPerJob: 1,
            variantCount: 1,
            videoModel: slot.videoModel || config.videoModel,
            videoMode: "component",
          },
          _metadata: {
            threadId: target.id,
            shopName: target.shopName,
            productName: target.productName,
            slotIndex,
          },
        },
        cancelOnUnmount: false,
        onJobEnqueued: (jobId) => {
          activeJobIdsRef.current[itemId] = jobId;
        },
        onProgress: (_pct, msg) => {
          if (msg) onAddLog(msg, "info", itemId);
        },
      });

      const fromUris = ((result.data.videoUris?.length ? result.data.videoUris : []) as string[])
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      const singleUri = String(result.data.videoUri || "").trim();
      const newUri = fromUris[0] || singleUri;
      if (!newUri) throw new Error(t("Không nhận được video"));

      const nextUrls = Array.from({ length: slotCount }, (_, i) =>
        i === slotIndex ? newUri : String(target.videoUrls?.[i] || "").trim()
      );
      const nextDisabled = Array.from({ length: slotCount }, (_, i) =>
        Boolean(target.videoDisabled?.[i])
      );
      const flow2RequestId = String(result.data.flow2RequestId || "").trim();
      const nextFlow2Ids = Array.from({ length: slotCount }, (_, i) =>
        i === slotIndex ? flow2RequestId : String(target.videoFlow2RequestIds?.[i] || "").trim()
      );
      const nextSlotErrors = Array.from({ length: slotCount }, (_, i) =>
        i === slotIndex ? "" : String(target.videoSlotErrors?.[i] || "").trim()
      );
      const nextSlotStatuses = Array.from({ length: slotCount }, (_, i) => {
        if (i === slotIndex) return "success" as const;
        const prev = target.videoSlotStatuses?.[i];
        if (prev) return prev;
        return String(nextUrls[i] || "").trim() ? ("success" as const) : ("pending" as const);
      });
      const filledCount = nextUrls.filter(Boolean).length;

      await patchItem(itemId, {
        videoUrls: nextUrls,
        videoDisabled: nextDisabled,
        videoFlow2RequestIds: nextFlow2Ids,
        videoSlotErrors: nextSlotErrors,
        videoSlotStatuses: nextSlotStatuses,
        uploaded: filledCount,
        pending: Math.max(slotCount - filledCount, 0),
        status: "success" as ThreadStatus,
        error: "",
        countdown: 0,
        mergedVideoUrl: "",
      });
      finished = true;
      autoMergeAttemptedRef.current[itemId] = false;

      await persistProductVideosWithEnrichment(
        getMergedVideoStorageKey(target, sessionId),
        nextUrls
      );

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
              slotErrors: nextSlotErrors,
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
        const msg = getTaskErrorMessage(err, t("Tạo lại video thất bại"));
        console.error(err);
        toast.error(msg);
        onAddLog(
          t("Tạo lại video {{n}} thất bại: {{msg}}", {
            n: slotIndex + 1,
            msg,
          }),
          "error",
          itemId
        );
        setVideoPreview((prev) => {
          if (prev?.kind !== "variants" || prev.itemId !== itemId) return prev;
          const slotErrors = [...prev.slotErrors];
          while (slotErrors.length <= slotIndex) slotErrors.push("");
          slotErrors[slotIndex] = msg;
          return { ...prev, slotErrors };
        });

        const latest =
          (await getThreadItem(sessionId, itemId)) ||
          itemsRef.current.find((i) => i.id === itemId) ||
          target;
        const { statuses: errStatuses, errors: errSlotErrors } = buildSlotArrays(latest);
        errStatuses[slotIndex] = "error";
        errSlotErrors[slotIndex] = msg;
        await patchItem(itemId, {
          videoSlotStatuses: errStatuses,
          videoSlotErrors: errSlotErrors,
          error: t("Video - {{n}} lỗi: {{msg}}", { n: slotIndex + 1, msg }),
        });
        finished = true;
      }
    } finally {
      delete activeJobIdsRef.current[itemId];
      if (manageGeneratingState) {
        setGeneratingIds((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
      setVideoPreview((prev) => {
        if (prev?.kind !== "variants" || prev.itemId !== itemId) return prev;
        const regenerating = { ...prev.regenerating };
        delete regenerating[slotIndex];
        return { ...prev, regenerating };
      });
      if (!finished) {
        const latest = await getThreadItem(sessionId, itemId);
        if (latest?.videoSlotStatuses?.[slotIndex] === "running") {
          const { statuses, errors } = buildSlotArrays(latest);
          statuses[slotIndex] = "pending";
          await patchItem(itemId, { videoSlotStatuses: statuses, videoSlotErrors: errors });
        }
      }
    }
  };

  const regenerateAllFailedSlots = async (
    itemId: string,
    mode: "error" | "pending" | "all-empty" = "all-empty"
  ) => {
    const preview = videoPreview;
    if (preview?.kind !== "variants" || preview.itemId !== itemId) return;
    const previewItem =
      visibleItems.find((i) => i.id === itemId) || items.find((i) => i.id === itemId);
    const emptyIndexes = preview.slots
      .map((s, idx) => (!String(s || "").trim() ? idx : -1))
      .filter((idx) => idx >= 0);
    const resolveTabStatus = (tabIdx: number): VideoSlotStatus => {
      const url = String(preview.slots[tabIdx] || "").trim();
      if (url) return "success";
      if (!previewItem) return "pending";
      return resolveVideoSlotDisplayStatus(previewItem, tabIdx, {
        isGenerating: Boolean(generatingIds[itemId]),
      });
    };
    const indexes =
      mode === "all-empty"
        ? emptyIndexes
        : emptyIndexes.filter((idx) =>
            mode === "error"
              ? resolveTabStatus(idx) === "error"
              : resolveTabStatus(idx) === "pending" || resolveTabStatus(idx) === "running"
          );
    if (!indexes.length) {
      toast.warn(
        mode === "error"
          ? t("Không có tab lỗi")
          : mode === "pending"
          ? t("Không có video chưa tạo")
          : t("Không có tab lỗi")
      );
      return;
    }
    setGeneratingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      for (const idx of indexes) {
        await regenerateVariantSlot(itemId, idx, { manageGeneratingState: false });
      }
    } finally {
      setGeneratingIds((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
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
            <div
              className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium"
              style={(() => {
                const enabled = genConfig?.splitPrompt
                  ? getSlotCharacterPreviews(genConfig).some((s) => s.enabled)
                  : genConfig?.useCharacterImage !== false;
                return enabled
                  ? { backgroundColor: "#eef2ff", borderColor: "#a5b4fc", color: "#4338ca" }
                  : { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#64748b" };
              })()}
              title={
                genConfig?.splitPrompt
                  ? ((genConfig && getSlotCharacterPreviews(genConfig).some((s) => s.enabled)
                      ? t("Tách Prompt — bật/tắt ảnh nhân vật cho tất cả Video - N")
                      : t("Tách Prompt — đang tắt ảnh nhân vật mọi tab")) as string)
                  : genConfig?.useCharacterImage === false
                  ? (t("Đang tắt — generate chỉ dùng ảnh sản phẩm") as string)
                  : (t("Đang bật — generate kèm ảnh nhân vật") as string)
              }
            >
              <span className="whitespace-nowrap">{t("Ảnh nhân vật")}</span>
              <Switch
                size="sm"
                dependent
                value={
                  genConfig?.splitPrompt
                    ? getSlotCharacterPreviews(genConfig).some((s) => s.enabled)
                    : genConfig?.useCharacterImage !== false
                }
                onChange={(value) => {
                  void (async () => {
                    try {
                      const base = genConfig || (await loadGenerateVideoConfig());
                      const on = Boolean(value);
                      const slots = ensureVideoSlots(base).map((slot) => ({
                        ...slot,
                        useCharacterImage: on,
                      }));
                      const next = {
                        ...base,
                        useCharacterImage: on,
                        videoSlots: slots,
                      };
                      const saved = await saveGenerateVideoConfig(next);
                      setGenConfig(saved);
                      setCharacterPreview(getCharacterPreview(saved));
                      onAddLog(
                        on
                          ? base.splitPrompt
                            ? t("Đã bật ảnh nhân vật cho tất cả Video (Tách Prompt)")
                            : t("Đã bật dùng ảnh nhân vật khi generate")
                          : base.splitPrompt
                          ? t("Đã tắt ảnh nhân vật mọi Video — chỉ dùng ảnh sản phẩm")
                          : t("Đã tắt ảnh nhân vật — chỉ dùng ảnh sản phẩm"),
                        "info"
                      );
                    } catch (err: any) {
                      toast.error(err?.message || t("Không lưu được cấu hình"));
                    }
                  })();
                }}
              />
            </div>
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
            {/* Filter tabs */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3 pb-1">
              {(
                [
                  { key: "all", label: t("Tất cả"), count: stats.total },
                  {
                    key: "waiting",
                    label: t("Chờ"),
                    count: stats.waiting,
                    color: "text-cyan-700 bg-cyan-50 border-cyan-200",
                  },
                  {
                    key: "uploading",
                    label: t("Đang upload"),
                    count: stats.uploading,
                    color: "text-blue-700 bg-blue-50 border-blue-200",
                  },
                  {
                    key: "success",
                    label: t("Thành công"),
                    count: stats.success,
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    key: "error",
                    label: t("Lỗi"),
                    count: stats.error,
                    color: "text-danger bg-danger/10 border-danger/30",
                  },
                ] as { key: typeof filterBucket; label: string; count: number; color?: string }[]
              ).map(({ key, label, count, color }) => {
                const isActive = filterBucket === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterBucket(key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                      isActive
                        ? color
                          ? color + " ring-1 ring-offset-0 ring-current opacity-100"
                          : "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    {label}
                    <span
                      className={`text-[10px] font-bold ${isActive ? "opacity-80" : "opacity-60"}`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

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
                placeholder={t("Tìm tên shop / tên sản phẩm / Id sản phẩm...") as string}
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
                    <th className={`${panelListClasses.th} w-28 text-center`}>
                      {t("Ảnh sản phẩm")}
                    </th>
                    <th className={`${panelListClasses.th} min-w-[11rem] text-center`}>
                      {t("Ảnh nhân vật")}
                    </th>
                    <th className={`${panelListClasses.th} min-w-[140px] text-center`}>
                      {t("Video")}
                    </th>
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
                    const productUrl = String(item.productLink || "").trim();
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
                              {productUrl ? (
                                <a
                                  href={productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block flex-1 min-w-0 text-sky-600 truncate hover:text-sky-800 hover:underline"
                                  title={
                                    item.productName
                                      ? `${item.productName}\n${productUrl}`
                                      : productUrl
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.productName || "—"}
                                </a>
                              ) : (
                                <span
                                  className="block flex-1 min-w-0 text-gray-600 truncate"
                                  title={item.productName || undefined}
                                >
                                  {item.productName || "—"}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openEdit(item, "productName")}
                                className="text-sky-500 shrink-0 hover:text-sky-700"
                              >
                                <HiPencil className="text-xs" />
                              </button>
                            </div>
                            <div
                              className="font-mono text-[11px] text-gray-400 truncate"
                              title={item.productId || undefined}
                            >
                              {item.productId
                                ? `${t("Id SP")}: ${item.productId}`
                                : `${t("Id SP")}: —`}
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
                            {(() => {
                              const slotPreviews = genConfig
                                ? getSlotCharacterPreviews(genConfig)
                                : [];
                              const showSplit =
                                Boolean(genConfig?.splitPrompt) && slotPreviews.length > 1;
                              const hasAnyUrl = slotPreviews.some((s) => s.urls.length > 0);

                              if (!hasAnyUrl) {
                                return (
                                  <>
                                    <div
                                      className="flex justify-center items-center w-16 h-16 text-gray-400 bg-gray-100 rounded-lg border border-gray-200"
                                      title={
                                        slotPreviews.every((s) => !s.enabled)
                                          ? t("Đã tắt dùng ảnh nhân vật")
                                          : t("Chưa có ảnh nhân vật trong config")
                                      }
                                    >
                                      <HiOutlinePhotograph className="text-xl" />
                                    </div>
                                    {slotPreviews.every((s) => !s.enabled) ? (
                                      <span className="text-10 text-gray-400">{t("Đã tắt")}</span>
                                    ) : null}
                                  </>
                                );
                              }

                              if (!showSplit) {
                                const single = slotPreviews[0] || {
                                  urls: characterPreview.urls,
                                  name: characterPreview.name,
                                  enabled: genConfig?.useCharacterImage !== false,
                                };
                                return (
                                  <>
                                    <div className="flex flex-wrap justify-center gap-1">
                                      {single.urls.map((url, imageIdx) => (
                                        <button
                                          key={`${url}-${imageIdx}`}
                                          type="button"
                                          onClick={() => setZoomImage(url)}
                                          title={single.name || t("Ảnh nhân vật từ config")}
                                          className="rounded-lg border border-gray-200 transition-colors hover:border-sky-400"
                                        >
                                          <img
                                            src={url}
                                            alt={single.name || t("Ảnh nhân vật")}
                                            className={`cursor-zoom-in rounded-lg object-cover ${
                                              single.urls.length > 1 ? "h-8 w-8" : "h-16 w-16"
                                            }`}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                    {single.name && single.enabled !== false ? (
                                      <span
                                        className="max-w-[88px] truncate text-10 text-gray-500"
                                        title={single.name}
                                      >
                                        {single.name}
                                      </span>
                                    ) : null}
                                  </>
                                );
                              }

                              // Tách Prompt: hiện ảnh theo từng Video - N — 1 hàng, tự xuống dòng khi hẹp
                              return (
                                <div className="flex flex-wrap justify-start gap-1.5 w-full min-w-0">
                                  {slotPreviews.map((slot) => {
                                    const thumbs = slot.randomEnabled
                                      ? slot.urls.slice(0, 6)
                                      : slot.urls.slice(0, 1);
                                    const imgCount = slot.urls.length;
                                    return (
                                      <div
                                        key={slot.slotIndex}
                                        className="flex gap-1 items-center shrink-0 rounded-lg border border-gray-300 bg-gray-50 px-1 py-1 text-gray-900"
                                        title={
                                          !slot.enabled
                                            ? t("Video - {{n}}: đã tắt ảnh nhân vật", {
                                                n: slot.slotIndex + 1,
                                              })
                                            : slot.randomEnabled
                                            ? t(
                                                "Video - {{n}}: {{name}} — ảnh ngẫu nhiên ({{count}} ảnh gửi generate)",
                                                {
                                                  n: slot.slotIndex + 1,
                                                  name: slot.name || "",
                                                  count: imgCount,
                                                }
                                              )
                                            : slot.name
                                            ? t("Video - {{n}}: {{name}}", {
                                                n: slot.slotIndex + 1,
                                                name: slot.name,
                                              })
                                            : t("Video - {{n}}", { n: slot.slotIndex + 1 })
                                        }
                                      >
                                        <span className="w-7 shrink-0 text-12 font-bold text-gray-900">
                                          V{slot.slotIndex + 1}
                                        </span>
                                        {thumbs.length ? (
                                          <div className="flex flex-1 flex-wrap gap-0.5">
                                            {thumbs.map((thumb, ti) => (
                                              <button
                                                key={`${slot.slotIndex}-${ti}`}
                                                type="button"
                                                onClick={() => setZoomImage(thumb)}
                                                className="rounded border border-gray-200 transition-colors hover:border-sky-400"
                                              >
                                                <img
                                                  src={thumb}
                                                  alt={slot.name || t("Ảnh nhân vật")}
                                                  className="h-8 w-8 cursor-zoom-in rounded object-cover"
                                                />
                                              </button>
                                            ))}
                                            {slot.randomEnabled && imgCount > thumbs.length ? (
                                              <span className="inline-flex h-8 items-center rounded bg-pink-50 px-1 text-9 font-semibold text-pink-700">
                                                +{imgCount - thumbs.length}
                                              </span>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-400">
                                            <HiOutlinePhotograph className="text-sm" />
                                          </div>
                                        )}
                                        <span
                                          className={`shrink-0 text-[9px] font-semibold ${
                                            slot.randomEnabled
                                              ? imgCount > 1
                                                ? "text-amber-700"
                                                : "text-danger"
                                              : "text-gray-400"
                                          }`}
                                        >
                                          {slot.randomEnabled
                                            ? imgCount > 1
                                              ? t("{{n}} ảnh", { n: imgCount })
                                              : t("1 ảnh")
                                            : null}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
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
                                const hasVideos = (item.videoUrls || []).some((u) =>
                                  String(u || "").trim()
                                );
                                const filled = filledUrls.length;
                                const slotCount = Math.max(
                                  item.videoUrls?.length || 0,
                                  item.videoSlotStatuses?.length || 0,
                                  genConfig?.splitPrompt
                                    ? Math.min(4, genConfig?.videosPerJob || 1)
                                    : 0,
                                  0
                                );
                                const configTotal = Math.max(
                                  1,
                                  Math.min(
                                    4,
                                    genConfig?.videosPerJob ||
                                      item.videoUrls?.length ||
                                      (genConfig?.splitPrompt
                                        ? item.videoSlotStatuses?.length
                                        : 0) ||
                                      1
                                  )
                                );
                                // UI theo cấu hình hiện tại — không dựa videoSlotStatuses cũ (task gen khi Tách Prompt).
                                const showSplitSlots = Boolean(genConfig?.splitPrompt);

                                // Tách Prompt: mỗi Video - N một icon riêng (giống icon không tách)
                                if (showSplitSlots && (isGenerating || slotCount > 0)) {
                                  const statuses = Array.from(
                                    { length: Math.max(slotCount, configTotal) },
                                    (_, i) =>
                                      resolveVideoSlotDisplayStatus(item, i, { isGenerating })
                                  );
                                  const errors = item.videoSlotErrors || [];
                                  return (
                                    <div className="flex flex-wrap gap-1.5 justify-center max-w-[9.5rem]">
                                      {statuses.map((st, i) => {
                                        const err = String(errors[i] || "").trim();
                                        const done = st === "success";
                                        const failed = st === "error";
                                        const running = st === "running";
                                        const pending = !done && !failed && !running;
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => void openVariantPreview(item, i)}
                                            title={
                                              failed
                                                ? t("Video - {{n}} lỗi — bấm xem / tạo lại{{msg}}", {
                                                    n: i + 1,
                                                    msg: err ? `: ${err}` : "",
                                                  })
                                                : running
                                                ? t("Video - {{n}} đang generate — bấm xem tiến độ", {
                                                    n: i + 1,
                                                  })
                                                : done
                                                ? t("Video - {{n}} xong — bấm xem", {
                                                    n: i + 1,
                                                  })
                                                : t("Video - {{n}} chưa tạo — bấm xem / tạo lại", {
                                                    n: i + 1,
                                                  })
                                            }
                                            className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors cursor-pointer ${
                                              done
                                                ? "border-purple-500 bg-purple-500 text-white hover:border-purple-600 hover:bg-purple-600"
                                                : failed
                                                ? "border-danger bg-danger/10 text-danger hover:bg-danger/20"
                                                : running
                                                ? "border-purple-300 bg-purple-50 text-purple-600 hover:bg-purple-100"
                                                : "border-gray-300 bg-gray-200 text-gray-500 hover:bg-gray-100"
                                            }`}
                                          >
                                            {running ? (
                                              <RiLoader4Line className="text-xl animate-spin" />
                                            ) : (
                                              <FaPhotoVideo
                                                className={`text-lg ${
                                                  done
                                                    ? "text-white"
                                                    : failed
                                                    ? "text-danger"
                                                    : "text-gray-400"
                                                }`}
                                              />
                                            )}
                                            <span
                                              className={`absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                                                done
                                                  ? "bg-purple-700"
                                                  : failed
                                                  ? "bg-danger"
                                                  : running
                                                  ? "bg-purple-500"
                                                  : "bg-gray-400"
                                              }`}
                                            >
                                              V{i + 1}
                                            </span>
                                            {done ? (
                                              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-success shadow-sm ring-1 ring-success">
                                                <HiCheck className="text-[11px] font-bold" />
                                              </span>
                                            ) : null}
                                            {failed ? (
                                              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-danger shadow-sm ring-1 ring-danger">
                                                <HiOutlineX className="text-[11px] font-bold" />
                                              </span>
                                            ) : null}
                                            {pending ? (
                                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-gray-300">
                                                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                              </span>
                                            ) : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                if (isGenerating && !hasVideos) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => void openVariantPreview(item)}
                                      className="flex relative justify-center items-center w-9 h-9 text-purple-600 bg-purple-50 rounded-full border border-purple-300 shadow-sm cursor-pointer transition-colors hover:bg-purple-100"
                                      title={t("Đang tạo video... — bấm xem tiến độ")}
                                    >
                                      <RiLoader4Line className="text-xl animate-spin" />
                                      <span className="flex absolute -top-1 -left-1 justify-center items-center px-1 h-4 font-semibold text-white rounded-full min-w-4 bg-danger text-10 whitespace-nowrap">
                                        {filled}/{configTotal}
                                      </span>
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => void openVariantPreview(item)}
                                    className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors cursor-pointer ${
                                      hasVideos
                                        ? "text-white bg-purple-500 border-purple-500 hover:border-purple-600 hover:bg-purple-600"
                                        : "text-gray-500 bg-gray-200 border-gray-300 hover:bg-gray-100"
                                    }`}
                                    title={
                                      isGenerating
                                        ? t("Đang tạo video… {{filled}}/{{total}} — bấm xem", {
                                            filled,
                                            total: configTotal,
                                          })
                                        : hasVideos
                                        ? t("{{filled}}/{{total}} video — xem", {
                                            filled,
                                            total: configTotal,
                                          })
                                        : t("Chưa có video — bấm xem / tạo lại")
                                    }
                                  >
                                    {isGenerating ? (
                                      <RiLoader4Line className="text-xl text-white animate-spin" />
                                    ) : (
                                      <FaPhotoVideo
                                        className={`text-lg ${
                                          hasVideos ? "text-white" : "text-gray-400"
                                        }`}
                                      />
                                    )}
                                    {hasVideos || isGenerating ? (
                                      <span
                                        className={`flex absolute -top-1 -left-1 justify-center items-center px-1 h-4 font-semibold text-white rounded-full min-w-4 text-10 whitespace-nowrap ${
                                          filled !== configTotal ? "bg-danger" : "bg-purple-700"
                                        }`}
                                      >
                                        {filled}/{configTotal}
                                      </span>
                                    ) : null}
                                    {hasVideos && filled >= configTotal && !isGenerating ? (
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
                                          ? `${t("Nối lại")}: ${item.error}${
                                              getRetryCounterLabel(item)
                                                ? ` (${getRetryCounterLabel(item)})`
                                                : ""
                                            }`
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
                                title={
                                  getRetryCounterLabel(item)
                                    ? `${item.error} (${getRetryCounterLabel(item)})`
                                    : item.error
                                }
                              >
                                {item.error}
                                {getRetryCounterLabel(item)
                                  ? ` (${getRetryCounterLabel(item)})`
                                  : ""}
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
                              hasMergedVideoRef(item.mergedVideoUrl) || hasVariantVideoUrls(item);
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
        onClose={() => {
          setGenerateConfigOpen(false);
          // Sync lại cột Ảnh nhân vật sau khi chỉnh profile (vd. bật Ảnh ngẫu nhiên)
          void loadGenerateVideoConfig()
            .then((config) => {
              setGenConfig(config);
              setCharacterPreview(getCharacterPreview(config));
            })
            .catch((err) => console.warn("[generate-video] reload config after dialog close", err));
        }}
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
            <div
              className="overflow-auto rounded-lg border border-gray-100"
              style={{ maxHeight: 420 }}
            >
              <table className="w-full text-xs text-left table-fixed">
                <thead className="sticky top-0 text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 w-24 font-semibold">{t("Thời gian")}</th>
                    <th className="px-3 py-2 w-28 font-semibold">{t("Tên")}</th>
                    <th className="px-3 py-2 w-28 font-semibold">{t("Domain")}</th>
                    <th className="px-3 py-2 w-36 font-semibold">{t("Keyword")}</th>
                    <th className="px-3 py-2 w-12 font-semibold">{t("SP")}</th>
                    <th className="px-3 py-2 w-20 font-semibold">{t("Thực hiện")}</th>
                    <th className="px-3 py-2 w-52 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {scrapeSessions.map((s) => {
                    const busy = importingSessionId === s.id;
                    const keywordText = String(s.keyword || "").trim() || "—";
                    return (
                      <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatSessionTime(s.createdAt)}
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <div
                            className="truncate font-semibold text-gray-800"
                            title={sessionDisplayName(s)}
                          >
                            {sessionDisplayName(s)}
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <div className="truncate" title={s.marketHost}>
                            {domainLabel(s.marketHost)}
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-0 w-36">
                          {/* Chỉ keyword scroll ngang trong khung cột — không đẩy layout bảng */}
                          <div
                            className="overflow-x-auto max-w-full min-w-0 whitespace-nowrap text-gray-700"
                            style={{ scrollbarWidth: "thin" }}
                            title={keywordText === "—" ? undefined : keywordText}
                          >
                            {keywordText}
                          </div>
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
                          <p className="m-0 max-w-[320px] break-words text-xs leading-relaxed text-white/60">
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
                const previewItem =
                  visibleItems.find((i) => i.id === videoPreview.itemId) ||
                  items.find((i) => i.id === videoPreview.itemId);
                const slotErrorMsg = isFailed
                  ? resolveVariantSlotErrorMessage(previewItem, idx, videoPreview.slotErrors || [])
                  : "";
                const slotDisplayStatus = previewItem
                  ? resolveVideoSlotDisplayStatus(previewItem, idx, {
                      isGenerating: Boolean(generatingIds[videoPreview.itemId]),
                    })
                  : "pending";
                const isSlotRunning = isFailed && slotDisplayStatus === "running";
                const isSlotError = isFailed && slotDisplayStatus === "error";
                const resolveTabStatus = (tabIdx: number): VideoSlotStatus => {
                  const url = String(videoPreview.slots[tabIdx] || "").trim();
                  if (url) return "success";
                  if (!previewItem) return "pending";
                  return resolveVideoSlotDisplayStatus(previewItem, tabIdx, {
                    isGenerating: Boolean(generatingIds[videoPreview.itemId]),
                  });
                };
                const emptyTabIndexes = videoPreview.slots
                  .map((s, i) => (!String(s || "").trim() ? i : -1))
                  .filter((i) => i >= 0);
                const errorTabCount = emptyTabIndexes.filter(
                  (i) => resolveTabStatus(i) === "error"
                ).length;
                const pendingTabCount = emptyTabIndexes.filter((i) => {
                  const st = resolveTabStatus(i);
                  return st === "pending" || st === "running";
                }).length;
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
                          {isSlotRunning ? (
                            <>
                              <RiLoader4Line className="text-3xl text-purple-300 animate-spin" />
                              <p className="m-0 text-sm font-semibold text-white">
                                {t("Video {{n}} đang generate…", { n: idx + 1 })}
                              </p>
                              <p className="m-0 text-xs text-white/60">
                                {t("Chờ slot xong hoặc bấm Tạo lại nếu bị kẹt")}
                              </p>
                              <button
                                type="button"
                                disabled={anyRegen}
                                onClick={() => void regenerateVariantSlot(videoPreview.itemId, idx)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400 bg-purple-500/20 px-3.5 py-2 text-xs font-semibold text-purple-200 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
                              >
                                <HiRefresh className="text-sm" />
                                {t("Tạo lại")}
                              </button>
                            </>
                          ) : isSlotError ? (
                            <>
                              <div className="flex justify-center items-center w-12 h-12 rounded-full bg-danger/20 text-danger">
                                <HiRefresh className="text-xl" />
                              </div>
                              <div>
                                <p className="m-0 text-sm font-semibold text-white">
                                  {t("Video {{n}} lỗi", { n: idx + 1 })}
                                </p>
                                {slotErrorMsg ? (
                                  <>
                                    <p className="m-0 mt-2 max-w-[320px] break-words text-xs leading-relaxed text-red-300">
                                      {slotErrorMsg}
                                    </p>
                                    <p className="m-0 mt-2 text-xs text-white/60">
                                      {t("Tạo lại để gắn kết quả vào tab này")}
                                    </p>
                                  </>
                                ) : (
                                  <p className="m-0 mt-1 text-xs text-white/60">
                                    {t("Tạo lại để gắn kết quả vào tab này")}
                                  </p>
                                )}
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
                            </>
                          ) : (
                            <>
                              <div className="flex justify-center items-center w-12 h-12 rounded-full bg-gray-500/30 text-gray-300">
                                <FaPhotoVideo className="text-xl" />
                              </div>
                              <div>
                                <p className="m-0 text-sm font-semibold text-white">
                                  {t("Video {{n}} chưa tạo", { n: idx + 1 })}
                                </p>
                                <p className="m-0 mt-1 text-xs text-white/60">
                                  {t("Bấm Tạo video để generate cho tab này")}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={anyRegen}
                                onClick={() => void regenerateVariantSlot(videoPreview.itemId, idx)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
                              >
                                <HiPlay className="text-sm" />
                                {t("Tạo video")}
                              </button>
                            </>
                          )}
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

                    <div className="flex flex-wrap gap-2 justify-center items-center">
                      {!isFailed ? (
                        <>
                          {(() => {
                            const previewItem =
                              visibleItems.find((i) => i.id === videoPreview.itemId) ||
                              items.find((i) => i.id === videoPreview.itemId);
                            const remoteUri = String(previewItem?.videoUrls?.[idx] || "").trim();
                            const flow2RequestId = String(
                              previewItem?.videoFlow2RequestIds?.[idx] || ""
                            ).trim();
                            const downloadVideo = {
                              videoUri: remoteUri || src,
                              flow2RequestId: flow2RequestId || undefined,
                              mimeType: "video/mp4",
                            };
                            const baseName =
                              (previewItem && buildMergedVideoFileBase(previewItem)) ||
                              previewItem?.productId ||
                              videoPreview.itemId;
                            const fileName =
                              videoPreview.slots.length > 1
                                ? `${baseName}-v${idx + 1}.mp4`
                                : `${baseName}.mp4`;
                            return (
                              <GeneratedVideoDownloadButtons
                                video={downloadVideo}
                                fileName={fileName}
                                disabled={anyRegen}
                              />
                            );
                          })()}
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
                      {errorTabCount > 0 ? (
                        <button
                          type="button"
                          disabled={anyRegen}
                          onClick={() => void regenerateAllFailedSlots(videoPreview.itemId, "error")}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger bg-danger/10 px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                        >
                          <HiRefresh className="text-sm" />
                          {t("Tạo lại tất cả tab lỗi")} ({errorTabCount})
                        </button>
                      ) : null}
                      {pendingTabCount > 0 ? (
                        <button
                          type="button"
                          disabled={anyRegen}
                          onClick={() => void regenerateAllFailedSlots(videoPreview.itemId, "pending")}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-purple-400 bg-purple-500/10 px-3 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
                        >
                          <HiPlay className="text-sm" />
                          {t("Tạo tất cả video chưa có")} ({pendingTabCount})
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {videoPreview.slots.map((slot, tabIdx) => {
                        const active = tabIdx === videoPreview.index;
                        const tabStatus = resolveTabStatus(tabIdx);
                        const disabled = Boolean(videoPreview.disabled[tabIdx]);
                        const regen = Boolean(videoPreview.regenerating[tabIdx]);
                        const tabClass =
                          tabStatus === "success"
                            ? active
                              ? "border-green-600 bg-green-500 text-white shadow-sm ring-2 ring-green-200"
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700"
                            : tabStatus === "error"
                            ? active
                              ? "border-danger bg-danger text-white shadow-sm ring-2 ring-red-200"
                              : "border-danger/60 bg-danger/10 text-danger hover:bg-danger/20"
                            : tabStatus === "running"
                            ? active
                              ? "border-purple-500 bg-purple-500 text-white shadow-sm ring-2 ring-purple-200"
                              : "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
                            : active
                            ? "border-gray-500 bg-gray-500 text-white shadow-sm ring-2 ring-gray-300"
                            : "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200";
                        return (
                          <button
                            key={`vp-${tabIdx}`}
                            type="button"
                            onClick={() =>
                              setVideoPreview((prev) =>
                                prev?.kind === "variants" ? { ...prev, index: tabIdx } : prev
                              )
                            }
                            className={`relative min-w-[72px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${tabClass} ${
                              disabled && tabStatus === "success" ? "opacity-55 line-through" : ""
                            }`}
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
                            {disabled && tabStatus === "success" ? (
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
