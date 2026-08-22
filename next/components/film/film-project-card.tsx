import { useTranslation } from "react-i18next";
import { HiDocumentText, HiPencil, HiTrash, HiUserGroup } from "react-icons/hi";
import { FilmProjectRecord } from "./film-types";
import { filmTimeAgo } from "./film-utils";

type Props = {
  project: FilmProjectRecord;
  onClick?: () => void;
  onEdit?: (project: FilmProjectRecord) => void;
  onDelete?: (project: FilmProjectRecord) => void;
};

export default function FilmProjectCard({ project, onClick, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const progress = Math.min(100, Math.max(0, project.progress ?? 0));

  return (
    <div className="relative group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
      {(onEdit || onDelete) && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              type="button"
              title={t("Sửa dự án")}
              aria-label={t("Sửa dự án")}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                text-gray-400 bg-white bg-opacity-90 border border-gray-100 shadow-sm
                hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50
                transition-all cursor-pointer"
            >
              <HiPencil className="text-base" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title={t("Xóa dự án")}
              aria-label={t("Xóa dự án")}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                text-gray-400 bg-white bg-opacity-90 border border-gray-100 shadow-sm
                hover:text-red-600 hover:border-red-200 hover:bg-red-50
                transition-all cursor-pointer"
            >
              <HiTrash className="text-base" />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-4 sm:p-5 cursor-pointer bg-transparent border-0 rounded-2xl"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wide pr-10">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          <span>
            {project.episodeCount} {t("TẬP")}
          </span>
        </div>

        <h3 className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2 m-0 pr-8">
          {project.name}
        </h3>

        <div className="mt-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
          {project.artStyleLabel && (
            <span className="inline-flex items-center max-w-full px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 truncate">
              {project.artStyleLabel}
            </span>
          )}
          <div className="inline-flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <HiUserGroup className="text-sm flex-shrink-0" />
              {project.characterCount}
            </span>
            <span className="w-px h-3 bg-gray-200" aria-hidden />
            <span className="inline-flex items-center gap-1">
              <HiDocumentText className="text-sm flex-shrink-0" />
              {project.sceneCount}
            </span>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 space-y-1.5 xs:space-y-0 xs:flex xs:items-center xs:gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden min-w-0">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 xs:whitespace-nowrap xs:flex-shrink-0 block text-right xs:text-left">
            {filmTimeAgo(project.updatedAt, t)}
          </span>
        </div>
      </button>
    </div>
  );
}
