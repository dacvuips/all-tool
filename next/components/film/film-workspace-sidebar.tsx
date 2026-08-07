import { useTranslation } from "react-i18next";
import {
  HiBookOpen,
  HiCamera,
  HiCheckCircle,
  HiChip,
  HiCollection,
  HiMicrophone,
  HiPlay,
  HiViewGrid,
} from "react-icons/hi";
import { FilmWorkspaceStep, FilmWorkspaceStepId } from "./film-types";
import {
  FILM_PRODUCTION_PROGRESS_TOTAL,
  FILM_WORKSPACE_STEPS,
} from "./film-workspace-steps";

type Props = {
  activeStep: FilmWorkspaceStepId;
  progressDone?: number;
  doneStepIds?: FilmWorkspaceStepId[];
  onStepChange: (step: FilmWorkspaceStepId) => void;
  onRefresh?: () => void;
};

function stepIcon(item: FilmWorkspaceStep, active: boolean) {
  const className = `text-base ${
    active ? "text-blue-600" : item.done ? "text-green-500" : "text-gray-400"
  }`;
  if (item.done) return <HiCheckCircle className={className} />;
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
      return <HiMicrophone className={className} />;
    case "shot_images":
      return <HiCamera className={className} />;
    case "create_video":
      return <HiPlay className={className} />;
    default:
      return <HiBookOpen className={className} />;
  }
}

export default function FilmWorkspaceSidebar({
  activeStep,
  progressDone = 0,
  doneStepIds = [],
  onStepChange,
  onRefresh,
}: Props) {
  const { t } = useTranslation();
  const scriptItems = FILM_WORKSPACE_STEPS.filter((i) => i.section === "script");
  const productionItems = FILM_WORKSPACE_STEPS.filter((i) => i.section === "production");
  const pct = Math.min(100, Math.round((progressDone / FILM_PRODUCTION_PROGRESS_TOTAL) * 100));
  const doneSet = new Set(doneStepIds);

  const renderItem = (item: FilmWorkspaceStep) => {
    const active = activeStep === item.id;
    const done = doneSet.has(item.id) || !!item.done;
    const iconItem = { ...item, done };
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onStepChange(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer border-0 ${
          active ? "bg-blue-50 text-blue-700" : "bg-transparent text-gray-600 hover:bg-gray-50"
        }`}
      >
        {item.stepNo ? (
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-10 font-bold flex-shrink-0 ${
              active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {item.stepNo}
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-50">
            {stepIcon(iconItem, active)}
          </span>
        )}
        <span className={`text-sm flex-1 min-w-0 ${active ? "font-semibold" : "font-medium"}`}>
          {t(item.label)}
        </span>
        {done && !item.stepNo && (
          <HiCheckCircle className="text-green-500 text-base flex-shrink-0" />
        )}
        {done && item.stepNo && !active && (
          <HiCheckCircle className="text-green-500 text-base flex-shrink-0" />
        )}
      </button>
    );
  };

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="px-3 mb-1.5 text-10 font-bold tracking-wider text-gray-400 uppercase">
            {t("Kịch bản")}
          </div>
          <div className="space-y-0.5">{scriptItems.map(renderItem)}</div>
        </div>

        <div>
          <div className="px-3 mb-1.5 text-10 font-bold tracking-wider text-gray-400 uppercase">
            {t("Sản xuất")}
          </div>
          <div className="space-y-0.5">{productionItems.map(renderItem)}</div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5 px-0.5">
            <span>
              {t("Tiến độ")} {progressDone}/{FILM_PRODUCTION_PROGRESS_TOTAL}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="w-full text-sm font-medium text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-xl py-2 border-0 cursor-pointer transition-colors"
        >
          {t("Làm mới dữ liệu")}
        </button>
      </div>
    </aside>
  );
}
