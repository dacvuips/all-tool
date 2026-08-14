import { useTranslation } from "react-i18next";
import { HiDocumentText, HiPencil, HiUserGroup } from "react-icons/hi";
import { FilmProjectRecord } from "./film-types";
import { filmTimeAgo } from "./film-utils";

type Props = {
  project: FilmProjectRecord;
  onClick?: () => void;
  onEdit?: (project: FilmProjectRecord) => void;
};

export default function FilmProjectCard({ project, onClick, onEdit }: Props) {
  const { t } = useTranslation();
  const progress = Math.min(100, Math.max(0, project.progress ?? 0));

  return (
    <div className="relative group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
      {onEdit && (
        <button
          type="button"
          title={t("Sửa dự án")}
          aria-label={t("Sửa dự án")}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project);
          }}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center
            text-gray-400 bg-white bg-opacity-90 border border-gray-100 shadow-sm
            opacity-100 sm:opacity-0 sm:group-hover:opacity-100
            hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50
            transition-all cursor-pointer"
        >
          <HiPencil className="text-base" />
        </button>
      )}

      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-5 cursor-pointer bg-transparent border-0 rounded-2xl"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wide pr-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>
            {project.episodeCount} {t("TẬP")}
          </span>
        </div>

        <h3 className="mt-2 text-lg font-bold text-gray-900 leading-snug line-clamp-2 m-0 pr-6">
          {project.name}
        </h3>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {project.artStyleLabel && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
              {project.artStyleLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <HiUserGroup className="text-sm" />
            {project.characterCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <HiDocumentText className="text-sm" />
            {project.sceneCount}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
            {filmTimeAgo(project.updatedAt, t)}
          </span>
        </div>
      </button>
    </div>
  );
}
