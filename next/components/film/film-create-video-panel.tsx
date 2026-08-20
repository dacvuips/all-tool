import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiDownload,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import {
  FILM_MEDIA_CARD_GRID_CLASS,
  FILM_MEDIA_CARD_GRID_PAD_CLASS,
} from "./film-media-card-grid";
import FilmShotImageCard from "./film-shot-image-card";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import { FilmAspectRatio, FilmSceneRecord } from "./film-types";
import { sceneVideoCreating, sceneVideoReady } from "./film-video-card";
import {
  FILM_VIDEO_REF_MODE_OPTIONS,
  padVideoRefSlots,
  type FilmVideoRefMode,
  type FilmVideoRefSlot,
} from "./film-video-ref-mode";

type Props = {
  scenes: FilmSceneRecord[];
  aspectRatio?: FilmAspectRatio;
  onCreateVideo: (scene: FilmSceneRecord) => Promise<void>;
  onStopVideo?: (scene: FilmSceneRecord) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onBulkCreateVideos: () => Promise<void>;
  onDownloadAll?: () => void;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
  /** Click tiêu đề card → mở đúng phân cảnh trong Chuỗi Cảnh quay */
  onOpenStoryboardScene?: (scene: FilmSceneRecord) => void;
  /** Chọn chế độ Bắt đầu / Thành phần / Start-End → seed slot */
  onVideoRefModeChange?: (
    mode: FilmVideoRefMode,
    opts?: { rebuild?: boolean }
  ) => void | Promise<void>;
  onVideoRefSlotsChange?: (
    scene: FilmSceneRecord,
    slots: Array<FilmVideoRefSlot | null>
  ) => void | Promise<void>;
  /** Mode đang chọn (parent điều khiển sau seed) */
  videoRefMode?: FilmVideoRefMode;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi Cảnh quay" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmCreateVideoPanel({
  scenes,
  aspectRatio = "9:16",
  onCreateVideo,
  onStopVideo,
  stopPendingIds,
  onBulkCreateVideos,
  onDownloadAll,
  onTabNavigate,
  onOpenStoryboardScene,
  onVideoRefModeChange,
  onVideoRefSlotsChange,
  videoRefMode: videoRefModeProp = "start",
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("create_video");
  const [busy, setBusy] = useState(false);
  const [videoRefMode, setVideoRefMode] =
    useState<FilmVideoRefMode>(videoRefModeProp);
  const [modeBusy, setModeBusy] = useState(false);

  useEffect(() => {
    setVideoRefMode(videoRefModeProp);
  }, [videoRefModeProp]);

  const readyCount = scenes.filter(sceneVideoReady).length;
  const allDone = scenes.length > 0 && readyCount === scenes.length;
  const anyCreating = scenes.some(sceneVideoCreating);

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "create_video") onTabNavigate?.(id);
  };

  const handleCreate = async (scene: FilmSceneRecord) => {
    if (busy || sceneVideoCreating(scene)) return;
    setBusy(true);
    try {
      await onCreateVideo(scene);
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async () => {
    if (busy || !scenes.length) return;
    setBusy(true);
    try {
      await onBulkCreateVideos();
    } finally {
      setBusy(false);
    }
  };

  const handleSelectMode = async (mode: FilmVideoRefMode) => {
    if (modeBusy) return;
    setVideoRefMode(mode);
    if (!onVideoRefModeChange) return;
    setModeBusy(true);
    try {
      await onVideoRefModeChange(mode, { rebuild: true });
    } finally {
      setModeBusy(false);
    }
  };

  /** Theo dõi ảnh khung + slot — seed lại khi frame có mà slot 1 còn trống. */
  const refSeedSignal = useMemo(
    () =>
      scenes
        .map((s) => {
          const frameUrl = (s.frameImageUrl || "").trim();
          const frameBlob = s.frameImageBlob instanceof Blob ? s.frameImageBlob.size : 0;
          const slot = padVideoRefSlots(s.videoRefSlots, videoRefMode)[0];
          const slotUrl = (slot?.imageUrl || "").trim();
          const slotBlob = slot?.imageBlob instanceof Blob ? slot.imageBlob.size : 0;
          return `${s.id}:${frameUrl}:${frameBlob}:${slotUrl}:${slotBlob}`;
        })
        .join("|"),
    [scenes, videoRefMode]
  );

  useEffect(() => {
    if (!onVideoRefModeChange || !scenes.length) return;
    void onVideoRefModeChange(videoRefMode, { rebuild: false });
  }, [refSeedSignal, onVideoRefModeChange, videoRefMode, scenes.length]);

  return (
    <div className="flex relative flex-col gap-3 h-full min-h-0">
      <div className="flex flex-wrap gap-1 items-center">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-white bg-opacity-70"
              }`}
            >
              {item.id === "storyboard" && !active && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
              {t(item.label)}
            </button>
          );
        })}
      </div>

      <div className="flex overflow-hidden flex-col flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-50 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-2.5 min-w-0 flex-shrink-0">
            <div className="flex flex-shrink-0 justify-center items-center w-9 h-9 bg-gray-100 rounded-xl">
              <HiVideoCamera className="text-lg text-gray-500" />
            </div>
            <div>
              <h2 className="m-0 text-base font-bold text-gray-900">{t("Bảng sản xuất")}</h2>
              <p className="text-xs text-gray-400 m-0 mt-0.5 flex flex-wrap gap-x-1">
                <span>
                  {scenes.length} {t("Cảnh quay")}
                </span>
                <span>·</span>
                <span>
                  {readyCount}/{scenes.length || 0} {t("đã tạo")}
                </span>
                {allDone && scenes.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-green-600">{t("Hoàn thành")}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-1 justify-center items-center min-w-0">
            <div className="inline-flex items-center gap-1 flex-wrap border border-gray-200 rounded-full p-0.5 w-max">
              {FILM_VIDEO_REF_MODE_OPTIONS.map((opt) => {
                const active = videoRefMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={modeBusy}
                    onClick={() => void handleSelectMode(opt.id)}
                    data-tooltip={t(opt.description)}
                    data-placement="bottom"
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-0 cursor-pointer transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "bg-transparent text-gray-600 hover:bg-gray-50"
                    } ${modeBusy ? "opacity-60" : ""}`}
                  >
                    {t(opt.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap flex-shrink-0 gap-2 items-center lg:justify-end">
            <Button
              outline
              small
              text={t("Tải tất cả (.zip)")}
              icon={<HiDownload />}
              className="!rounded-lg"
              onClick={() => onDownloadAll?.()}
              disabled={!readyCount}
            />
            <Button
              primary
              small
              text={t("Tạo hàng loạt")}
              icon={<HiVideoCamera />}
              className="!rounded-lg !bg-orange-500 hover:!bg-orange-600 !border-orange-500"
              onClick={handleBulk}
              isLoading={busy || anyCreating}
              disabled={!scenes.length || allDone}
            />
          </div>
        </div>

        <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
          {scenes.length === 0 ? (
            <div className="flex flex-col gap-2 justify-center items-center h-full text-center min-h-2xs">
              <p className="m-0 text-sm text-gray-500">
                {t("Chưa có cảnh quay. Tạo Chuỗi Cảnh quay trước rồi quay lại bước này.")}
              </p>
              <Button
                outline
                text={t("Mở Chuỗi Cảnh quay")}
                className="!rounded-lg"
                onClick={() => onTabNavigate?.("storyboard")}
              />
            </div>
          ) : (
            <div className={FILM_MEDIA_CARD_GRID_CLASS}>
              {scenes
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((scene) => (
                  <FilmShotImageCard
                    key={scene.id}
                    scene={scene}
                    aspectRatio={aspectRatio}
                    forcedTab="video"
                    hideImageTab
                    videoRefMode={videoRefMode}
                    onVideoRefSlotsChange={
                      onVideoRefSlotsChange
                        ? (s, slots) => {
                            void onVideoRefSlotsChange(s, slots);
                          }
                        : undefined
                    }
                    onCreateVideo={handleCreate}
                    onStopVideo={
                      onStopVideo
                        ? (s) => {
                            void onStopVideo(s);
                          }
                        : undefined
                    }
                    videoActionPending={!!stopPendingIds?.[`video:${scene.id}`]}
                    onTitleClick={onOpenStoryboardScene}
                  />
                ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end gap-0.5">
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiThumbUp />
          </button>
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiThumbDown />
          </button>
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiAnnotation />
          </button>
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiShare />
          </button>
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiSparkles />
          </button>
          <button
            type="button"
            className="flex justify-center items-center w-8 h-8 text-gray-400 bg-transparent rounded-lg border-0 cursor-pointer hover:bg-gray-50"
          >
            <HiDotsVertical />
          </button>
        </div>
      </div>
    </div>
  );
}
