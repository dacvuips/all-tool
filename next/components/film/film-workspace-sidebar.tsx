import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBookOpen,
  HiCamera,
  HiCheckCircle,
  HiChip,
  HiCog,
  HiCollection,
  HiPlay,
  HiViewGrid,
} from "react-icons/hi";
import { RiCloseLine, RiLoader4Line, RiMenuLine, RiUserVoiceLine } from "react-icons/ri";
import { FilmWorkspaceStep, FilmWorkspaceStepId } from "./film-types";
import { FILM_PRODUCTION_PROGRESS_TOTAL, FILM_WORKSPACE_STEPS } from "./film-workspace-steps";

type Props = {
  activeStep: FilmWorkspaceStepId;
  progressDone?: number;
  doneStepIds?: FilmWorkspaceStepId[];
  /** Step đang có item generate — hiện spinner bên phải nút */
  loadingStepIds?: FilmWorkspaceStepId[];
  onStepChange: (step: FilmWorkspaceStepId) => void;
  onRefresh?: () => void;
};

function stepIcon(item: FilmWorkspaceStep, active: boolean) {
  const className = `text-base ${active ? "text-blue-600" : "text-gray-400"}`;
  switch (item.id) {
    case "original_content":
      return <HiBookOpen className={className} />;
    case "storyboard":
      return <HiViewGrid className={className} />;
    case "character_images":
      return <HiCollection className={className} />;
    case "props":
      return <HiChip className={className} />;
    case "scene_images":
      return <HiCamera className={className} />;
    case "voice":
      return <RiUserVoiceLine className={className} />;
    case "shot_images":
      return <HiCamera className={className} />;
    case "create_video":
      return <HiPlay className={className} />;
    case "settings":
      return <HiCog className={className} />;
    default:
      return <HiBookOpen className={className} />;
  }
}

export default function FilmWorkspaceSidebar({
  activeStep,
  progressDone = 0,
  doneStepIds = [],
  loadingStepIds = [],
  onStepChange,
  onRefresh,
}: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const scriptItems = FILM_WORKSPACE_STEPS.filter((i) => i.section === "script");
  const productionItems = FILM_WORKSPACE_STEPS.filter((i) => i.section === "production");
  const settingsItems = FILM_WORKSPACE_STEPS.filter((i) => i.section === "settings");
  const pct = Math.min(100, Math.round((progressDone / FILM_PRODUCTION_PROGRESS_TOTAL) * 100));
  const doneSet = new Set(doneStepIds);
  const loadingSet = new Set(loadingStepIds);

  const handleStepChange = (id: FilmWorkspaceStepId) => {
    onStepChange(id);
    setIsOpen(false);
  };

  const renderItem = (item: FilmWorkspaceStep) => {
    const active = activeStep === item.id;
    const loading = loadingSet.has(item.id);
    const done = !loading && (doneSet.has(item.id) || !!item.done);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleStepChange(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer border-0 ${
          active ? "bg-blue-50 text-blue-700" : "bg-transparent text-gray-600 hover:bg-gray-50"
        }`}
      >
        {item.stepNo ? (
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-10 font-bold flex-shrink-0 ${
              active ? "text-white bg-blue-600" : "text-gray-500 bg-gray-100"
            }`}
          >
            {item.stepNo}
          </span>
        ) : (
          <span className="flex flex-shrink-0 justify-center items-center w-7 h-7 bg-gray-50 rounded-full">
            {stepIcon(item, active)}
          </span>
        )}
        <span className={`text-sm flex-1 min-w-0 ${active ? "font-semibold" : "font-medium"}`}>
          {t(item.label)}
        </span>
        {loading ? (
          <RiLoader4Line className="flex-shrink-0 text-base text-blue-500 animate-spin" />
        ) : done ? (
          <HiCheckCircle className="flex-shrink-0 text-base text-green-500" />
        ) : null}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`lg:hidden fixed top-1/2 -translate-y-1/2 -left-0.5 z-100 w-7 h-14 text-white rounded-r-lg bg-primary shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 hover:text-gray-800 transition-colors border ${
          isOpen ? "hidden" : ""
        }`}
        title={t("Mở menu")}
      >
        <RiMenuLine className="text-xl" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`
          flex-shrink-0 flex flex-col overflow-hidden
          lg:relative lg:translate-x-0 lg:w-64 lg:h-full lg:min-h-0
          transform fixed inset-y-0 left-0 z-50 w-72 pt-14 lg:pt-0
          transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <aside className="flex flex-col w-full h-full min-h-0 bg-white rounded-r-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-shrink-0 justify-end items-center px-3 pt-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer hover:bg-gray-200"
              title={t("Đóng")}
            >
              <RiCloseLine className="text-lg text-gray-600" />
            </button>
          </div>
          <div className="flex-1 p-3 space-y-4 min-h-0 overflow-y-auto">
            <div>
              <div className="px-3 mb-1.5 text-10 font-bold tracking-wider text-gray-400 uppercase">
                {t("Kịch bản")}
              </div>
              <div className="space-y-0.5">{scriptItems.map(renderItem)}</div>
            </div>

            <div>
              <div className="px-3 mb-1.5 text-10 font-bold tracking-wider text-gray-400 uppercase">
                {t("Nguyên liệu")}
              </div>
              <div className="space-y-0.5">{productionItems.map(renderItem)}</div>
            </div>

            {settingsItems.length > 0 && (
              <div>
                <div className="space-y-0.5">{settingsItems.map(renderItem)}</div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 p-3 space-y-3 border-t border-gray-100">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5 px-0.5">
                <span>
                  {t("Tiến độ")} {progressDone}/{FILM_PRODUCTION_PROGRESS_TOTAL}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="py-2 w-full text-sm font-medium text-gray-600 bg-gray-50 rounded-xl border-0 transition-colors cursor-pointer hover:text-blue-600 hover:bg-blue-50"
            >
              {t("Làm mới dữ liệu")}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
