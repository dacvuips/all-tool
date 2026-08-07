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
import FilmVoiceDialog, { FilmVoiceGenerateInput } from "./film-voice-dialog";
import FilmVoiceCard, {
  sceneHasDialogue,
  sceneVoiceCreating,
  sceneVoiceReady,
} from "./film-voice-card";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scenes: FilmSceneRecord[];
  onCreateVoice: (input: FilmVoiceGenerateInput) => Promise<void>;
  onBulkCreateVoices?: () => Promise<void>;
  onDownloadAll?: () => void;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Storyboard" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmVoicePanel({
  scenes,
  onCreateVoice,
  onBulkCreateVoices,
  onDownloadAll,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("voice");
  const [busy, setBusy] = useState(false);
  const [editScene, setEditScene] = useState<FilmSceneRecord | null>(null);

  const dialogueScenes = scenes.filter(sceneHasDialogue);
  const list = dialogueScenes.length > 0 ? dialogueScenes : scenes;
  const readyCount = list.filter(sceneVoiceReady).length;
  const allDone = list.length > 0 && readyCount === list.length;
  const anyCreating = list.some(sceneVoiceCreating);

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "voice") onTabNavigate?.(id);
  };

  const openDialog = (scene: FilmSceneRecord) => {
    if (busy || sceneVoiceCreating(scene)) return;
    const current = scenes.find((s) => s.id === scene.id) || scene;
    setEditScene(current);
  };

  const handleConfirm = async (input: FilmVoiceGenerateInput) => {
    setBusy(true);
    try {
      await onCreateVoice(input);
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async () => {
    if (busy || !onBulkCreateVoices || !list.length) return;
    setBusy(true);
    try {
      await onBulkCreateVoices();
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
              <p className="text-xs text-gray-400 m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>
                  {list.length} {t("thoại có thể Tạo Giọng")}
                </span>
                <span>·</span>
                <span>
                  {readyCount}/{list.length || 0} {t("đã tạo")}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold ${
                    allDone
                      ? "bg-green-50 text-green-600 border border-green-100"
                      : "bg-gray-100 text-gray-500 border border-gray-100"
                  }`}
                >
                  {allDone ? t("Đã cấu hình") : t("Chưa cấu hình")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {onBulkCreateVoices && (
              <Button
                outline
                small
                text={t("Tạo hàng loạt")}
                className="!rounded-lg"
                onClick={handleBulk}
                isLoading={busy || anyCreating}
                disabled={!list.length || allDone}
              />
            )}
            <Button
              outline
              small
              text={t("Tải xuống âm thanh (.zip)")}
              icon={<HiDownload />}
              className="!rounded-lg"
              onClick={() => onDownloadAll?.()}
              disabled={!readyCount}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {list.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-gray-500 m-0">
                {t(
                  "Chưa có thoại. Thêm dialogue trong Storyboard hoặc trích xuất từ nội dung gốc."
                )}
              </p>
              <Button
                outline
                text={t("Mở Storyboard")}
                className="!rounded-lg"
                onClick={() => onTabNavigate?.("storyboard")}
              />
            </div>
          ) : (
            list
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((scene) => (
                <FilmVoiceCard
                  key={scene.id}
                  scene={scene}
                  onCreateVoice={openDialog}
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

      <FilmVoiceDialog
        isOpen={!!editScene}
        scene={editScene}
        onClose={() => setEditScene(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
