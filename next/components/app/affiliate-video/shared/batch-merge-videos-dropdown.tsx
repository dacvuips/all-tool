/**
 * batch-merge-videos-dropdown.tsx
 * Nút "Ghép video" → Dialog chọn phân cảnh (tab Video thường / Video nối) rồi ghép MP4.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckboxBlankLine,
  RiCheckboxFill,
  RiLinkM,
  RiLoader4Line,
  RiPlayFill,
} from "react-icons/ri";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form/button";
import type { MergeVideoKind } from "./batchMergeVideos";
import {
  getGeneratedVideoPreviewSrc,
  hasGeneratedVideoData,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";

export interface MergeSceneItem {
  id: string;
  sceneNumber?: number;
  motionPrompt?: string;
  imageGenPrompt?: string;
  /** Copy-video / elements: motion_description */
  motion_description?: string;
  /** Copy-video / elements: visual_prompt */
  visual_prompt?: string;
  disabled?: boolean;
}

interface BatchMergeVideosDropdownProps {
  id?: string;
  merging: boolean;
  mergeLabel?: string;
  scenes: MergeSceneItem[];
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  availableVideoCount: number;
  availableExtendCount: number;
  disabled?: boolean;
  onMergeNormal: (sceneIds: string[]) => void | Promise<void>;
  onMergeStitch: (sceneIds: string[]) => void | Promise<void>;
}

type MergeTab = MergeVideoKind;

interface SceneVideoRow {
  scene: MergeSceneItem;
  sceneNumber: number;
  video: GeneratedVideoLike | null;
  previewSrc: string | null;
}

function resolveScenePrompt(scene: MergeSceneItem): string {
  return (
    scene.motionPrompt ||
    scene.motion_description ||
    scene.imageGenPrompt ||
    scene.visual_prompt ||
    ""
  ).trim();
}

export function BatchMergeVideosDropdown({
  id = "batch-merge-videos",
  merging,
  mergeLabel = "",
  scenes,
  getGeneratedVideo,
  availableVideoCount,
  availableExtendCount,
  disabled = false,
  onMergeNormal,
  onMergeStitch,
}: BatchMergeVideosDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MergeTab>("normal");
  const [loadingList, setLoadingList] = useState(false);
  const [rows, setRows] = useState<SceneVideoRow[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const nothingToMerge = availableVideoCount < 2 && availableExtendCount < 2;
  const isDisabled = disabled || nothingToMerge;
  const isBusy = merging || isDisabled;

  const sortedScenes = useMemo(
    () =>
      [...scenes]
        .filter((s) => !s.disabled)
        .map((s, index) => ({ scene: s, sceneNumber: s.sceneNumber ?? index + 1 }))
        .sort((a, b) => a.sceneNumber - b.sceneNumber),
    [scenes]
  );

  const selectableIds = useMemo(
    () => rows.filter((r) => r.video).map((r) => r.scene.id),
    [rows]
  );

  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((sid) => checkedIds.has(sid));

  const loadRows = useCallback(
    async (kind: MergeTab) => {
      setLoadingList(true);
      try {
        const next: SceneVideoRow[] = [];
        for (const { scene, sceneNumber } of sortedScenes) {
          const key = kind === "stitch" ? `${scene.id}::stitch` : scene.id;
          const video = (await getGeneratedVideo(key)) ?? null;
          const hasVideo = hasGeneratedVideoData(video);
          next.push({
            scene,
            sceneNumber,
            video: hasVideo ? video : null,
            previewSrc: hasVideo && video ? getGeneratedVideoPreviewSrc(video) : null,
          });
        }
        setRows(next);
        setCheckedIds(new Set(next.filter((r) => r.video).map((r) => r.scene.id)));
      } finally {
        setLoadingList(false);
      }
    },
    [sortedScenes, getGeneratedVideo]
  );

  useEffect(() => {
    if (!open) return;
    void loadRows(tab);
  }, [open, tab, loadRows]);

  const handleOpen = () => {
    if (isBusy) return;
    setTab(availableVideoCount >= 2 ? "normal" : "stitch");
    setOpen(true);
  };

  const handleClose = () => {
    if (merging) return;
    setOpen(false);
    setZoomSrc(null);
  };

  const toggleChecked = (sceneId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelectableChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(selectableIds));
    }
  };

  const checkedCount = selectableIds.filter((sid) => checkedIds.has(sid)).length;
  const canMergeNow = checkedCount >= 2 && !merging && !loadingList;

  const handleMergeNow = async () => {
    if (!canMergeNow) return;
    const ids = selectableIds.filter((sid) => checkedIds.has(sid));
    if (tab === "stitch") {
      await onMergeStitch(ids);
    } else {
      await onMergeNormal(ids);
    }
    setOpen(false);
    setZoomSrc(null);
  };

  const buttonColor = merging
    ? "bg-yellow-500 hover:bg-yellow-600 cursor-pointer opacity-60"
    : "bg-yellow-500 hover:bg-yellow-600 cursor-pointer";
  const buttonLabel = merging ? t("Đang ghép...") : t("Ghép video");

  const tabs: { id: MergeTab; label: string; count: number }[] = [
    { id: "normal", label: t("Video thường"), count: availableVideoCount },
    { id: "stitch", label: t("Video nối"), count: availableExtendCount },
  ];

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={isDisabled}
        aria-busy={merging}
        title={merging && mergeLabel ? mergeLabel : undefined}
        onClick={handleOpen}
        className={`inline-flex items-center justify-center whitespace-nowrap gap-1.5 px-3 py-1.5 h-8 leading-none rounded-lg text-white text-xs font-semibold border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {merging ? (
          <RiLoader4Line className="animate-spin flex-shrink-0 text-sm" />
        ) : (
          <RiLinkM className="flex-shrink-0 text-sm" />
        )}
        <span className="leading-none">{buttonLabel}</span>
      </button>

      <Dialog
        isOpen={open}
        onClose={handleClose}
        title={t("Ghép video")}
        width={720}
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
                    disabled={merging}
                    onClick={() => setTab(item.id)}
                    className={`relative flex-1 py-2 text-sm font-semibold cursor-pointer border-0 bg-transparent transition-colors disabled:cursor-not-allowed ${
                      isActive ? "text-gray-800" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {item.label}
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
                disabled={loadingList || merging || selectableIds.length === 0}
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
                {t("Đã chọn")} {checkedCount}/{selectableIds.length}
              </span>
            </div>

            {/* Chiều cao list giới hạn bằng inline style (Tailwind 2 không hỗ trợ arbitrary calc) */}
            <div
              className="overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100"
              style={{ maxHeight: "calc(100vh - 420px)" }}
            >
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                  <RiLoader4Line className="animate-spin text-lg" />
                  {t("Đang tải danh sách...")}
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  {t("Không có phân cảnh")}
                </div>
              ) : (
                rows.map(({ scene, sceneNumber, video, previewSrc }) => {
                  const hasVideo = !!video;
                  const isChecked = checkedIds.has(scene.id);
                  const prompt = resolveScenePrompt(scene);

                  return (
                    <div
                      key={scene.id}
                      className={`flex items-start gap-3 p-3 ${
                        hasVideo ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!hasVideo || merging}
                        onClick={() => toggleChecked(scene.id)}
                        className="mt-1 flex-shrink-0 text-lg text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-0 bg-transparent p-0"
                        aria-checked={isChecked}
                        role="checkbox"
                      >
                        {isChecked ? <RiCheckboxFill /> : <RiCheckboxBlankLine />}
                      </button>

                      <button
                        type="button"
                        disabled={!hasVideo || merging}
                        onClick={() => toggleChecked(scene.id)}
                        className="flex-1 min-w-0 text-left border-0 bg-transparent p-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="text-xs font-semibold text-gray-800">
                          {t("Cảnh")} #{sceneNumber}
                          {!hasVideo && (
                            <span className="ml-2 font-normal text-gray-400">
                              ({t("Chưa có video")})
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-1 mb-0 text-xs leading-relaxed text-gray-500 line-clamp-2"
                          title={prompt || undefined}
                        >
                          {prompt || t("Không có prompt")}
                        </p>
                      </button>

                      <div className="flex-shrink-0 w-24">
                        {previewSrc ? (
                          <button
                            type="button"
                            disabled={merging}
                            onClick={() => setZoomSrc(previewSrc)}
                            className="relative block w-full overflow-hidden rounded-lg border border-gray-200 bg-black cursor-pointer p-0 disabled:opacity-50"
                            style={{ aspectRatio: "16 / 9" }}
                            title={t("Xem video")}
                          >
                            <video
                              src={previewSrc}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover pointer-events-none"
                            />
                            <span className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-30">
                              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white bg-opacity-90">
                                <RiPlayFill className="text-gray-800 text-sm" />
                              </span>
                            </span>
                          </button>
                        ) : (
                          <div
                            className="flex items-center justify-center w-full rounded-lg border border-dashed border-gray-200 bg-gray-100 text-xs text-gray-400"
                            style={{ aspectRatio: "16 / 9" }}
                          >
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <div className="flex items-center justify-end gap-2 w-full">
            <Button text={t("Đóng")} onClick={handleClose} disabled={merging} className="px-4" />
            <Button
              primary
              text={merging ? t("Đang ghép...") : t("Ghép ngay")}
              onClick={() => void handleMergeNow()}
              disabled={!canMergeNow}
              isLoading={merging}
              className="px-4"
            />
          </div>
        </Dialog.Footer>
      </Dialog>

      {zoomSrc && (
        <VideoDialog videoUrl={zoomSrc} isOpen={!!zoomSrc} onClose={() => setZoomSrc(null)} />
      )}
    </>
  );
}

