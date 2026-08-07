import { useState } from "react";
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
import { Button } from "../shared/utilities/form";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import FilmShotFrameDialog, {
  FilmShotFrameGenerateInput,
} from "./film-shot-frame-dialog";
import FilmShotImageCard, {
  sceneFrameCreating,
  sceneFrameReady,
} from "./film-shot-image-card";
import { FilmCharacterRecord, FilmSceneRecord } from "./film-types";

type Props = {
  scenes: FilmSceneRecord[];
  characters: FilmCharacterRecord[];
  onCreateFrame: (input: FilmShotFrameGenerateInput) => Promise<void>;
  onBulkCreateFrames?: () => Promise<void>;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Storyboard" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmShotImagesPanel({
  scenes,
  characters,
  onCreateFrame,
  onBulkCreateFrames,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("shot_images");
  const [busy, setBusy] = useState(false);
  const [editScene, setEditScene] = useState<FilmSceneRecord | null>(null);

  const readyCount = scenes.filter(sceneFrameReady).length;
  const allDone = scenes.length > 0 && readyCount === scenes.length;
  const anyCreating = scenes.some(sceneFrameCreating);

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "shot_images") onTabNavigate?.(id);
  };

  const openDialog = (scene: FilmSceneRecord) => {
    if (sceneFrameCreating(scene) || busy) return;
    // use latest scene from list
    const current = scenes.find((s) => s.id === scene.id) || scene;
    setEditScene(current);
  };

  const handleGenerate = async (input: FilmShotFrameGenerateInput) => {
    setBusy(true);
    try {
      await onCreateFrame(input);
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async () => {
    if (busy || !onBulkCreateFrames) return;
    setBusy(true);
    try {
      await onBulkCreateFrames();
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
                isLoading={busy || anyCreating}
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
              title={t("Sắp ra mắt")}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
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
            scenes
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((scene) => (
                <FilmShotImageCard
                  key={scene.id}
                  scene={scene}
                  onCreateFrame={openDialog}
                />
              ))
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

      <FilmShotFrameDialog
        isOpen={!!editScene}
        scene={editScene}
        characters={characters}
        onClose={() => setEditScene(null)}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
