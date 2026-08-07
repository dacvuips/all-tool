import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiLockClosed, HiPencil, HiPhotograph } from "react-icons/hi";
import FilmMediaZoom, { FilmMediaZoomItem } from "./film-media-zoom";
import { FilmPropRecord, filmPropCategoryLabel } from "./film-types";

type Props = {
  prop: FilmPropRecord;
  onEdit?: (p: FilmPropRecord) => void;
  onCreate?: (p: FilmPropRecord) => void;
};

const TILE_BG = [
  "from-yellow-400 to-yellow-600",
  "from-gray-400 to-gray-600",
  "from-pink-400 to-orange-500",
  "from-blue-400 to-blue-600",
];

export default function FilmPropCard({ prop, onEdit, onCreate }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<FilmMediaZoomItem | null>(null);
  const urls = (prop.imageUrls || []).filter(Boolean);
  if (!urls.length && prop.imageUrl) urls.push(prop.imageUrl);

  const created = prop.status === "created" || urls.length > 0;
  const categoryLabel = filmPropCategoryLabel(prop.category);
  const initial = (prop.name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-w-4 aspect-h-3 bg-gray-100">
        {urls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls[0]}
            alt={prop.name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setZoom({ src: urls[0], type: "image" })}
          />
        ) : created ? (
          <div
            className={`w-full h-full bg-gradient-to-br ${
              TILE_BG[prop.sortOrder % TILE_BG.length]
            } flex items-center justify-center text-white font-bold text-3xl`}
          >
            {initial}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <HiPhotograph className="text-4xl" />
            <span className="text-xs">{t("Chưa có ảnh")}</span>
          </div>
        )}

        {created && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-10 font-semibold bg-green-500 text-white shadow-sm">
            {t("Đã tạo")}
          </span>
        )}

        <button
          type="button"
          title={t("Sửa")}
          onClick={() => onEdit?.(prop)}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white bg-opacity-95 border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer"
        >
          <HiPencil className="text-sm" />
        </button>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h4 className="text-sm font-bold text-gray-900 m-0 truncate">{prop.name}</h4>
        <p className="text-xs text-gray-400 m-0 mt-0.5">{categoryLabel}</p>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex-shrink-0">
            <HiLockClosed className={prop.locked ? "text-yellow-500" : "text-gray-300"} />
          </span>
          <span
            className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-lg inline-flex items-center justify-center gap-1 ${
              created
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-yellow-50 text-yellow-600 border border-yellow-100"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${created ? "bg-green-500" : "bg-yellow-400"}`} />
            {created ? t("Đã tạo") : t("Chưa tạo")}
          </span>
          <button
            type="button"
            onClick={() => onCreate?.(prop)}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-0 cursor-pointer"
          >
            {t("Tạo")}
          </button>
        </div>
      </div>

      <FilmMediaZoom media={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
