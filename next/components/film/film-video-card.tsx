import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiPhotograph,
  HiPlay,
  HiTemplate,
  HiVideoCamera,
} from "react-icons/hi";
import FilmMediaZoom, { FilmMediaZoomItem } from "./film-media-zoom";
import { FilmSceneRecord } from "./film-types";
import { sceneFrameReady } from "./film-shot-image-card";

type Props = {
  scene: FilmSceneRecord;
  onCreateVideo?: (scene: FilmSceneRecord) => void;
};

export function sceneVideoReady(scene: FilmSceneRecord): boolean {
  return scene.videoStatus === "ready" || !!scene.videoUrl;
}

export function sceneVideoCreating(scene: FilmSceneRecord): boolean {
  return scene.videoStatus === "creating";
}

export default function FilmVideoCard({ scene, onCreateVideo }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<FilmMediaZoomItem | null>(null);
  const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
  const description =
    scene.summary || scene.action || scene.visualDescription || scene.dialogue || t("Chưa có mô tả");
  const shotLabel = scene.shotSize || t("Cảnh quay");
  const duration = scene.durationSec ?? 0;
  const hasFrame = sceneFrameReady(scene);
  const ready = sceneVideoReady(scene);
  const creating = sceneVideoCreating(scene);
  const previewUrl = scene.frameImageUrl || undefined;
  const videoUrl = scene.videoUrl || undefined;
  const canZoom = !!(videoUrl || previewUrl);

  const openZoom = () => {
    if (creating || !canZoom) return;
    if (videoUrl) {
      setZoom({ src: videoUrl, type: "video" });
    } else if (previewUrl) {
      setZoom({ src: previewUrl, type: "image" });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col max-h-80">
      <div
        className={`relative w-full h-36 bg-gray-100 flex-shrink-0 overflow-hidden ${
          canZoom && !creating ? "cursor-zoom-in" : ""
        }`}
        onClick={openZoom}
        role={canZoom ? "button" : undefined}
        tabIndex={canZoom ? 0 : undefined}
        onKeyDown={(e) => {
          if (canZoom && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openZoom();
          }
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={indexLabel} className="w-full h-full object-cover" />
        ) : ready ? (
          <div className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
            <HiPlay className="text-2xl text-white text-opacity-90" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <HiVideoCamera className="text-2xl" />
          </div>
        )}

        {ready && videoUrl && !creating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-8 h-8 rounded-full bg-black bg-opacity-50 text-white flex items-center justify-center">
              <HiPlay className="text-base ml-0.5" />
            </span>
          </div>
        )}

        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-10 font-bold bg-gray-800 bg-opacity-80 text-white pointer-events-none">
          {indexLabel}
        </span>

        {creating && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center gap-1">
            <span className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <span className="text-10 font-medium text-white">{t("Đang tạo video")}</span>
          </div>
        )}

        {ready && !creating && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-10 font-semibold bg-green-500 text-white shadow-sm pointer-events-none">
            {t("Đã tạo")}
          </span>
        )}
      </div>

      <div className="p-2.5 flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900 m-0 line-clamp-2 leading-snug">{description}</p>
          <p className="text-10 text-gray-400 m-0 mt-0.5">
            {shotLabel} - {duration}s
          </p>
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          <span
            title={t("Storyboard")}
            className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center"
          >
            <HiTemplate className="text-xs" />
          </span>
          <span
            title={t("Khung hình")}
            className={`w-6 h-6 rounded flex items-center justify-center ${
              hasFrame ? "bg-blue-50 text-blue-500" : "bg-gray-50 text-gray-300"
            }`}
          >
            <HiPhotograph className="text-xs" />
          </span>
          <span
            title={t("Video")}
            className={`w-6 h-6 rounded flex items-center justify-center ${
              ready ? "bg-green-50 text-green-500" : "bg-gray-50 text-gray-300"
            }`}
          >
            <HiVideoCamera className="text-xs" />
          </span>
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={() => onCreateVideo?.(scene)}
          className="mt-auto w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-60 cursor-pointer transition-colors"
        >
          {creating ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              {t("Đang tạo...")}
            </>
          ) : ready ? (
            <>
              <HiVideoCamera className="text-sm" />
              {t("Tạo lại")}
            </>
          ) : (
            <>
              <HiVideoCamera className="text-sm" />
              {t("Tạo Video")}
            </>
          )}
        </button>
      </div>

      <FilmMediaZoom media={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
