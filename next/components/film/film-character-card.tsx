import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiPhotograph, HiUser } from "react-icons/hi";
import FilmMediaZoom, { FilmMediaZoomItem } from "./film-media-zoom";
import { FilmCharacterRecord, filmCharacterRoleLabel } from "./film-types";

type Props = {
  character: FilmCharacterRecord;
  onEdit?: (c: FilmCharacterRecord) => void;
  onCreate?: (c: FilmCharacterRecord) => void;
};

const TILE_BG = [
  "from-yellow-400 to-orange-500",
  "from-blue-400 to-blue-600",
  "from-green-400 to-blue-600",
  "from-purple-400 to-purple-600",
];

export default function FilmCharacterCard({ character, onEdit, onCreate }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<FilmMediaZoomItem | null>(null);
  const urls = (character.imageUrls || []).filter(Boolean);
  if (!urls.length && character.imageUrl) urls.push(character.imageUrl);

  const created = character.status === "created" || urls.length > 0;
  const roleLabel = filmCharacterRoleLabel(character.role);
  const initial = (character.name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-w-4 aspect-h-3 bg-gray-100">
        {urls.length > 0 ? (
          <div
            className={`h-full w-full grid gap-0.5 ${
              urls.length === 1
                ? "grid-cols-1"
                : urls.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 grid-rows-2"
            }`}
          >
            {urls.slice(0, 4).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${src}_${i}`}
                src={src}
                alt={character.name}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setZoom({ src, type: "image" })}
              />
            ))}
          </div>
        ) : created ? (
          <div className="h-full w-full grid grid-cols-2 grid-rows-2 gap-0.5">
            {TILE_BG.map((bg, i) => (
              <div
                key={i}
                className={`bg-gradient-to-br ${bg} flex items-center justify-center text-white font-bold text-lg opacity-90`}
              >
                {initial}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <HiUser className="text-4xl" />
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
          onClick={() => onEdit?.(character)}
          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white bg-opacity-95 border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer"
        >
          <HiPencil className="text-sm" />
        </button>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-gray-900 m-0 truncate">{character.name}</h4>
            <span className="inline-flex mt-1 px-2 py-0.5 rounded-md text-10 font-medium bg-gray-100 text-gray-600">
              {roleLabel}
            </span>
          </div>
          <HiPhotograph className="text-gray-300 text-lg flex-shrink-0 mt-0.5" />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-lg ${
              created
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-yellow-50 text-yellow-600 border border-yellow-100"
            }`}
          >
            {created ? t("Đã tạo") : t("Chưa tạo")}
          </span>
          <button
            type="button"
            onClick={() => onCreate?.(character)}
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
