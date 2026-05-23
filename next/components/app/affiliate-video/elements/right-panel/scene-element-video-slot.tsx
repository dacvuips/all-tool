/**
 * Ô video tham chiếu (kéo thả / hiển thị / xóa) – dùng trong scene batch row.
 * Hiển thị 1 video duy nhất, hover để play, có nút xóa.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAddLine,
  RiCloseLine,
  RiLoader4Line,
  RiPlayCircleLine,
  RiVideoLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { ElementFormVideo } from "../../constants";

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const ACCEPTED_VIDEO_EXTENSIONS = ".mp4,.webm,.mov,.avi";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64VideoToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

export interface SceneElementVideoSlotProps {
  value?: ElementFormVideo;
  readOnly?: boolean;
  onChange: (value: ElementFormVideo | undefined) => void;
  maxSizeMB?: number;
  /** CSS class for width/height, e.g. "w-20 h-14" */
  videoClass?: string;
}

export function SceneElementVideoSlot({
  value,
  readOnly = false,
  onChange,
  maxSizeMB = 100,
  videoClass = "w-20 h-14",
}: SceneElementVideoSlotProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);

  const previewSrc = useMemo(() => {
    if (!value) return null;
    if (value.fifeUrl) return value.fifeUrl;
    if (value.videoBytes) return base64VideoToBlobUrl(value.videoBytes, value.mimeType || "video/mp4");
    return null;
  }, [value]);

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  // Hover to play / pause
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !previewSrc) return;
    if (hovered) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
      vid.currentTime = 0;
    }
  }, [hovered, previewSrc]);

  const processFile = useCallback(
    async (file: File) => {
      if (readOnly) return;

      const isVideo =
        ACCEPTED_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov|avi)$/i.test(file.name);
      if (!isVideo) {
        toast.error(t("Chỉ hỗ trợ file video (MP4, WebM, MOV, AVI)"));
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(
          `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSizeMB}MB, ${t("file")}: ${sizeMB.toFixed(1)}MB`
        );
        return;
      }

      try {
        setUploading(true);
        const videoBytes = await fileToBase64(file);
        onChange({
          fifeUrl: "",
          videoBytes,
          mimeType: file.type || "video/mp4",
          name: file.name,
        });
      } catch (err) {
        console.error("[SceneElementVideoSlot] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý video. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, onChange, readOnly, t, toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const openFilePicker = () => {
    if (!readOnly && !uploading) fileInputRef.current?.click();
  };

  const hasVideo = !!(value && previewSrc);
  const displayName = value?.name
    ? value.name.replace(/\.[^./\\]+$/, "")
    : "";

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={hasVideo ? undefined : openFilePicker}
        className={`${videoClass} relative overflow-hidden rounded-lg border-2 transition-all ${
          readOnly && !hasVideo
            ? "opacity-60 cursor-not-allowed"
            : hasVideo
            ? "cursor-default"
            : "cursor-pointer"
        } ${
          dragOver
            ? "border-violet-400 bg-violet-50 ring-2 ring-violet-300"
            : hasVideo
            ? "border-violet-300 bg-black"
            : "border-dashed border-gray-300 bg-gray-100/80 hover:border-violet-300 hover:bg-violet-50/30"
        }`}
      >
        {uploading ? (
          <div className="flex justify-center items-center w-full h-full">
            <RiLoader4Line className="text-xl text-violet-400 animate-spin" />
          </div>
        ) : hasVideo ? (
          <>
            {/* Video preview */}
            <video
              ref={videoRef}
              src={previewSrc}
              className="object-cover w-full h-full"
              muted
              loop
              playsInline
              preload="metadata"
            />

            {/* Play icon overlay when not hovered */}
            {!hovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <RiPlayCircleLine className="text-2xl text-white/80 drop-shadow" />
              </div>
            )}

            {/* Delete button */}
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                className="flex absolute top-0 right-0 z-20 justify-center items-center w-5 h-5 text-white rounded-bl-md transition-colors bg-black/50 hover:bg-red-600"
                aria-label={t("Xóa video")}
              >
                <RiCloseLine className="text-sm" />
              </button>
            )}

            {/* Change video button (click on video area) */}
            {!readOnly && (
              <button
                type="button"
                onClick={openFilePicker}
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 py-0.5 bg-black/50 text-white text-[9px] font-medium hover:bg-violet-700/80 transition-colors z-10"
                title={t("Đổi video")}
              >
                <RiVideoLine className="text-[10px]" />
                {t("Đổi")}
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col justify-center items-center w-full h-full gap-0.5">
            <RiAddLine className="text-xl font-light text-gray-300" />
            <span className="text-[8px] text-gray-300 leading-tight text-center px-1">Video</span>
          </div>
        )}
      </div>

      {/* File name label */}
      {hasVideo && displayName && (
        <div
          className="mt-0.5 text-[9px] text-gray-500 text-center truncate max-w-full leading-tight"
          title={displayName}
          style={{ maxWidth: "80px" }}
        >
          {displayName}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_EXTENSIONS}
        className="sr-only"
        disabled={readOnly}
        onChange={handleFileChange}
      />
    </div>
  );
}
