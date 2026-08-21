import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiChevronDown,
  HiDotsVertical,
  HiDownload,
  HiRefresh,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import type { GeneratedVideoData } from "../app/affiliate-video/shared/scene-card-video-tab";
import { Button } from "../shared/utilities/form";
import { Dropdown } from "../shared/utilities/popover/dropdown";
import type { FilmAttachOption } from "./film-attach-fields";
import {
  FILM_MEDIA_CARD_GRID_CLASS,
  FILM_MEDIA_CARD_GRID_PAD_CLASS,
} from "./film-media-card-grid";
import FilmSceneEditDialog from "./film-scene-edit-dialog";
import { resolveFilmSceneImagePrompt } from "./film-scene-image-prompt";
import {
  resolveFilmSceneAudioPrompt,
  resolveFilmSceneVideoPrompt,
  withBuiltSceneVideoPrompt,
} from "./film-scene-video-prompt";
import FilmShotImageCard from "./film-shot-image-card";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import {
  FilmAspectRatio,
  FilmCharacterRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
  filmCharacterLinkedToEpisode,
  filmLocationLinkedToEpisode,
  filmPropLinkedToEpisode,
} from "./film-types";
import { sceneVideoCreating, sceneVideoReady } from "./film-video-card";
import {
  FILM_VIDEO_REF_MODE_OPTIONS,
  padVideoRefSlots,
  type FilmVideoRefMode,
  type FilmVideoRefSlot,
} from "./film-video-ref-mode";

export type FilmBulkCreateVideoMode = "all" | "errors";

type Props = {
  scenes: FilmSceneRecord[];
  aspectRatio?: FilmAspectRatio;
  characters?: FilmCharacterRecord[];
  propsList?: FilmPropRecord[];
  sceneImages?: FilmSceneImageRecord[];
  storyboardImagePromptStyle?: string | null;
  storyboardVideoPromptStyle?: string | null;
  storyboardAudioPromptStyle?: string | null;
  onCreateVideo: (scene: FilmSceneRecord) => Promise<void>;
  onStopVideo?: (scene: FilmSceneRecord) => void | Promise<void>;
  /** Upload / gallery → gán video scene */
  onSetSceneVideo?: (
    scene: FilmSceneRecord,
    video: GeneratedVideoData
  ) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onBulkCreateVideos: (mode: FilmBulkCreateVideoMode) => Promise<void>;
  onDownloadAll?: () => void;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
  /** Icon cạnh tiêu đề → mở đúng phân cảnh trong Chuỗi phân cảnh */
  onOpenStoryboardScene?: (scene: FilmSceneRecord) => void;
  onSaveScene?: (scene: FilmSceneRecord) => void | Promise<void>;
  onOpenAttachEntity?: (
    kind: "character" | "prop" | "location",
    option: FilmAttachOption
  ) => void;
  onVideoRefModeChange?: (
    mode: FilmVideoRefMode,
    opts?: { rebuild?: boolean }
  ) => void | Promise<void>;
  onVideoRefSlotsChange?: (
    scene: FilmSceneRecord,
    slots: Array<FilmVideoRefSlot | null>
  ) => void | Promise<void>;
  videoRefMode?: FilmVideoRefMode;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi phân cảnh" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmCreateVideoPanel({
  scenes,
  aspectRatio = "9:16",
  characters = [],
  propsList = [],
  sceneImages = [],
  storyboardImagePromptStyle,
  storyboardVideoPromptStyle,
  storyboardAudioPromptStyle,
  onCreateVideo,
  onStopVideo,
  onSetSceneVideo,
  stopPendingIds,
  onBulkCreateVideos,
  onDownloadAll,
  onTabNavigate,
  onOpenStoryboardScene,
  onSaveScene,
  onOpenAttachEntity,
  onVideoRefModeChange,
  onVideoRefSlotsChange,
  videoRefMode: videoRefModeProp = "start",
}: Props) {
  const { t } = useTranslation();
  const bulkBtnRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<FilmStoryboardTab>("create_video");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [videoRefMode, setVideoRefMode] =
    useState<FilmVideoRefMode>(videoRefModeProp);
  const [modeBusy, setModeBusy] = useState(false);

  useEffect(() => {
    setVideoRefMode(videoRefModeProp);
  }, [videoRefModeProp]);

  const readyCount = scenes.filter(sceneVideoReady).length;
  const errorCount = scenes.filter((s) => s.videoStatus === "error").length;
  const allSilentLipSync =
    scenes.length > 0 && scenes.every((s) => !!s.videoSilentLipSync);

  const applySilentLipSync = (
    scene: FilmSceneRecord,
    enabled: boolean
  ): FilmSceneRecord => {
    const next: FilmSceneRecord = {
      ...scene,
      videoSilentLipSync: enabled,
      updatedAt: new Date().toISOString(),
    };
    if (next.videoPromptCustom) return next;
    return withBuiltSceneVideoPrompt(next, storyboardVideoPromptStyle);
  };

  const handleToggleSilentLipSync = (scene: FilmSceneRecord) => {
    if (!onSaveScene) return;
    void onSaveScene(applySilentLipSync(scene, !scene.videoSilentLipSync));
  };

  const handleToggleSilentLipSyncAll = () => {
    if (!onSaveScene || !scenes.length) return;
    const nextEnabled = !allSilentLipSync;
    void (async () => {
      for (const scene of scenes) {
        await onSaveScene(applySilentLipSync(scene, nextEnabled));
      }
    })();
  };
  const creatingCount = scenes.filter(sceneVideoCreating).length;
  const allDone = scenes.length > 0 && readyCount === scenes.length;
  const canBulkAll = scenes.length > 0 && creatingCount < scenes.length;
  const canBulkErrors = errorCount > 0;
  const editScene = editSceneId
    ? scenes.find((s) => s.id === editSceneId) || null
    : null;
  const episodeId = editScene?.episodeId || scenes[0]?.episodeId;

  const characterOptions: FilmAttachOption[] = useMemo(
    () =>
      characters
        .filter((c) => filmCharacterLinkedToEpisode(c, episodeId))
        .map((c) => ({
          id: c.id,
          name: c.name,
          imageBlob: c.imageBlob,
          imageUrl: c.imageUrl,
          imageUrls: c.imageUrls,
        })),
    [characters, episodeId]
  );

  const propOptions: FilmAttachOption[] = useMemo(
    () =>
      propsList
        .filter((p) => filmPropLinkedToEpisode(p, episodeId))
        .map((p) => ({
          id: p.id,
          name: p.name,
          imageBlob: p.imageBlob,
          imageUrl: p.imageUrl,
          imageUrls: p.imageUrls,
        })),
    [propsList, episodeId]
  );

  const sceneLocationOptions: FilmAttachOption[] = useMemo(
    () =>
      sceneImages
        .filter((s) => filmLocationLinkedToEpisode(s, episodeId))
        .map((s) => ({
          id: s.id,
          name: s.name,
          imageBlob: s.imageBlob,
          imageUrl: s.imageUrl,
          imageUrls: s.imageUrls,
        })),
    [sceneImages, episodeId]
  );

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "create_video") onTabNavigate?.(id);
  };

  const handleCreate = async (scene: FilmSceneRecord) => {
    if (sceneVideoCreating(scene)) return;
    await onCreateVideo(scene);
  };

  const handleBulk = async (mode: FilmBulkCreateVideoMode) => {
    if (bulkBusy || !scenes.length) return;
    if (mode === "errors" && !canBulkErrors) return;
    if (mode === "all" && !canBulkAll) return;
    setBulkBusy(true);
    try {
      await onBulkCreateVideos(mode);
    } finally {
      setBulkBusy(false);
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
            <div className="inline-flex items-center gap-1 whitespace-nowrap border border-gray-200 rounded-full p-0.5 w-max">
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
              text={
                allSilentLipSync
                  ? t("Bật tiếng tất cả")
                  : t("Nhép miệng")
              }
              icon={allSilentLipSync ? <MdRecordVoiceOver /> : <MdVoiceOverOff />}
              className={`!rounded-lg ${
                allSilentLipSync
                  ? "!border-red-200 !text-red-600 !bg-red-50 hover:!bg-red-100"
                  : ""
              }`}
              onClick={handleToggleSilentLipSyncAll}
              disabled={!scenes.length || !onSaveScene}
              data-tooltip={t(
                "Giữ thoại để nhép miệng; video gen không nói tiếng (dùng Tạo giọng + Studio)"
              )}
            />
            <Button
              outline
              small
              text={t("Tải tất cả")}
              icon={<HiDownload />}
              className="!rounded-lg"
              onClick={() => onDownloadAll?.()}
              disabled={!readyCount}
            />
            <Button
              primary
              small
              text={
                <span className="inline-flex items-center gap-1">
                  {t("Tạo hàng loạt")}
                  <HiChevronDown className="text-sm opacity-90" />
                </span>
              }
              icon={<HiVideoCamera />}
              className="!rounded-lg !bg-orange-500 hover:!bg-orange-600 !border-orange-500"
              innerRef={bulkBtnRef}
              isLoading={bulkBusy}
              disabled={!scenes.length || bulkBusy || (!canBulkAll && !canBulkErrors)}
            />
            <Dropdown reference={bulkBtnRef} placement="bottom-end">
              <Dropdown.Item
                text={t("Tạo lại tất cả")}
                icon={<HiRefresh />}
                disabled={!canBulkAll || bulkBusy}
                onClick={() => void handleBulk("all")}
              />
              <Dropdown.Item
                text={`${t("Tạo lại video lỗi")}${errorCount ? ` (${errorCount})` : ""}`}
                icon={<HiVideoCamera />}
                disabled={!canBulkErrors || bulkBusy}
                onClick={() => void handleBulk("errors")}
              />
            </Dropdown>
          </div>
        </div>

        <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
          {scenes.length === 0 ? (
            <div className="flex flex-col gap-2 justify-center items-center h-full text-center min-h-2xs">
              <p className="m-0 text-sm text-gray-500">
                {t("Chưa có cảnh quay. Tạo Chuỗi phân cảnh trước rồi quay lại bước này.")}
              </p>
              <Button
                outline
                small
                text={t("Mở Chuỗi phân cảnh")}
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
                    onSetSceneVideo={
                      onSetSceneVideo
                        ? (s, video) => {
                            void onSetSceneVideo(s, video);
                          }
                        : undefined
                    }
                    videoActionPending={!!stopPendingIds?.[`video:${scene.id}`]}
                    onEditScene={(s) => setEditSceneId(s.id)}
                    onOpenStoryboardScene={onOpenStoryboardScene}
                    onToggleSilentLipSync={
                      onSaveScene ? handleToggleSilentLipSync : undefined
                    }
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

      <FilmSceneEditDialog
        isOpen={!!editScene}
        scene={editScene}
        imagePromptDefault={
          editScene
            ? resolveFilmSceneImagePrompt(editScene, storyboardImagePromptStyle)
            : ""
        }
        videoPromptDefault={
          editScene
            ? resolveFilmSceneVideoPrompt(editScene, storyboardVideoPromptStyle)
            : ""
        }
        audioPromptDefault={
          editScene
            ? resolveFilmSceneAudioPrompt(editScene, storyboardAudioPromptStyle)
            : ""
        }
        characterOptions={characterOptions}
        propOptions={propOptions}
        sceneLocationOptions={sceneLocationOptions}
        onClose={() => setEditSceneId(null)}
        onSave={async (next) => {
          if (!onSaveScene) return;
          await onSaveScene(next);
        }}
        onOpenAttachEntity={onOpenAttachEntity}
      />
    </div>
  );
}
