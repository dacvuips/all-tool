import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus } from "react-icons/hi";
import FilmMediaZoom, { FilmMediaZoomItem } from "./film-media-zoom";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scene: FilmSceneRecord;
  onCreateFrame?: (scene: FilmSceneRecord) => void;
};

export function sceneFrameReady(scene: FilmSceneRecord): boolean {
  return (
    scene.frameStatus === "ready" ||
    !!scene.frameImageUrl ||
    scene.mediaStatus === "ready"
  );
}

export function sceneFrameCreating(scene: FilmSceneRecord): boolean {
  return scene.frameStatus === "creating";
}

export default function FilmShotImageCard({ scene, onCreateFrame }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<FilmMediaZoomItem | null>(null);
  const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
  const shotLabel = scene.shotSize || t("Cảnh quay");
  const description =
    scene.summary || scene.action || scene.visualDescription || scene.dialogue || t("Chưa có mô tả");
  const ready = sceneFrameReady(scene);
  const creating = sceneFrameCreating(scene);
  const frameUrl = scene.frameImageUrl || "";
  const frameDot = creating
    ? "bg-blue-500"
    : ready
      ? "bg-green-500"
      : "bg-gray-300";

  const handleThumbClick = () => {
    if (creating) return;
    if (ready && frameUrl) {
      setZoom({ src: frameUrl, type: "image" });
      return;
    }
    onCreateFrame?.(scene);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex gap-3 items-center max-h-40 overflow-hidden">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col justify-center gap-2 overflow-hidden">
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{indexLabel}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-blue-50 text-blue-600 border border-blue-100">
              {shotLabel}
            </span>
          </div>
          <p className="text-sm text-gray-600 m-0 mt-1.5 leading-relaxed line-clamp-2 overflow-hidden">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap flex-shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${frameDot} ${
              creating ? "animate-pulse" : ""
            }`}
          />
          <span className="font-medium">{t("Khung hình")}</span>
          {ready && !creating && (
            <span className="text-green-600 font-medium">· {t("Đã có")}</span>
          )}
          {creating && (
            <span className="text-blue-600 font-medium">· {t("Đang tạo")}</span>
          )}
          {ready && !creating && (
            <button
              type="button"
              onClick={() => onCreateFrame?.(scene)}
              className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer px-0"
            >
              {t("Tạo lại")}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={handleThumbClick}
        className={`w-20 h-28 sm:w-24 sm:h-32 flex-shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors overflow-hidden ${
          creating
            ? "border-gray-200 bg-gray-50 cursor-wait"
            : ready && frameUrl
              ? "border-transparent bg-gray-100 cursor-zoom-in hover:opacity-90"
              : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
        }`}
      >
        {ready && frameUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frameUrl}
            alt={indexLabel}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : ready ? (
          <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-semibold">
            {indexLabel}
          </div>
        ) : creating ? (
          <>
            <span className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <span className="text-10 font-medium text-gray-500 text-center px-1.5 leading-snug line-clamp-2">
              {t("Khung hình đang tạo")}
            </span>
          </>
        ) : (
          <span className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
            <HiPlus className="text-base" />
          </span>
        )}
      </button>

      <FilmMediaZoom media={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
