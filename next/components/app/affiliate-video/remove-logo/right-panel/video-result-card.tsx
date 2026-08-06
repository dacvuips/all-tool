/**
 * Card kết quả VIDEO — chỉ Trước / Sau (không có So sánh kéo) + Save
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiDownloadLine,
  RiFullscreenLine,
  RiPauseFill,
  RiPlayFill,
  RiVolumeUpLine,
} from "react-icons/ri";
import {
  downloadBase64,
  formatFileSize,
  makeCleanedFileName,
  RemoveLogoHistoryItem,
} from "../constants";
import { useMediaSrc } from "../hook/useMediaSrc";

type Props = {
  item: RemoveLogoHistoryItem;
  onRemove: (id: string) => void;
};

export function VideoResultCard({ item, onRemove }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"before" | "after">("after");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const beforeSrc = useMediaSrc(item.originalBase64, item.mimeType || "video/mp4");
  const afterSrc = useMediaSrc(
    item.cleanedBase64,
    item.cleanedMimeType || item.mimeType || "video/mp4",
    item.cleanedUrl
  );

  const src = mode === "before" ? beforeSrc : afterSrc;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const t0 = v.currentTime;
    v.load();
    v.currentTime = t0;
    if (playing) void v.play().catch(() => undefined);
  }, [src]);

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSave = () => {
    downloadBase64(
      item.cleanedBase64,
      item.cleanedMimeType || item.mimeType,
      makeCleanedFileName(item.name, "video")
    );
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="overflow-hidden relative bg-gray-900" style={{ height: 220 }}>
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="object-contain w-full h-full"
            style={{ maxHeight: 220 }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline
          />
        ) : (
          <div className="flex justify-center items-center w-full h-full text-sm text-gray-400">
            {t("Không tải được video xem trước")}
          </div>
        )}

        {/* Video: chỉ Trước / Sau — không So sánh */}
        <div className="absolute top-3 left-1/3 z-10 flex p-0.5 bg-white rounded-full shadow -translate-x-1/2">
          <button
            type="button"
            onClick={() => setMode("before")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors border-0 cursor-pointer ${
              mode === "before" ? "bg-primary text-white" : "text-gray-600 bg-transparent"
            }`}
          >
            {t("Trước")}
          </button>
          <button
            type="button"
            onClick={() => setMode("after")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors border-0 cursor-pointer ${
              mode === "after" ? "bg-primary text-white" : "text-gray-600 bg-transparent"
            }`}
          >
            {t("Sau")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="flex absolute top-3 right-3 z-10 justify-center items-center w-8 h-8 text-white bg-gray-800 rounded-full border-0 cursor-pointer hover:bg-danger"
          title={t("Xóa")}
        >
          <RiCloseLine className="text-lg text-white" />
        </button>
      </div>

      <div className="flex gap-2 items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
        <button
          type="button"
          className="flex justify-center items-center w-8 h-8 bg-transparent border-0 cursor-pointer text-primary hover:text-primary-dark"
          onClick={togglePlay}
          title={playing ? t("Tạm dừng") : t("Phát")}
        >
          {playing ? (
            <RiPauseFill className="text-xl text-primary" />
          ) : (
            <RiPlayFill className="text-xl text-primary" />
          )}
        </button>
        <RiVolumeUpLine className="text-lg text-primary" />
        <span className="text-xs tabular-nums text-gray-600">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={(e) => {
            const v = videoRef.current;
            const next = Number(e.target.value);
            setCurrentTime(next);
            if (v) v.currentTime = next;
          }}
          className="flex-1 h-1"
          style={{ "--accent-color": "#F2890D" } as React.CSSProperties}
        />
        <button
          type="button"
          className="flex justify-center items-center w-8 h-8 bg-transparent border-0 cursor-pointer text-primary hover:text-primary-dark"
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            if (el.requestFullscreen) void el.requestFullscreen();
          }}
          title={t("Toàn màn hình")}
        >
          <RiFullscreenLine className="text-lg text-primary" />
        </button>
      </div>

      <div className="flex gap-3 justify-between items-center px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate" title={item.name}>
            {item.name}
          </p>
          <p className="text-xs text-gray-400">
            {formatFileSize(item.sizeBytes)} · {item.credits} {t("credits")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="flex flex-shrink-0 gap-1.5 items-center px-4 py-2 text-sm font-semibold text-white rounded-xl border-0 cursor-pointer bg-primary hover:bg-primary-dark"
        >
          <RiDownloadLine className="text-base text-white" />
          {t("Tải về")}
        </button>
      </div>
    </div>
  );
}
