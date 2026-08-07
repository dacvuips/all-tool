import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDownload,
  HiDotsVertical,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import FilmVideoCard, { sceneVideoCreating, sceneVideoReady } from "./film-video-card";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scenes: FilmSceneRecord[];
  onCreateVideo: (scene: FilmSceneRecord) => Promise<void>;
  onBulkCreateVideos: () => Promise<void>;
  onDownloadAll?: () => void;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Storyboard" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmCreateVideoPanel({
  scenes,
  onCreateVideo,
  onBulkCreateVideos,
  onDownloadAll,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("create_video");
  const [busy, setBusy] = useState(false);

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

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
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
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              outline
              small
              text={t("Tải tất cả video (.zip)")}
              icon={<HiDownload />}
              className="!rounded-lg"
              onClick={() => onDownloadAll?.()}
              disabled={!readyCount}
            />
            <Button
              primary
              small
              text={t("Tạo video hàng loạt")}
              icon={<HiVideoCamera />}
              className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
              onClick={handleBulk}
              isLoading={busy || anyCreating}
              disabled={!scenes.length || allDone}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {scenes.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-gray-500 m-0">
                {t("Chưa có cảnh quay. Tạo storyboard trước rồi quay lại bước này.")}
              </p>
              <Button
                outline
                text={t("Mở Storyboard")}
                className="!rounded-lg"
                onClick={() => onTabNavigate?.("storyboard")}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {scenes
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((scene) => (
                  <FilmVideoCard
                    key={scene.id}
                    scene={scene}
                    onCreateVideo={handleCreate}
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
    </div>
  );
}
