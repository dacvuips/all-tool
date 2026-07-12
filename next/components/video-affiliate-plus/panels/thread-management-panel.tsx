import { useEffect, useMemo, useRef, useState } from "react";
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
  HiPencil,
  HiPlay,
  HiRefresh,
} from "react-icons/hi";
import { RiFileExcel2Line, RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { useMediaGenerationJob } from "../../../lib/hooks/useMediaGenerationJob";
import { useToast } from "../../../lib/providers/toast-provider";
import { zipAndDownload } from "../../app/affiliate-video/shared/batchDownloadMedia";
import { SceneHistoryDropdown } from "../../app/affiliate-video/shared/scene-history-dropdown";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Button, Field, Form, Input, Switch } from "../../shared/utilities/form";
import { exportAffiliatePlusCSV, parseAffiliatePlusExcel } from "../csv-parser";
import { formatImportHistoryOption, ImportHistoryItem } from "../import-history";
import {
  getMergedVideoBlob,
  getMergedVideoStorageKey,
  mergeVideosToIndexedDb,
  persistProductVideosWithEnrichment,
  removeMergedVideoFromIndexedDb,
  resolveMergedPreviewUrl,
  resolveVariantPreviewUrls,
} from "../merged-video";
import { prepareShopeeImageInput } from "../shopee-image";
import { loadGenerateVideoConfig } from "../storage";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  buildActivePromptFromConfig,
  CharacterProfile,
  GenerateVideoConfig,
  getMergeableVideoUrls,
  padVideoSlots,
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
  const url =
    character.images[character.previewPose] ||
    character.images.fashion ||
    character.images.standing ||
    character.images.sitting ||
    "";
  return {
    url,
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
  onClearHistory,
  onAddLog,
}: ThreadManagementPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [editField, setEditField] = useState<EditField>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [generateConfigOpen, setGenerateConfigOpen] = useState(false);
  const [genConfig, setGenConfig] = useState<GenerateVideoConfig | null>(null);
  const [characterPreview, setCharacterPreview] = useState<{ url: string; name: string }>({
    url: "",
    name: "",
  });
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Record<string, boolean>>({});
  const [mergingIds, setMergingIds] = useState<Record<string, boolean>>({});
  const [downloadingMerged, setDownloadingMerged] = useState(false);
  const pauseAllRef = useRef(false);
  const shopeeVideoJob = useMediaGenerationJob<{
    videoUri?: string | null;
    videoUris?: string[];
    mimeType?: string;
  }>();

  const openVideoPreviewMerged = (title: string, itemId: string, urls: string[]) => {
    const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
    if (!clean.length) return;
    setVideoPreview({ kind: "merged", title, itemId, urls: clean, index: 0 });
  };

  /** Preview variant: đủ số tab = config; slot trống = lỗi (tab đỏ). */
  const openVariantPreview = async (item: AffiliatePlusItem) => {
    const config = genConfig || (await loadGenerateVideoConfig());
    const slotCount = Math.max(
      item.videoUrls?.length || 0,
      config.videosPerJob || 1,
      1
    );
    const slots = await resolveVariantPreviewUrls(item, slotCount);
    const paddedSlots = Array.from({ length: slotCount }, (_, i) => slots[i] || "");
    const disabled = Array.from({ length: slotCount }, (_, i) =>
      Boolean(item.videoDisabled?.[i])
    );
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

  /** Preview video đã nối: ưu tiên base64 IDB, fallback blob URL trên item. */
  const openMergedPreview = async (item: AffiliatePlusItem) => {
    const fromIdb = await resolveMergedPreviewUrl(item);
    const url = fromIdb || item.mergedVideoUrl || "";
    if (!url) return;
    openVideoPreviewMerged(t("Video đã nối"), item.id, [url]);
  };

  const autoMergeAttemptedRef = useRef<Record<string, boolean>>({});

  // Tự nối lại các item đã có ≥2 video (sau khi bỏ slot disable/trống) nhưng chưa có merged
  useEffect(() => {
    const pending = items.filter((i) => {
      const mergeUrls = getMergeableVideoUrls(i);
      return (
        mergeUrls.length >= 2 &&
        !i.mergedVideoUrl &&
        !mergingIds[i.id] &&
        !generatingIds[i.id] &&
        !autoMergeAttemptedRef.current[i.id]
      );
    });
    if (!pending.length) return;

    let cancelled = false;
    (async () => {
      for (const item of pending) {
        if (cancelled) return;
        autoMergeAttemptedRef.current[item.id] = true;
        setMergingIds((prev) => ({ ...prev, [item.id]: true }));
        try {
          const urls = getMergeableVideoUrls(item);
          const mergedUrl = await mergeVideosToIndexedDb(getMergedVideoStorageKey(item), urls);
          if (cancelled) return;
          onUpdateItems(
            itemsRef.current.map((i) =>
              i.id === item.id ? { ...i, mergedVideoUrl: mergedUrl, error: "" } : i
            )
          );
          onAddLog(t("Đã nối video và lưu IndexedDB"), "success", item.id);
        } catch (err: any) {
          if (cancelled) return;
          const msg = err?.message || t("Nối video thất bại");
          onUpdateItems(itemsRef.current.map((i) => (i.id === item.id ? { ...i, error: msg } : i)));
          onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", item.id);
        } finally {
          setMergingIds((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
    const total = items.length;
    const waiting = items.filter(
      (i) => i.status === "waiting" || (i.status === "stopped" && i.pending > 0)
    ).length;
    const uploading = items.filter(
      (i) => i.status === "uploading" || i.status === "running"
    ).length;
    const success = items.filter((i) => i.status === "success").length;
    // Lỗi hiển thị: status error hoặc có message error dưới cột Video
    const error = items.filter(
      (i) => i.status === "error" || Boolean(String(i.error || "").trim())
    ).length;
    return { total, waiting, uploading, success, error };
  }, [items]);

  const getErrorItems = (list: AffiliatePlusItem[]) =>
    list.filter((i) => i.status === "error" || Boolean(String(i.error || "").trim()));

  const selectedCount = items.filter((i) => i.selected).length;

  const updateItem = (id: string, patch: Partial<AffiliatePlusItem>) => {
    onUpdateItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const updateAll = (fn: (item: AffiliatePlusItem) => AffiliatePlusItem) => {
    onUpdateItems(items.map(fn));
  };

  const handleImport = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      // Dùng SheetJS cho cả csv/xls/xlsx để nhận đúng format Shopee
      const parsed = await parseAffiliatePlusExcel(buffer);

      if (!parsed.length) {
        toast.warn(
          t(
            "Không đọc được dữ liệu sản phẩm. Cần các cột: Tên shop, Tên sản phẩm, Ảnh, Link sản phẩm / Link affiliate"
          )
        );
        return;
      }

      const genConfig = await loadGenerateVideoConfig();
      const withPrompt = parsed.map((item) => ({
        ...item,
        prompt: item.prompt || genConfig.activePrompt || "",
      }));

      // Mỗi import = phiên mới: thay thế danh sách, không gắn thêm vào phiên hiện tại
      await onImportComplete(file.name, withPrompt);
      onAddLog(t("Đã import {{count}} luồng từ file", { count: withPrompt.length }), "success");
      toast.success(t("Đã import {{count}} sản phẩm", { count: withPrompt.length }));
    } catch (err) {
      console.error("Import affiliate file failed:", err);
      toast.error(t("Không thể đọc file. Thử lại với file .csv hoặc .xlsx từ Shopee Affiliate."));
    }
  };

  const handleRetryErrors = () => {
    const errorItems = getErrorItems(itemsRef.current);
    if (!errorItems.length) {
      toast.warn(t("Không có luồng lỗi"));
      return;
    }
    const ids = errorItems.map((i) => i.id);
    const idSet = new Set(ids);
    const cleared = itemsRef.current.map((i) =>
      idSet.has(i.id)
        ? { ...i, status: "waiting" as ThreadStatus, error: "", countdown: 0 }
        : i
    );
    itemsRef.current = cleared;
    onUpdateItems(cleared);
    onAddLog(t("Retry {{count}} luồng lỗi", { count: ids.length }), "warning");
    void handleStart(ids);
  };

  const handleDeleteErrorTasks = () => {
    const errorItems = getErrorItems(items);
    if (!errorItems.length) {
      toast.warn(t("Không có task lỗi"));
      return;
    }
    if (!confirm(t("Xóa {{count}} task lỗi?", { count: errorItems.length }))) return;
    const idSet = new Set(errorItems.map((i) => i.id));
    onUpdateItems(items.filter((i) => !idSet.has(i.id)));
    onAddLog(t("Đã xóa {{count}} task lỗi", { count: errorItems.length }), "warning");
  };

  const safeDownloadName = (raw: string, fallback: string) => {
    const cleaned = String(raw || "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 80) || fallback;
  };

  const handleDownloadAllMerged = async () => {
    if (downloadingMerged) return;
    const candidates = itemsRef.current.filter(
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
        const blob = await getMergedVideoBlob(item);
        if (!blob) continue;

        const base = safeDownloadName(
          item.productName || item.productId || item.shopName || item.id,
          "merged-video"
        );
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
    const currentItems = itemsRef.current;
    // Toolbar "Bắt Đầu": chỉ item switch = true. Nút Play từng dòng: theo ids.
    const targets = ids?.length
      ? currentItems.filter((i) => ids.includes(i.id))
      : currentItems.filter((i) => i.selected);
    if (!targets.length) {
      toast.warn(t("Chưa bật switch luồng nào để chạy"));
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

    const characterImage = getCharacterPreview(config).url;
    if (!characterImage) {
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
    const concurrency = Math.max(1, Math.min(50, Math.round(config.threadCount || 5)));
    onAddLog(
      t("Bắt đầu {{count}} luồng (song song {{n}})", {
        count: targets.length,
        n: concurrency,
      }),
      "info"
    );
    toast.success(t("Đã bắt đầu {{count}} luồng", { count: targets.length }));

    let characterPrepared;
    try {
      characterPrepared = await prepareShopeeImageInput(characterImage);
    } catch (err: any) {
      toast.error(t("Không xử lý được ảnh nhân vật: {{msg}}", { msg: err?.message || "" }));
      return;
    }

    let cursor = 0;
    const runOne = async (target: AffiliatePlusItem) => {
      if (pauseAllRef.current) return;

      setGeneratingIds((prev) => ({ ...prev, [target.id]: true }));
      onUpdateItems(
        itemsRef.current.map((i) =>
          i.id === target.id
            ? {
                ...i,
                status: "running" as ThreadStatus,
                error: "",
                countdown: 99999,
              }
            : i
        )
      );

      try {
        if (pauseAllRef.current) return;

        const productPrepared = await prepareShopeeImageInput(target.imageUrl);
        const images = [characterPrepared, productPrepared];

        const result = await shopeeVideoJob.run({
          url: "/api/app/generation-shopee-video/",
          body: {
            prompt: target.prompt?.trim() || prompt,
            images,
            characterImage: characterPrepared,
            productImage: productPrepared,
            videosPerJob: config!.videosPerJob,
            variantCount: config!.videosPerJob,
            videoModel: config!.videoModel,
            config: {
              prompt: target.prompt?.trim() || prompt,
              aspectRatio: "9:16",
              videosPerJob: config!.videosPerJob,
              variantCount: config!.videosPerJob,
              videoModel: config!.videoModel,
              videoMode: "component",
            },
            _metadata: {
              threadId: target.id,
              shopName: target.shopName,
              productName: target.productName,
            },
          },
          onProgress: (_pct, msg) => {
            if (msg) onAddLog(`${target.productName || target.id}: ${msg}`, "info", target.id);
          },
        });

        if (pauseAllRef.current) return;

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

        onUpdateItems(
          itemsRef.current.map((i) => {
            if (i.id !== target.id) return i;
            return {
              ...i,
              status: "success" as ThreadStatus,
              videoUrls,
              videoDisabled,
              uploaded: filledCount,
              pending: Math.max(slotCount - filledCount, 0),
              error: "",
              countdown: 0,
            };
          })
        );
        setGeneratingIds((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });

        // Lưu link IndexedDB ngay → enrich base64 chạy ngầm (giống affiliate-video)
        try {
          await persistProductVideosWithEnrichment(getMergedVideoStorageKey(target), videoUrls);
        } catch (persistErr) {
          console.warn("[persistProductVideosWithEnrichment]", persistErr);
        }

        let mergedUrl = "";
        const mergeUrls = videoUrls
          .map((u, idx) => ({ u, disabled: videoDisabled[idx] }))
          .filter((x) => x.u && !x.disabled)
          .map((x) => x.u);
        if (mergeUrls.length >= 2 && !pauseAllRef.current) {
          setMergingIds((prev) => ({ ...prev, [target.id]: true }));
          onAddLog(
            t("Đang nối {{count}} video...", { count: mergeUrls.length }),
            "info",
            target.id
          );
          try {
            mergedUrl = await mergeVideosToIndexedDb(getMergedVideoStorageKey(target), mergeUrls);
            if (!pauseAllRef.current) {
              onUpdateItems(
                itemsRef.current.map((i) =>
                  i.id === target.id ? { ...i, mergedVideoUrl: mergedUrl, error: "" } : i
                )
              );
              onAddLog(t("Đã nối video và lưu IndexedDB"), "success", target.id);
            }
          } catch (mergeErr: any) {
            console.error(mergeErr);
            const msg = mergeErr?.message || t("Nối video thất bại");
            onUpdateItems(
              itemsRef.current.map((i) => (i.id === target.id ? { ...i, error: msg } : i))
            );
            onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", target.id);
          } finally {
            setMergingIds((prev) => {
              const next = { ...prev };
              delete next[target.id];
              return next;
            });
          }
        }

        if (!pauseAllRef.current) {
          onAddLog(
            t("Hoàn tất video cho {{name}} ({{count}} file{{merged}})", {
              name: target.productName || target.shopName || target.id,
              count: filledCount || 1,
              merged: mergedUrl ? `, ${t("đã nối")}` : "",
            }),
            "success",
            target.id
          );
        }
      } catch (err: any) {
        if (pauseAllRef.current) return;
        console.error(err);
        onUpdateItems(
          itemsRef.current.map((i) =>
            i.id === target.id
              ? {
                  ...i,
                  status: "error" as ThreadStatus,
                  error: err?.message || t("Generate video thất bại"),
                  countdown: 0,
                }
              : i
          )
        );
        onAddLog(
          t("Lỗi generate video: {{msg}}", {
            msg: err?.message || "unknown",
          }),
          "error",
          target.id
        );
      } finally {
        setGeneratingIds((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
    };

    const workerCount = Math.min(concurrency, targets.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (!pauseAllRef.current) {
          const myIndex = cursor++;
          if (myIndex >= targets.length) return;
          await runOne(targets[myIndex]);
        }
      })
    );
  };

  const handlePause = (ids?: string[]) => {
    if (!ids?.length) {
      pauseAllRef.current = true;
      setGeneratingIds({});
      setMergingIds({});
      onUpdateItems(
        itemsRef.current.map((i) =>
          i.status === "running" || i.status === "uploading"
            ? { ...i, status: "stopped" as ThreadStatus, countdown: 0 }
            : i
        )
      );
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
    onUpdateItems(
      itemsRef.current.map((i) =>
        pausedIds.has(i.id) && (i.status === "running" || i.status === "uploading")
          ? { ...i, status: "stopped" as ThreadStatus, countdown: 0 }
          : i
      )
    );
    onAddLog(t("Tạm dừng luồng"), "warning");
    toast.success(t("Đã tạm dừng"));
  };

  const handleDeleteSelected = () => {
    const selected = items.filter((i) => i.selected);
    if (!selected.length) {
      toast.warn(t("Chưa chọn luồng nào"));
      return;
    }
    if (!confirm(t("Xóa {{count}} luồng đã chọn?", { count: selected.length }))) return;
    selected.forEach((i) => {
      if (i.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(i.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
      void removeMergedVideoFromIndexedDb(i);
    });
    onUpdateItems(items.filter((i) => !i.selected));
    onAddLog(t("Xóa {{count}} luồng", { count: selected.length }), "warning");
  };

  const handleDelete = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target?.mergedVideoUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(target.mergedVideoUrl);
      } catch {
        // ignore
      }
    }
    if (target) void removeMergedVideoFromIndexedDb(target);
    else void removeMergedVideoFromIndexedDb(id);
    onUpdateItems(items.filter((i) => i.id !== id));
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
    onUpdateItems(itemsRef.current.map((i) => (i.id === item.id ? { ...i, error: "" } : i)));
    try {
      // Revoke blob cũ nếu có
      if (item.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
      const mergedUrl = await mergeVideosToIndexedDb(getMergedVideoStorageKey(item), urls);
      onUpdateItems(
        itemsRef.current.map((i) =>
          i.id === item.id ? { ...i, mergedVideoUrl: mergedUrl, error: "" } : i
        )
      );
      autoMergeAttemptedRef.current[item.id] = true;
      onAddLog(t("Đã nối video và lưu IndexedDB"), "success", item.id);
      toast.success(t("Đã nối lại video"));

      // Cập nhật dialog nếu đang mở preview merged của item này
      setVideoPreview((prev) =>
        prev?.kind === "merged" && prev.itemId === item.id
          ? { ...prev, urls: [mergedUrl], index: 0 }
          : prev
      );
    } catch (err: any) {
      const msg = err?.message || t("Nối video thất bại");
      onUpdateItems(itemsRef.current.map((i) => (i.id === item.id ? { ...i, error: msg } : i)));
      onAddLog(t("Nối video thất bại: {{msg}}", { msg }), "error", item.id);
      toast.error(msg);
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
    const target = itemsRef.current.find((i) => i.id === itemId);
    if (!target) return;

    setVideoPreview((prev) =>
      prev?.kind === "variants" && prev.itemId === itemId
        ? { ...prev, regenerating: { ...prev.regenerating, [slotIndex]: true }, index: slotIndex }
        : prev
    );

    try {
      const config = genConfig || (await loadGenerateVideoConfig());
      const character = config.characters.find((c) => c.id === config.characterId) || config.characters[0];
      const characterImage =
        character?.images?.[character.previewPose] ||
        character?.images?.fashion ||
        character?.images?.standing ||
        character?.images?.sitting ||
        "";
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

      onUpdateItems(
        itemsRef.current.map((i) =>
          i.id === itemId
            ? {
                ...i,
                videoUrls: nextUrls,
                videoDisabled: nextDisabled,
                uploaded: filledCount,
                pending: Math.max(slotCount - filledCount, 0),
                status: "success" as ThreadStatus,
                error: "",
                // Reset merged — slot đổi thì cần nối lại
                mergedVideoUrl: "",
              }
            : i
        )
      );
      autoMergeAttemptedRef.current[itemId] = false;

      await persistProductVideosWithEnrichment(getMergedVideoStorageKey(target), nextUrls);

      const previewSlots = await resolveVariantPreviewUrls(
        { ...target, videoUrls: nextUrls },
        slotCount
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

      onAddLog(
        t("Đã tạo lại video {{n}}", { n: slotIndex + 1 }),
        "success",
        itemId
      );
      toast.success(t("Đã tạo lại Video {{n}}", { n: slotIndex + 1 }));
    } catch (err: any) {
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
    } finally {
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

  const toggleVariantDisabled = (itemId: string, slotIndex: number) => {
    const target = itemsRef.current.find((i) => i.id === itemId);
    if (!target) return;
    const slotCount = Math.max(target.videoUrls?.length || 0, slotIndex + 1, 1);
    const nextDisabled = Array.from({ length: slotCount }, (_, i) =>
      i === slotIndex ? !Boolean(target.videoDisabled?.[i]) : Boolean(target.videoDisabled?.[i])
    );
    onUpdateItems(
      itemsRef.current.map((i) =>
        i.id === itemId
          ? {
              ...i,
              videoDisabled: nextDisabled,
              // Cần nối lại sau khi đổi danh sách merge
              mergedVideoUrl: "",
            }
          : i
      )
    );
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
    updateAll((i) => ({ ...i, selected: checked }));
  };

  const handleSaveGenerateConfig = (config: GenerateVideoConfig, promptForAll: string) => {
    setGenConfig(config);
    setCharacterPreview(getCharacterPreview(config));
    onUpdateItems(items.map((i) => ({ ...i, prompt: promptForAll })));
    onAddLog(
      t("Đã áp dụng prompt generate video cho {{count}} luồng", { count: items.length }),
      "success"
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: t("Tổng"), value: stats.total, color: "bg-sky-500" },
          { label: t("Chờ"), value: stats.waiting, color: "bg-amber-500" },
          { label: t("Đang upload"), value: stats.uploading, color: "bg-cyan-500" },
          { label: t("Thành công"), value: stats.success, color: "bg-emerald-500" },
          { label: t("Lỗi"), value: stats.error, color: "bg-rose-500" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm"
          >
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-xs text-gray-500">{s.label}</span>
            <span className="text-sm font-bold text-gray-800">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <SceneHistoryDropdown
          items={importHistory}
          selectedId={selectedHistoryId}
          onSelect={(id) => void onSelectHistory(id)}
          onClear={() => onClearHistory()}
          formatOptionLabel={formatImportHistoryOption}
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
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <RiFileExcel2Line className="text-base" />
              {t("Nhập Excel & Tạo Luồng")}
            </button>
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
              className="inline-flex gap-1 items-center px-3 h-9 text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg border border-amber-300 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <HiRefresh className="text-base" />
              {t("Retry Lỗi")}
            </button>
            <button
              type="button"
              onClick={handleDeleteErrorTasks}
              disabled={stats.error === 0}
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-rose-600 bg-rose-50 rounded-lg border border-rose-300 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {t("Xóa Tasks")}
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadAllMerged()}
              disabled={
                downloadingMerged || !items.some((i) => Boolean(i.mergedVideoUrl))
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
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
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-600">
              <HiClock className="text-sm text-gray-500" />
              {t("Chạy lại lúc")} {settings.scheduleTime} SA
            </span>
            <button
              type="button"
              onClick={() => {
                onAddLog(t("Check 24h hoàn tất"), "info");
                toast.success(t("Đã kiểm tra 24h"));
              }}
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 transition-colors hover:bg-sky-50"
            >
              Check 24h
            </button>
            <button
              type="button"
              onClick={() => handleStart()}
              disabled={selectedCount === 0}
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 transition-colors hover:bg-sky-50"
            >
              {t("Bắt Đầu")}
            </button>
            <button
              type="button"
              onClick={() => handlePause()}
              disabled={
                Object.keys(generatingIds).length === 0 &&
                Object.keys(mergingIds).length === 0 &&
                !items.some((i) => i.status === "running" || i.status === "uploading")
              }
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 transition-colors hover:bg-sky-50"
            >
              {t("Tạm Dừng")}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedCount === 0}
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 transition-colors hover:bg-sky-50"
            >
              {t("Xóa Chọn")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        {items.length === 0 ? (
          <div className="py-16 text-sm text-center text-gray-400">
            {t('Chưa có luồng. Nhấn "Nhập Excel & Tạo Luồng" để bắt đầu.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((i) => i.selected)}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 w-10 text-left">#</th>
                  <th className="px-4 py-3 text-left" style={{ maxWidth: 300, width: 300 }}>
                    {t("Shop / Sản phẩm")}
                  </th>
                  <th className="px-4 py-3 w-28 text-center">{t("Ảnh sản phẩm")}</th>
                  <th className="px-4 py-3 w-28 text-center">{t("Ảnh nhân vật")}</th>
                  <th className="px-4 py-3 min-w-[140px] text-center">{t("Video")}</th>
                  <th className="px-4 py-3 w-32 text-center">{t("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-sky-50/30 transition-colors ${
                      item.error
                        ? "bg-rose-50/70"
                        : item.selected
                        ? "bg-sky-50/50"
                        : idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/40"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Switch
                        size="sm"
                        value={item.selected}
                        onChange={(val) => updateItem(item.id, { selected: val })}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{idx + 1}</td>
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
                          <a
                            href={item.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("Xem ảnh sản phẩm")}
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.productName || t("Ảnh sản phẩm")}
                              className="object-cover w-16 h-16 rounded-lg border border-gray-200 transition-colors hover:border-sky-400"
                            />
                          </a>
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
                          <img
                            src={characterPreview.url}
                            alt={characterPreview.name || t("Ảnh nhân vật")}
                            title={characterPreview.name || t("Ảnh nhân vật từ config")}
                            className="object-cover w-16 h-16 rounded-lg border border-gray-200"
                          />
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
                            const hasMerged = Boolean(item.mergedVideoUrl);
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
                                <div className="flex gap-1.5 items-center">
                                  <button
                                    type="button"
                                    onClick={() => void openMergedPreview(item)}
                                    className="flex relative justify-center items-center w-9 h-9 text-white rounded-full border shadow-sm transition-colors bg-success border-success hover:bg-success hover:border-success"
                                    title={t("Xem video đã nối")}
                                  >
                                    <RiVideoFill className="text-lg text-white" />
                                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-green-600 shadow-sm ring-1 ring-green-500">
                                      <HiCheck className="text-[11px] font-bold" />
                                    </span>
                                  </button>
                                  {canMerge ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleRetryMerge(item)}
                                      className="flex justify-center items-center w-8 h-8 rounded-full border shadow-sm transition-colors text-warning bg-warning/10 border-warning hover:bg-warning/20"
                                      title={t("Nối lại video")}
                                    >
                                      <HiRefresh className="text-sm" />
                                    </button>
                                  ) : null}
                                </div>
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
                        const isItemRunning =
                          item.status === "running" ||
                          item.status === "uploading" ||
                          Boolean(generatingIds[item.id]) ||
                          Boolean(mergingIds[item.id]);
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStart([item.id])}
                              disabled={isItemRunning}
                              className={`flex justify-center items-center w-8 h-8 rounded-full border shadow-sm transition-colors ${
                                isItemRunning
                                  ? "text-purple-600 bg-purple-50 border-purple-300 cursor-default"
                                  : "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
                              }`}
                              title={isItemRunning ? t("Đang chạy...") : t("Chạy")}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick export */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            text={t("Xuất CSV")}
            onClick={() => {
              const csv = exportAffiliatePlusCSV(items);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `video-affiliate-plus-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
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
        isOpen={!!videoPreview}
        onClose={() => setVideoPreview(null)}
        title={videoPreview?.title || t("Xem video")}
        width="440px"
      >
        <Dialog.Body>
          {videoPreview?.kind === "merged" ? (
            <div className="space-y-3">
              <div className="overflow-hidden bg-black rounded-lg">
                <video
                  key={`${videoPreview.urls[videoPreview.index]}-${videoPreview.index}`}
                  src={videoPreview.urls[videoPreview.index]}
                  controls
                  autoPlay
                  playsInline
                  className="mx-auto max-h-[70vh] w-full object-contain"
                />
              </div>
              {(() => {
                const mergedItem = items.find((i) => i.id === videoPreview.itemId);
                const canRetry =
                  mergedItem && getMergeableVideoUrls(mergedItem).length >= 2;
                const isRetrying = Boolean(mergingIds[videoPreview.itemId]);
                if (!canRetry) return null;
                return (
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
                const failedCount = videoPreview.slots.filter((s) => !String(s || "").trim()).length;
                const anyRegen = Object.values(videoPreview.regenerating).some(Boolean);

                return (
                  <>
                    <div className="overflow-hidden bg-black rounded-lg min-h-[220px] flex items-center justify-center relative">
                      {isRegen ? (
                        <div className="flex flex-col gap-2 items-center py-16 text-white/90">
                          <RiLoader4Line className="text-3xl animate-spin text-purple-300" />
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
                            onClick={() =>
                              void regenerateVariantSlot(videoPreview.itemId, idx)
                            }
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
                            onClick={() =>
                              void regenerateVariantSlot(videoPreview.itemId, idx)
                            }
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
    </div>
  );
}
