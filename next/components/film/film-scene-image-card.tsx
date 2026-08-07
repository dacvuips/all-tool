import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiLocationMarker, HiPencil, HiRefresh } from "react-icons/hi";
import FilmMediaZoom, { FilmMediaZoomItem } from "./film-media-zoom";
import { FilmSceneImageRecord } from "./film-types";

type Props = {
  item: FilmSceneImageRecord;
  onEdit?: (item: FilmSceneImageRecord) => void;
  onCreate?: (item: FilmSceneImageRecord) => void;
};

const TILE_BG = [
  "from-green-500 to-blue-700",
  "from-blue-400 to-blue-600",
  "from-purple-400 to-purple-700",
  "from-yellow-400 to-orange-600",
];

export default function FilmSceneImageCard({ item, onEdit, onCreate }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<FilmMediaZoomItem | null>(null);
  const urls = (item.imageUrls || []).filter(Boolean);
  if (!urls.length && item.imageUrl) urls.push(item.imageUrl);

  const created = item.status === "created" || urls.length > 0;
  const creating = item.status === "creating";
  const context = (item.context || "").trim() || t("Ngày");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-w-4 aspect-h-3 bg-gray-100">
        {urls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls[0]}
            alt={item.name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setZoom({ src: urls[0], type: "image" })}
          />
        ) : created ? (
          <div
            className={`w-full h-full bg-gradient-to-br ${
              TILE_BG[item.sortOrder % TILE_BG.length]
            } flex items-center justify-center text-white`}
          >
            <HiLocationMarker className="text-4xl opacity-90" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <HiLocationMarker className="text-4xl" />
          </div>
        )}

        {creating && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-10 font-semibold bg-gray-800 text-white shadow-sm">
            {t("Đang tạo")}
          </span>
        )}
        {created && !creating && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-10 font-semibold bg-green-500 text-white shadow-sm">
            {t("Đã tạo")}
          </span>
        )}

        <button
          type="button"
          title={t("Sửa")}
          onClick={() => onEdit?.(item)}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white bg-opacity-95 border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer"
        >
          <HiPencil className="text-sm" />
        </button>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h4 className="text-sm font-bold text-gray-900 m-0 truncate">{item.name}</h4>
        <p className="text-xs text-gray-400 m-0 mt-0.5 truncate">{context}</p>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 ${
              creating
                ? "bg-gray-100 text-gray-600 border border-gray-200"
                : created
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-yellow-50 text-yellow-600 border border-yellow-100"
            }`}
          >
            {creating ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                {t("Đang tạo")}
              </>
            ) : (
              <>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    created ? "bg-green-500" : "bg-yellow-400"
                  }`}
                />
                {created ? t("Đã tạo") : t("Chưa tạo")}
              </>
            )}
          </span>
          <button
            type="button"
            disabled={creating}
            onClick={() => onCreate?.(item)}
            className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white border-0 cursor-pointer inline-flex items-center justify-center gap-1"
          >
            {creating ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-opacity-70 border-t-transparent animate-spin" />
                {t("Đang tạo")}
              </>
            ) : created ? (
              <>
                <HiRefresh className="text-sm" />
                {t("Tạo lại")}
              </>
            ) : (
              t("Tạo")
            )}
          </button>
        </div>
      </div>

      <FilmMediaZoom media={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
