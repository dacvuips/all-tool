import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiShare,
  HiSparkles,
  HiTemplate,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
  HiViewGrid,
} from "react-icons/hi";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { Button } from "../shared/utilities/form";
import type { FilmAttachOption } from "./film-attach-fields";
import type { FilmAttachIssueKind } from "./film-attachment-validate";
import {
  FILM_MEDIA_CARD_GRID_CLASS,
  FILM_MEDIA_CARD_GRID_PAD_CLASS,
} from "./film-media-card-grid";
import FilmSceneEditDialog from "./film-scene-edit-dialog";
import { resolveFilmSceneImagePrompt } from "./film-scene-image-prompt";
import {
  resolveFilmSceneAudioPrompt,
  resolveFilmSceneVideoPrompt,
} from "./film-scene-video-prompt";
import {
  type FilmShotFrameGenerateInput,
  resolveFilmShotFrameActivePrompt,
} from "./film-shot-frame-dialog";
import FilmShotImageCard, {
  sceneFrameCreating,
  sceneFrameReady,
} from "./film-shot-image-card";
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

type Props = {
  scenes: FilmSceneRecord[];
  characters: FilmCharacterRecord[];
  aspectRatio?: FilmAspectRatio;
  storyboardImagePromptStyle?: string | null;
  storyboardVideoPromptStyle?: string | null;
  storyboardAudioPromptStyle?: string | null;
  onCreateFrame: (input: FilmShotFrameGenerateInput) => Promise<void>;
  onStopFrame?: (scene: FilmSceneRecord) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onSetFrameImage?: (scene: FilmSceneRecord, image: GeneratedImageData) => Promise<void>;
  onBulkCreateFrames?: () => Promise<void>;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
  /** Icon cạnh tiêu đề → mở đúng phân cảnh trong Chuỗi phân cảnh */
  onOpenStoryboardScene?: (scene: FilmSceneRecord) => void;
  onSaveScene?: (scene: FilmSceneRecord) => void | Promise<void>;
  propsList?: FilmPropRecord[];
  sceneImages?: FilmSceneImageRecord[];
  onOpenAttachEntity?: (kind: FilmAttachIssueKind, option: FilmAttachOption) => void;
  onDetachAttach?: (scene: FilmSceneRecord, kind: FilmAttachIssueKind, name: string) => void;
  onSuggestSafePrompt?: (scene: FilmSceneRecord) => Promise<void> | void;
  onFramePromptSourceChange?: (
    scene: FilmSceneRecord,
    source: "main" | "suggested"
  ) => Promise<void> | void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi phân cảnh" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmShotImagesPanel({
  scenes,
  characters,
  aspectRatio = "9:16",
  storyboardImagePromptStyle,
  storyboardVideoPromptStyle,
  storyboardAudioPromptStyle,
  onCreateFrame,
  onStopFrame,
  stopPendingIds,
  onSetFrameImage,
  onBulkCreateFrames,
  onTabNavigate,
  onOpenStoryboardScene,
  onSaveScene,
  propsList = [],
  sceneImages = [],
  onOpenAttachEntity,
  onDetachAttach,
  onSuggestSafePrompt,
  onFramePromptSourceChange,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("shot_images");
  /** Chỉ true khi đang chạy "Tạo hàng loạt" — gen đơn không khóa nút bulk. */
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);

  const readyCount = scenes.filter(sceneFrameReady).length;
  const allDone = scenes.length > 0 && readyCount === scenes.length;
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
    if (id !== "shot_images") onTabNavigate?.(id);
  };

  /** Tạo ngay — ưu tiên prompt đề xuất AI nếu đang chọn */
  const handleCreate = async (scene: FilmSceneRecord) => {
    if (sceneFrameCreating(scene)) return;
    const latest = scenes.find((s) => s.id === scene.id) || scene;
    if (sceneFrameCreating(latest)) return;

    const input: FilmShotFrameGenerateInput = {
      scene: latest,
      prompt: resolveFilmShotFrameActivePrompt(latest, storyboardImagePromptStyle),
    };

    await onCreateFrame(input);
  };

  const handleBulk = async () => {
    if (bulkBusy || !onBulkCreateFrames) return;
    setBulkBusy(true);
    try {
      await onBulkCreateFrames();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 relative">
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              {t(item.label)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-1 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl  flex items-center justify-center flex-shrink-0">
              <HiVideoCamera className="text-lg text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0">{t("Bảng sản xuất")}</h2>
              <p className="text-xs text-gray-400 m-0 mt-0.5 flex flex-wrap gap-x-1">
                <span>
                  {scenes.length} {t("Cảnh quay")}
                </span>
                <span>·</span>
                <span>
                  {readyCount}/{scenes.length || 0} {t("đã có khung hình")}
                </span>
                <span>·</span>
                <span className={allDone ? "text-green-600" : "text-blue-600"}>
                  {allDone ? t("Đã cấu hình") : t("Chưa cấu hình")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {onBulkCreateFrames && (
              <Button
                outline
                small
                text={t("Tạo hàng loạt")}
                icon={<HiTemplate />}
                className="!rounded-lg"
                onClick={handleBulk}
                isLoading={bulkBusy}
                disabled={!scenes.length || allDone}
              />
            )}
            <Button
              outline
              small
              text={t("Công cụ Grid")}
              icon={<HiViewGrid />}
              className="!rounded-lg"
              disabled
              tooltip={t("Sắp ra mắt")}
            />
          </div>
        </div>

        <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
          {scenes.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-gray-500 m-0">
                {t("Chưa có cảnh quay. Tạo Chuỗi phân cảnh trước rồi quay lại bước này.")}
              </p>
              <Button
                outline
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
                    storyboardImagePromptStyle={storyboardImagePromptStyle}
                    hideVideoTab
                    onCreateFrame={(s) => {
                      void handleCreate(s);
                    }}
                    onStopFrame={
                      onStopFrame
                        ? (s) => {
                            void onStopFrame(s);
                          }
                        : undefined
                    }
                    generationActionPending={!!stopPendingIds?.[scene.id]}
                    onSetFrameImage={
                      onSetFrameImage
                        ? (s, image) => {
                            void onSetFrameImage(s, image);
                          }
                        : undefined
                    }
                    onEditScene={(s) => setEditSceneId(s.id)}
                    onOpenStoryboardScene={onOpenStoryboardScene}
                    characters={characters}
                    propsList={propsList}
                    sceneImages={sceneImages}
                    onOpenAttachEntity={onOpenAttachEntity}
                    onDetachAttach={onDetachAttach}
                    onSuggestSafePrompt={
                      onSuggestSafePrompt
                        ? (s) => {
                            void onSuggestSafePrompt(s);
                          }
                        : undefined
                    }
                    onFramePromptSourceChange={
                      onFramePromptSourceChange
                        ? (s, source) => {
                            void onFramePromptSourceChange(s, source);
                          }
                        : undefined
                    }
                  />
                ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end gap-0.5">
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbUp />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbDown />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiAnnotation />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiShare />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiSparkles />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
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
