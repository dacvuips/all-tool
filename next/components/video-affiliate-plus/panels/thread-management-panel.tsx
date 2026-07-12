import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaPhotoVideo } from "react-icons/fa";
import {
  HiClock,
  HiCog,
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
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Button, Field, Form, Input, Switch } from "../../shared/utilities/form";
import { exportAffiliatePlusCSV, parseAffiliatePlusExcel } from "../csv-parser";
import { mergeVideosToIndexedDb, removeMergedVideoFromIndexedDb } from "../merged-video";
import { prepareShopeeImageInput } from "../shopee-image";
import { loadGenerateVideoConfig } from "../storage";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  CharacterProfile,
  GenerateVideoConfig,
  ThreadStatus,
  buildActivePromptFromConfig,
} from "../types";
import { GenerateVideoConfigDialog } from "./generate-video-config-dialog";

type EditField = "shopName" | "shopId" | "productName" | "imageUrl" | "cookie" | "hostPort" | null;

type VideoPreviewState = {
  title: string;
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
  onUpdateItems: (items: AffiliatePlusItem[]) => void;
  onAddLog: (message: string, level?: AffiliatePlusLog["level"], threadId?: string) => void;
}

export function ThreadManagementPanel({
  items,
  settings,
  isGlobalRunning,
  onUpdateItems,
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
  const shopeeVideoJob = useMediaGenerationJob<{
    videoUri?: string | null;
    videoUris?: string[];
    mimeType?: string;
  }>();

  const openVideoPreview = (title: string, urls: string[]) => {
    const clean = urls.map((u) => String(u || "").trim()).filter(Boolean);
    if (!clean.length) return;
    setVideoPreview({ title, urls: clean, index: 0 });
  };

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
    const error = items.filter((i) => i.status === "error").length;
    return { total, waiting, uploading, success, error };
  }, [items]);

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

      onUpdateItems([...items, ...withPrompt]);
      onAddLog(t("Đã import {{count}} luồng từ file", { count: withPrompt.length }), "success");
      toast.success(t("Đã import {{count}} sản phẩm", { count: withPrompt.length }));
    } catch (err) {
      console.error("Import affiliate file failed:", err);
      toast.error(t("Không thể đọc file. Thử lại với file .csv hoặc .xlsx từ Shopee Affiliate."));
    }
  };

  const handleRetryErrors = () => {
    const errorItems = items.filter((i) => i.status === "error");
    if (!errorItems.length) {
      toast.warn(t("Không có luồng lỗi"));
      return;
    }
    onUpdateItems(
      items.map((i) =>
        i.status === "error"
          ? { ...i, status: "waiting" as ThreadStatus, error: "", countdown: 0 }
          : i
      )
    );
    onAddLog(t("Retry {{count}} luồng lỗi", { count: errorItems.length }), "warning");
    toast.success(t("Đã đưa {{count}} luồng vào hàng chờ", { count: errorItems.length }));
  };

  const handleDeleteErrorTasks = () => {
    const errorItems = items.filter((i) => i.status === "error");
    if (!errorItems.length) {
      toast.warn(t("Không có task lỗi"));
      return;
    }
    if (!confirm(t("Xóa {{count}} task lỗi?", { count: errorItems.length }))) return;
    onUpdateItems(items.filter((i) => i.status !== "error"));
    onAddLog(t("Đã xóa {{count}} task lỗi", { count: errorItems.length }), "warning");
  };

  const handleStart = async (ids?: string[]) => {
    const currentItems = itemsRef.current;
    const targets = ids
      ? currentItems.filter((i) => ids.includes(i.id))
      : currentItems.filter((i) => i.selected || i.status === "waiting" || i.status === "stopped");
    if (!targets.length) {
      toast.warn(t("Không có luồng để chạy"));
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

    const targetIds = new Set(targets.map((i) => i.id));
    setGeneratingIds((prev) => {
      const next = { ...prev };
      targets.forEach((t) => {
        next[t.id] = true;
      });
      return next;
    });
    onUpdateItems(
      itemsRef.current.map((i) => {
        if (!targetIds.has(i.id) || i.status === "success") return i;
        return {
          ...i,
          status: "running" as ThreadStatus,
          error: "",
          // Giữ countdown cao để simulateTick không kết thúc sớm trong lúc chờ Flow2
          countdown: 99999,
          selected: false,
        };
      })
    );
    onAddLog(t("Bắt đầu generate video {{count}} luồng", { count: targets.length }), "info");
    toast.success(t("Đã bắt đầu {{count}} luồng", { count: targets.length }));

    let characterPrepared;
    try {
      characterPrepared = await prepareShopeeImageInput(characterImage);
    } catch (err: any) {
      toast.error(t("Không xử lý được ảnh nhân vật: {{msg}}", { msg: err?.message || "" }));
      setGeneratingIds((prev) => {
        const next = { ...prev };
        targetIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      onUpdateItems(
        itemsRef.current.map((i) =>
          targetIds.has(i.id)
            ? { ...i, status: "error" as ThreadStatus, error: err?.message || "", countdown: 0 }
            : i
        )
      );
      return;
    }

    for (const target of targets) {
      try {
        const productPrepared = await prepareShopeeImageInput(target.imageUrl);
        // Đúng thứ tự Flow2 component: [0] nhân vật, [1] sản phẩm
        const images = [characterPrepared, productPrepared];

        const result = await shopeeVideoJob.run({
          url: "/api/app/generation-shopee-video/",
          body: {
            prompt: target.prompt?.trim() || prompt,
            images,
            characterImage: characterPrepared,
            productImage: productPrepared,
            videosPerJob: config.videosPerJob,
            variantCount: config.videosPerJob,
            videoModel: config.videoModel,
            config: {
              prompt: target.prompt?.trim() || prompt,
              aspectRatio: "9:16",
              videosPerJob: config.videosPerJob,
              variantCount: config.videosPerJob,
              videoModel: config.videoModel,
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

        const fromUris = ((result.data.videoUris?.length ? result.data.videoUris : []) as string[])
          .map((u) => String(u || "").trim())
          .filter(Boolean);
        const singleUri = String(result.data.videoUri || "").trim();
        const variantUris = Array.from(
          new Set(fromUris.length ? fromUris : singleUri ? [singleUri] : [])
        );

        onUpdateItems(
          itemsRef.current.map((i) => {
            if (i.id !== target.id) return i;
            const videoUrls = variantUris.length ? variantUris : i.videoUrls;
            const total = Math.max(videoUrls.length, 1);
            return {
              ...i,
              status: "success" as ThreadStatus,
              videoUrls,
              uploaded: total,
              pending: 0,
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

        let mergedUrl = "";
        if (variantUris.length >= 2) {
          setMergingIds((prev) => ({ ...prev, [target.id]: true }));
          onAddLog(
            t("Đang nối {{count}} video...", { count: variantUris.length }),
            "info",
            target.id
          );
          try {
            mergedUrl = await mergeVideosToIndexedDb(target.id, variantUris);
            onUpdateItems(
              itemsRef.current.map((i) =>
                i.id === target.id ? { ...i, mergedVideoUrl: mergedUrl } : i
              )
            );
            onAddLog(t("Đã nối video và lưu IndexedDB"), "success", target.id);
          } catch (mergeErr: any) {
            console.error(mergeErr);
            onAddLog(
              t("Nối video thất bại: {{msg}}", {
                msg: mergeErr?.message || "unknown",
              }),
              "error",
              target.id
            );
          } finally {
            setMergingIds((prev) => {
              const next = { ...prev };
              delete next[target.id];
              return next;
            });
          }
        }

        onAddLog(
          t("Hoàn tất video cho {{name}} ({{count}} file{{merged}})", {
            name: target.productName || target.shopName || target.id,
            count: variantUris.length || 1,
            merged: mergedUrl ? `, ${t("đã nối")}` : "",
          }),
          "success",
          target.id
        );
      } catch (err: any) {
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
    }
  };

  const handlePause = (ids?: string[]) => {
    const pausedIds = new Set(
      items
        .filter((i) =>
          ids
            ? ids.includes(i.id)
            : i.selected || i.status === "running" || i.status === "uploading"
        )
        .map((i) => i.id)
    );
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
      items.map((i) => {
        if (!pausedIds.has(i.id)) return i;
        return { ...i, status: "stopped" as ThreadStatus, selected: false, countdown: 0 };
      })
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
      void removeMergedVideoFromIndexedDb(i.id);
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
    void removeMergedVideoFromIndexedDb(id);
    onUpdateItems(items.filter((i) => i.id !== id));
    onAddLog(t("Xóa luồng"), "warning", id);
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
              disabled={isGlobalRunning && stats.uploading > 0}
              className="inline-flex items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 transition-colors hover:bg-sky-50"
            >
              {t("Bắt Đầu")}
            </button>
            <button
              type="button"
              onClick={() => handlePause()}
              disabled={!isGlobalRunning}
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
                  <th className="px-4 py-3 w-28 text-center">{t("Kết quả video")}</th>
                  <th className="px-4 py-3 w-28 text-center">{t("Video đã nối")}</th>
                  <th className="px-4 py-3 w-32 text-center">{t("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-sky-50/30 transition-colors ${
                      item.selected ? "bg-sky-50/50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Switch
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
                      <div className="flex justify-center">
                        {(() => {
                          const isGenerating = Boolean(generatingIds[item.id]);
                          const hasVideos = (item.videoUrls?.length || 0) > 0;
                          const count = item.videoUrls?.length || 0;

                          if (isGenerating) {
                            return (
                              <div
                                className="flex relative justify-center items-center w-9 h-9 text-amber-600 bg-amber-50 rounded-full border border-amber-300 shadow-sm"
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
                              onClick={() =>
                                openVideoPreview(t("Kết quả video"), item.videoUrls || [])
                              }
                              className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors disabled:opacity-100 ${
                                hasVideos
                                  ? "text-white bg-green-500 border-green-500 cursor-pointer hover:bg-green-600 hover:border-green-600"
                                  : "text-gray-400 bg-gray-200 border-gray-300 cursor-default"
                              }`}
                              title={
                                hasVideos
                                  ? t("{{count}} video — xem", { count })
                                  : item.status === "error" && item.error
                                  ? item.error
                                  : t("Chưa có video")
                              }
                            >
                              <FaPhotoVideo
                                className={`text-lg ${hasVideos ? "text-white" : "text-gray-400"}`}
                              />
                              {count > 1 ? (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-700 px-1 text-[10px] font-semibold text-white">
                                  {count}
                                </span>
                              ) : null}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {(() => {
                          const hasMerged = Boolean(item.mergedVideoUrl);
                          const isMerging = Boolean(mergingIds[item.id]);

                          if (isMerging) {
                            return (
                              <div
                                className="flex justify-center items-center w-9 h-9 text-amber-600 bg-amber-50 rounded-full border border-amber-300 shadow-sm"
                                title={t("Đang nối video...")}
                              >
                                <RiLoader4Line className="text-xl animate-spin" />
                              </div>
                            );
                          }

                          return (
                            <button
                              type="button"
                              disabled={!hasMerged}
                              onClick={() =>
                                openVideoPreview(
                                  t("Video đã nối"),
                                  item.mergedVideoUrl ? [item.mergedVideoUrl] : []
                                )
                              }
                              className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors disabled:opacity-100 ${
                                hasMerged
                                  ? "text-white bg-green-500 border-green-500 cursor-pointer hover:bg-green-600 hover:border-green-600"
                                  : "text-gray-400 bg-gray-200 border-gray-300 cursor-default"
                              }`}
                              title={hasMerged ? t("Xem video đã nối") : t("Chưa có video đã nối")}
                            >
                              <RiVideoFill
                                className={`text-lg ${hasMerged ? "text-white" : "text-gray-400"}`}
                              />
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStart([item.id])}
                          disabled={item.status === "running"}
                          className="flex justify-center items-center w-8 h-8 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-200 shadow-sm transition-colors hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-35 disabled:hover:bg-emerald-50"
                          title={t("Chạy")}
                        >
                          <HiPlay className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePause([item.id])}
                          disabled={item.status !== "running" && item.status !== "uploading"}
                          className="flex justify-center items-center w-8 h-8 text-amber-600 bg-amber-50 rounded-full border border-amber-200 shadow-sm transition-colors hover:bg-amber-100 hover:border-amber-300 disabled:opacity-35 disabled:hover:bg-amber-50"
                          title={t("Tạm dừng")}
                        >
                          <HiOutlinePause className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="flex justify-center items-center w-8 h-8 text-rose-600 bg-rose-50 rounded-full border border-rose-200 shadow-sm transition-colors hover:bg-rose-100 hover:border-rose-300"
                          title={t("Xóa")}
                        >
                          <HiOutlineTrash className="text-sm" />
                        </button>
                      </div>
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
        width="420px"
      >
        <Dialog.Body>
          {videoPreview ? (
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
              {videoPreview.urls.length > 1 ? (
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  {videoPreview.urls.map((_, idx) => {
                    const active = idx === videoPreview.index;
                    return (
                      <button
                        key={`vp-${idx}`}
                        type="button"
                        onClick={() =>
                          setVideoPreview((prev) => (prev ? { ...prev, index: idx } : prev))
                        }
                        className={`min-w-[72px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? "border-green-600 bg-green-500 text-white shadow-sm ring-2 ring-green-200"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        {t("Video")} {idx + 1}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
