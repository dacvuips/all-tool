/**
 * Nút "Xóa Logo AI" → Dialog chọn Ảnh / Video, queue xóa watermark từng file.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckboxBlankLine,
  RiCheckboxFill,
  RiImageFill,
  RiLoader4Line,
  RiMagicLine,
  RiPlayFill,
  RiVideoFill,
  RiZoomInLine,
} from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { SubscriptionPlanEnum } from "../../../../lib/repo/customer/customer.repo";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { ImageDialog } from "../../../shared/utilities/dialog/image-dialog";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form/button";
import { makeCleanedFileName } from "../remove-logo/constants";
import { useRemoveLogoApi } from "../remove-logo/hook/useRemoveLogoApi";
import {
  cleanedResultToBlob,
  persistCleanedImage,
  persistCleanedVideo,
} from "./batchClearWatermark";
import {
  generatedImageToApiBase64Input,
  generatedVideoToApiBase64Input,
  getGeneratedImagePreviewSrc,
  getGeneratedVideoPreviewSrc,
  getOrCreateBlobPreviewUrl,
  hasGeneratedImageData,
  hasGeneratedVideoData,
  type GeneratedImageLike,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";

const PAID_PLANS = new Set([
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.ENTERPRISE,
]);

function isPaidPlan(subscription?: string | null) {
  return !!subscription && PAID_PLANS.has(subscription as SubscriptionPlanEnum);
}

export interface ClearWatermarkSceneItem {
  id: string;
  sceneNumber?: number;
  motionPrompt?: string;
  imageGenPrompt?: string;
  motion_description?: string;
  visual_prompt?: string;
  visualPrompt?: string;
  disabled?: boolean;
}

interface BatchClearWatermarkDialogProps {
  id?: string;
  scenes: ClearWatermarkSceneItem[];
  getGeneratedImage: (sceneId: string) => Promise<GeneratedImageLike | null | undefined>;
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  saveGeneratedImage: (sceneId: string, imageData: any) => Promise<void>;
  saveGeneratedVideo: (sceneId: string, videoData: any) => Promise<void>;
  availableImageCount: number;
  availableVideoCount: number;
  availableExtendCount: number;
  disabled?: boolean;
}

type MediaTab = "image" | "video";
type ItemStatus = "idle" | "processing" | "done" | "error";

interface MediaRow {
  id: string;
  sceneId: string;
  storageKey: string;
  sceneNumber: number;
  kind: MediaTab;
  isStitch?: boolean;
  prompt: string;
  previewSrc: string | null;
  image?: GeneratedImageLike | null;
  video?: GeneratedVideoLike | null;
  status: ItemStatus;
  errorMessage?: string;
}

function resolveScenePrompt(scene: ClearWatermarkSceneItem): string {
  return (
    scene.motionPrompt ||
    scene.motion_description ||
    scene.imageGenPrompt ||
    scene.visual_prompt ||
    scene.visualPrompt ||
    ""
  ).trim();
}

export function BatchClearWatermarkDialog({
  id = "batch-clear-watermark",
  scenes,
  getGeneratedImage,
  getGeneratedVideo,
  saveGeneratedImage,
  saveGeneratedVideo,
  availableImageCount,
  availableVideoCount,
  availableExtendCount,
  disabled = false,
}: BatchClearWatermarkDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const { cleanWatermark } = useRemoveLogoApi();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MediaTab>("image");
  const [loadingList, setLoadingList] = useState(false);
  const [imageRows, setImageRows] = useState<MediaRow[]>([]);
  const [videoRows, setVideoRows] = useState<MediaRow[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [downloadNow, setDownloadNow] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomVideo, setZoomVideo] = useState<string | null>(null);

  const dragRef = useRef<{ active: boolean; mode: "add" | "remove" } | null>(null);
  const downloadNowRef = useRef(downloadNow);
  downloadNowRef.current = downloadNow;
  const runningRef = useRef(running);
  runningRef.current = running;

  const canUse = isPaidPlan(customer?.googlePackage?.subscription);
  const nothingToClear = availableImageCount < 1 && availableVideoCount < 1 && availableExtendCount < 1;
  const isDisabled = disabled || nothingToClear;

  const sortedScenes = useMemo(
    () =>
      [...scenes]
        .filter((s) => !s.disabled)
        .map((s, index) => ({ scene: s, sceneNumber: s.sceneNumber ?? index + 1 }))
        .sort((a, b) => a.sceneNumber - b.sceneNumber),
    [scenes]
  );

  const currentRows = tab === "image" ? imageRows : videoRows;
  const selectableIds = useMemo(
    () => currentRows.filter((r) => r.status !== "processing").map((r) => r.id),
    [currentRows]
  );
  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((sid) => checkedIds.has(sid));
  const checkedInTab = selectableIds.filter((sid) => checkedIds.has(sid)).length;
  const allCheckedIds = useMemo(() => {
    const valid = new Set([...imageRows, ...videoRows].map((r) => r.id));
    return [...checkedIds].filter((id) => valid.has(id));
  }, [checkedIds, imageRows, videoRows]);
  const canClearNow = allCheckedIds.length > 0 && !running && !loadingList;

  const loadRows = useCallback(async () => {
    setLoadingList(true);
    try {
      const nextImages: MediaRow[] = [];
      const nextVideos: MediaRow[] = [];
      for (const { scene, sceneNumber } of sortedScenes) {
        const prompt = resolveScenePrompt(scene);
        const image = (await getGeneratedImage(scene.id)) ?? null;
        if (image && hasGeneratedImageData(image)) {
          nextImages.push({
            id: `img:${scene.id}`,
            sceneId: scene.id,
            storageKey: scene.id,
            sceneNumber,
            kind: "image",
            prompt,
            previewSrc: getGeneratedImagePreviewSrc(image) || null,
            image,
            status: "idle",
          });
        }

        const video = (await getGeneratedVideo(scene.id)) ?? null;
        if (video && hasGeneratedVideoData(video)) {
          nextVideos.push({
            id: `vid:${scene.id}`,
            sceneId: scene.id,
            storageKey: scene.id,
            sceneNumber,
            kind: "video",
            prompt,
            previewSrc: getGeneratedVideoPreviewSrc(video),
            video,
            status: "idle",
          });
        }

        const stitchKey = `${scene.id}::stitch`;
        const stitch = (await getGeneratedVideo(stitchKey)) ?? null;
        if (stitch && hasGeneratedVideoData(stitch)) {
          nextVideos.push({
            id: `vid:${stitchKey}`,
            sceneId: scene.id,
            storageKey: stitchKey,
            sceneNumber,
            kind: "video",
            isStitch: true,
            prompt,
            previewSrc: getGeneratedVideoPreviewSrc(stitch),
            video: stitch,
            status: "idle",
          });
        }
      }
      setImageRows(nextImages);
      setVideoRows(nextVideos);
      setCheckedIds(new Set());
      setTab(nextImages.length > 0 ? "image" : "video");
    } finally {
      setLoadingList(false);
    }
  }, [sortedScenes, getGeneratedImage, getGeneratedVideo]);

  const loadRowsRef = useRef(loadRows);
  loadRowsRef.current = loadRows;

  useEffect(() => {
    if (!open) return;
    if (runningRef.current) return;
    void loadRowsRef.current();
  }, [open]);

  useEffect(() => {
    const endDrag = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const handleOpen = () => {
    if (isDisabled && !running) return;
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setZoomImage(null);
    setZoomVideo(null);
    dragRef.current = null;
  };

  const applyChecked = (itemId: string, add: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (add) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const handleItemPointerDown = (row: MediaRow, e: PointerEvent<HTMLDivElement>) => {
    if (row.status === "processing") return;
    e.preventDefault();
    const add = !checkedIds.has(row.id);
    dragRef.current = { active: true, mode: add ? "add" : "remove" };
    applyChecked(row.id, add);
  };

  const handleItemPointerEnter = (row: MediaRow) => {
    if (!dragRef.current?.active || row.status === "processing") return;
    applyChecked(row.id, dragRef.current.mode === "add");
  };

  const handleSelectAll = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allSelectableChecked) {
        selectableIds.forEach((sid) => next.delete(sid));
      } else {
        selectableIds.forEach((sid) => next.add(sid));
      }
      return next;
    });
  };

  const updateRow = (rowId: string, patch: Partial<MediaRow>) => {
    const apply = (list: MediaRow[]) => list.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
    setImageRows(apply);
    setVideoRows(apply);
  };

  const processOneRow = async (row: MediaRow): Promise<"ok" | "error" | "quota"> => {
    updateRow(row.id, { status: "processing", errorMessage: undefined });
    try {
      const name =
        row.kind === "image"
          ? `scene-${row.sceneNumber}.jpg`
          : `scene-${row.sceneNumber}${row.isStitch ? "-stitch" : ""}.mp4`;

      let mediaBase64 = "";
      let mimeType = row.kind === "image" ? "image/jpeg" : "video/mp4";
      if (row.kind === "image" && row.image) {
        const input = await generatedImageToApiBase64Input(row.image);
        mediaBase64 = input.imageBytes;
        mimeType = input.mimeType;
      } else if (row.video) {
        const input = await generatedVideoToApiBase64Input(row.video);
        mediaBase64 = input.videoBytes;
        mimeType = input.mimeType;
      } else {
        throw new Error(t("Thiếu dữ liệu media"));
      }

      const result = await cleanWatermark(
        [
          {
            clientId: row.id,
            kind: row.kind,
            mediaBase64,
            mimeType,
            name,
          },
        ],
        { refreshCustomer: true }
      );

      const processed = result.processed.find((p) => p.clientId === row.id) || result.processed[0];
      const skipped = result.skipped.find((s) => s.clientId === row.id) || result.skipped[0];

      if (skipped) {
        updateRow(row.id, { status: "error", errorMessage: skipped.reason });
        if (skipped.code === "QUOTA_EXCEEDED") {
          toast.info(t("Hết hạn mức. Vui lòng nâng cấp gói hoặc chờ reset ngày mai."));
          return "quota";
        }
        toast.error(`${t("Cảnh")} #${row.sceneNumber}: ${skipped.reason}`);
        return "error";
      }

      if (!processed) {
        throw new Error(t("Không nhận được kết quả"));
      }

      const blob = await cleanedResultToBlob(processed);
      const previewSrc = getOrCreateBlobPreviewUrl(blob);
      const fileName = makeCleanedFileName(name, row.kind);

      if (row.kind === "image" && row.image) {
        const next = await persistCleanedImage({
          sceneId: row.sceneId,
          original: row.image,
          blob,
          mimeType: processed.mimeType || mimeType,
          save: saveGeneratedImage,
          downloadNow: downloadNowRef.current,
          fileName,
        });
        updateRow(row.id, {
          status: "done",
          previewSrc,
          image: next,
          errorMessage: undefined,
        });
      } else if (row.video) {
        const next = await persistCleanedVideo({
          sceneId: row.sceneId,
          storageKey: row.storageKey,
          original: row.video,
          blob,
          mimeType: processed.mimeType || mimeType,
          isStitch: row.isStitch,
          save: saveGeneratedVideo,
          downloadNow: downloadNowRef.current,
          fileName,
        });
        updateRow(row.id, {
          status: "done",
          previewSrc,
          video: next,
          errorMessage: undefined,
        });
      }

      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      return "ok";
    } catch (err: any) {
      const msg = err?.message || t("Lỗi khi xóa logo");
      const isQuota = /hạn mức|nâng cấp gói|Basic trở lên|hết hạn/i.test(msg);
      updateRow(row.id, { status: "error", errorMessage: msg });
      toast.error(`${t("Cảnh")} #${row.sceneNumber}: ${msg}`);
      return isQuota ? "quota" : "error";
    }
  };

  const handleClear = async () => {
    if (!canClearNow) return;
    if (!customer) {
      toast.error(t("Vui lòng đăng nhập để sử dụng"));
      return;
    }
    if (!canUse) {
      toast.error(
        t("Chức năng Xóa Logo AI chỉ dành cho gói Basic trở lên. Vui lòng nâng cấp gói.")
      );
      return;
    }

    const queue = [...imageRows, ...videoRows].filter((r) => allCheckedIds.includes(r.id));
    if (!queue.length) return;

    setRunning(true);
    setProgress({ done: 0, total: queue.length });
    let successCount = 0;
    let failCount = 0;
    let stoppedByQuota = false;

    try {
      for (let i = 0; i < queue.length; i++) {
        const row = queue[i];
        if (stoppedByQuota) {
          updateRow(row.id, {
            status: "error",
            errorMessage: t("Hết hạn mức. Vui lòng nâng cấp gói hoặc chờ reset ngày mai."),
          });
          failCount += 1;
          setProgress({ done: i + 1, total: queue.length });
          continue;
        }

        const result = await processOneRow(row);
        if (result === "ok") successCount += 1;
        else {
          failCount += 1;
          if (result === "quota") stoppedByQuota = true;
        }
        setProgress({ done: i + 1, total: queue.length });
      }

      if (queue.length > 1) {
        if (successCount > 0 && failCount === 0) {
          toast.success(t("Đã xóa logo {{count}} file", { count: successCount }));
        } else if (successCount > 0 && failCount > 0) {
          toast.info(
            t("Xong {{ok}} file · {{fail}} file lỗi/bỏ qua", {
              ok: successCount,
              fail: failCount,
            })
          );
        } else if (successCount === 0) {
          toast.error(t("Không xử lý được file nào"));
        }
      } else if (successCount === 1) {
        toast.success(t("Đã xóa logo và thay file gốc"));
      }
    } finally {
      setRunning(false);
    }
  };

  const buttonColor = running
    ? "bg-indigo-400 hover:bg-indigo-500 cursor-pointer opacity-80"
    : "bg-indigo-500 hover:bg-indigo-600 cursor-pointer";
  const buttonLabel = running
    ? `${t("Đang xóa...")} (${progress.done}/${progress.total})`
    : t("Xóa Logo AI");

  const tabs: { id: MediaTab; label: string; count: number }[] = [
    { id: "image", label: t("Ảnh"), count: imageRows.length },
    { id: "video", label: t("Video"), count: videoRows.length },
  ];

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={isDisabled && !running}
        aria-busy={running}
        onClick={handleOpen}
        className={`inline-flex items-center justify-center whitespace-nowrap gap-1.5 px-3 py-1.5 h-8 leading-none rounded-lg text-white text-xs font-semibold border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {running ? (
          <RiLoader4Line className="animate-spin flex-shrink-0 text-sm" />
        ) : (
          <RiMagicLine className="flex-shrink-0 text-sm" />
        )}
        <span className="leading-none">{buttonLabel}</span>
      </button>

      <Dialog
        isOpen={open}
        onClose={handleClose}
        title={t("Xóa Logo AI")}
        width={780}
        maxWidth="92vw"
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-20 left-0 z-100 flex items-start justify-center overflow-hidden px-4 pt-6 pb-6 no-scrollbar"
        dialogClass="relative bg-white shadow-md rounded-2xl flex flex-col overflow-hidden"
        headerClass="relative flex px-5 py-2 box-content bg-slate-50 border-top rounded-t flex-shrink-0 z-10"
        bodyClass="relative flex flex-col min-h-0 overflow-hidden px-5 pt-3 pb-3 bg-white"
        footerClass="relative flex px-4 py-3 bg-white rounded-b flex-shrink-0 z-10 border-t border-gray-100"
      >
        <Dialog.Body>
          <div className="flex flex-col gap-3">
            <div className="relative flex items-center border-b border-gray-200 flex-shrink-0">
              {tabs.map((item) => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`relative flex-1 py-2 text-sm font-semibold cursor-pointer border-0 bg-transparent transition-colors ${
                      isActive ? "text-gray-800" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {item.id === "image" ? <RiImageFill /> : <RiVideoFill />}
                      {item.label}
                    </span>
                    <span className="ml-1 text-xs font-normal text-gray-400">({item.count})</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-1 rounded-t bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={loadingList || selectableIds.length === 0}
                onClick={handleSelectAll}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0 bg-transparent px-0 py-1"
              >
                {allSelectableChecked ? (
                  <RiCheckboxFill className="text-base" />
                ) : (
                  <RiCheckboxBlankLine className="text-base" />
                )}
                {allSelectableChecked ? t("Bỏ chọn tất cả") : t("Chọn tất cả")}
              </button>
              <span className="text-xs text-gray-400">
                {t("Đã chọn")} {checkedInTab}/{selectableIds.length}
                {allCheckedIds.length > checkedInTab
                  ? ` · ${t("Tổng")} ${allCheckedIds.length}`
                  : ""}
              </span>
            </div>

            <div
              className="overflow-y-auto border border-gray-100 rounded-xl p-2"
              style={{ maxHeight: "calc(100vh - 420px)", userSelect: "none" }}
            >
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                  <RiLoader4Line className="animate-spin text-lg" />
                  {t("Đang tải danh sách...")}
                </div>
              ) : currentRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  {tab === "image" ? t("Chưa có ảnh") : t("Chưa có video")}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {currentRows.map((row) => {
                    const isChecked = checkedIds.has(row.id);
                    return (
                      <div
                        key={row.id}
                        onPointerDown={(e) => handleItemPointerDown(row, e)}
                        onPointerEnter={() => handleItemPointerEnter(row)}
                        className={`relative rounded-xl border overflow-hidden cursor-pointer ${
                          isChecked ? "border-primary ring-1 ring-primary" : "border-gray-200"
                        } ${row.status === "processing" ? "opacity-80" : ""}`}
                      >
                        <div className="relative bg-gray-100" style={{ aspectRatio: "3 / 4" }}>
                          {row.previewSrc ? (
                            row.kind === "image" ? (
                              <img
                                src={row.previewSrc}
                                alt=""
                                draggable={false}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <video
                                src={row.previewSrc}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            )
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-xs text-gray-400">
                              —
                            </div>
                          )}

                          {row.kind === "video" && row.previewSrc && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white bg-opacity-90">
                                <RiPlayFill className="text-gray-800 text-sm" />
                              </span>
                            </span>
                          )}

                          <span
                            className={`absolute top-1.5 left-1.5 text-lg ${
                              isChecked ? "text-primary" : "text-white"
                            }`}
                            style={{ filter: isChecked ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,.45))" }}
                          >
                            {isChecked ? <RiCheckboxFill /> : <RiCheckboxBlankLine />}
                          </span>

                          {row.previewSrc && (
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.kind === "image") setZoomImage(row.previewSrc);
                                else setZoomVideo(row.previewSrc);
                              }}
                              className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 p-0 rounded-full bg-black bg-opacity-50 text-white border-0 cursor-pointer disabled:opacity-50"
                              title={t("Xem")}
                            >
                              <RiZoomInLine className="text-sm leading-none" />
                            </button>
                          )}

                          {row.status === "processing" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                              <RiLoader4Line className="animate-spin text-white text-2xl" />
                            </div>
                          )}
                          {row.status === "done" && (
                            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-center text-white text-xs font-semibold bg-green-500 bg-opacity-90">
                              {t("Đã xóa")}
                            </div>
                          )}
                          {row.status === "error" && (
                            <div
                              className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-center text-white text-xs font-semibold bg-red-500 bg-opacity-90 truncate"
                              title={row.errorMessage}
                            >
                              {t("Lỗi")}
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5 bg-white">
                          <div className="text-xs font-semibold text-gray-800 truncate">
                            {t("Cảnh")} #{row.sceneNumber}
                            {row.isStitch ? (
                              <span className="ml-1 font-normal text-gray-400">
                                ({t("Video nối")})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <div className="flex items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={() => setDownloadNow((v) => !v)}
              className="inline-flex items-center gap-2 border-0 bg-transparent cursor-pointer px-0 py-0"
            >
              <span
                className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors ${
                  downloadNow ? "bg-primary" : "bg-gray-300"
                }`}
                style={{ width: 36, height: 20 }}
                role="switch"
                aria-checked={downloadNow}
              >
                <span
                  className="inline-block bg-white rounded-full shadow"
                  style={{
                    width: 16,
                    height: 16,
                    transform: downloadNow ? "translateX(18px)" : "translateX(2px)",
                    transition: "transform 0.2s",
                  }}
                />
              </span>
              <span className="text-xs font-medium text-gray-700">{t("Tải về ngay")}</span>
            </button>

            <div className="flex items-center gap-2">
              {running && (
                <span className="text-xs text-gray-400 mr-1">
                  {progress.done}/{progress.total}
                </span>
              )}
              <Button text={t("Đóng")} onClick={handleClose} className="px-4" />
              <Button
                primary
                text={
                  running
                    ? t("Đang xóa...")
                    : `${t("Xóa")}${allCheckedIds.length ? ` (${allCheckedIds.length})` : ""}`
                }
                onClick={() => void handleClear()}
                disabled={!canClearNow}
                isLoading={running}
                className="px-4"
              />
            </div>
          </div>
        </Dialog.Footer>
      </Dialog>

      {zoomImage && (
        <ImageDialog image={zoomImage} isOpen={!!zoomImage} onClose={() => setZoomImage(null)} />
      )}
      {zoomVideo && (
        <VideoDialog videoUrl={zoomVideo} isOpen={!!zoomVideo} onClose={() => setZoomVideo(null)} />
      )}
    </>
  );
}
