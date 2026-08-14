import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiDownload,
  HiOutlinePhotograph,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import {
  buildFilmVoiceListItems,
  buildFilmVoiceSpeakerRoster,
  dialogueLineCreating,
  dialogueLineReady,
  type FilmVoiceListItem,
} from "./film-dialogue";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import { FilmCharacterRecord, FilmSceneRecord } from "./film-types";
import FilmVoiceCard from "./film-voice-card";
import FilmVoiceDialog, { FilmVoiceGenerateInput } from "./film-voice-dialog";

type Props = {
  scenes: FilmSceneRecord[];
  characters?: FilmCharacterRecord[];
  onCreateVoice: (input: FilmVoiceGenerateInput) => Promise<void>;
  onBulkCreateVoices?: () => Promise<void>;
  onDownloadAll?: () => void;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi Cảnh quay" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmVoicePanel({
  scenes,
  characters = [],
  onCreateVoice,
  onBulkCreateVoices,
  onDownloadAll,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("voice");
  const [busy, setBusy] = useState(false);
  const [editItem, setEditItem] = useState<FilmVoiceListItem | null>(null);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  const list = useMemo(() => buildFilmVoiceListItems(scenes), [scenes]);
  const speakers = useMemo(
    () => buildFilmVoiceSpeakerRoster(list, characters),
    [list, characters]
  );
  const visibleList = useMemo(() => {
    if (!speakerFilter) return list;
    return list.filter(
      (x) => x.line.character?.trim().toLowerCase() === speakerFilter
    );
  }, [list, speakerFilter]);
  const readyCount = list.filter((x) => dialogueLineReady(x.line)).length;
  const allDone = list.length > 0 && readyCount === list.length;
  const anyCreating = list.some((x) => dialogueLineCreating(x.line));

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "voice") onTabNavigate?.(id);
  };

  const openDialog = (item: FilmVoiceListItem) => {
    if (busy || dialogueLineCreating(item.line)) return;
    // refresh scene from list
    const scene = scenes.find((s) => s.id === item.scene.id) || item.scene;
    const refreshed = buildFilmVoiceListItems([scene]).find(
      (x) => x.line.id === item.line.id
    );
    setEditItem(refreshed || { ...item, scene });
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
        <div className="px-4 sm:px-5 py-1 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl  flex items-center justify-center flex-shrink-0">
              <HiVideoCamera className="text-lg text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0">{t("Bảng sản xuất")}</h2>
              <p className="text-xs text-gray-400 m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>
                  {list.length} {t("câu thoại")}
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

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
          {speakers.length > 0 ? (
            <aside className="flex-shrink-0 w-full md:w-56 lg:w-64 md:sticky md:top-0">
              <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-2">
                {t("Nhân vật")} · {speakers.length}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5 max-h-56 md:max-h-[min(22rem,50vh)] overflow-y-auto">
                {speakers.map((sp) => {
                  const src = sp.character ? getFilmEntityImageSrc(sp.character) : "";
                  const active =
                    speakerFilter === sp.name.trim().toLowerCase();
                  return (
                    <li key={sp.key}>
                      <button
                        type="button"
                        onClick={() =>
                          setSpeakerFilter((prev) =>
                            prev === sp.name.trim().toLowerCase()
                              ? null
                              : sp.name.trim().toLowerCase()
                          )
                        }
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border cursor-pointer text-left transition-colors ${
                          active
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-100 hover:bg-blue-50 hover:border-blue-200"
                        }`}
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={sp.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex justify-center items-center w-full h-full">
                              <HiOutlinePhotograph className="text-base text-gray-300" />
                            </div>
                          )}
                        </div>
                        <span
                          className={`min-w-0 flex-1 truncate text-sm font-bold ${
                            active ? "text-blue-800" : "text-gray-800"
                          }`}
                        >
                          {sp.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}

          <div className="flex-1 min-w-0 space-y-3">
            {list.length === 0 ? (
              <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
                <p className="text-sm text-gray-500 m-0 max-w-md">
                  {t(
                    "Chưa có thoại. Thêm field Thoại trong Chuỗi Cảnh quay (mỗi dòng: Tên nhân vật: lời thoại) hoặc trích xuất từ nội dung gốc."
                  )}
                </p>
                <Button
                  outline
                  text={t("Mở Chuỗi Cảnh quay")}
                  className="!rounded-lg"
                  onClick={() => onTabNavigate?.("storyboard")}
                />
              </div>
            ) : visibleList.length === 0 ? (
              <p className="text-sm text-gray-400 m-0 py-8 text-center">
                {t("Không có câu thoại của nhân vật này.")}
              </p>
            ) : (
              visibleList.map((item) => (
                <FilmVoiceCard
                  key={item.key}
                  item={item}
                  onCreateVoice={openDialog}
                />
              ))
            )}
          </div>
          </div>
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
        isOpen={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
