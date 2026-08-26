import { memo, ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import {
  RiDeleteBinLine,
  RiImageFill,
  RiLoader4Line,
  RiStopCircleLine,
  RiVideoFill,
} from "react-icons/ri";

import { VideoDialog } from "../../../shared/common/video-dialog";
import { Img } from "../../../shared/utilities/misc";
import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { GeneratedImageDownloadButtons } from "../shared/generated-image-download-buttons";
import { GeneratedVideoDownloadButtons } from "../shared/generated-video-download-buttons";
import {
  MEDIA_CONTENT_POLICY_MESSAGE,
  MEDIA_SYSTEM_BUSY_MESSAGE,
  toUserFriendlyMediaErrorMessage,
} from "../shared/media-error-message";
import {
  getGeneratedImagePreviewSrc,
  getGeneratedVideoPreviewSrc,
  mimeTypeToFileExtension,
} from "../shared/generatedMediaUtils";
import { WolfProjectItem } from "./wolf-project-item";

function isSameWolfProjectItemCardProps(
  prev: {
    item: WolfProjectItem;
    sceneImage?: GeneratedImageData;
    sceneVideo?: GeneratedVideoData;
    progress?: number;
    isActionPending?: boolean;
  },
  next: {
    item: WolfProjectItem;
    sceneImage?: GeneratedImageData;
    sceneVideo?: GeneratedVideoData;
    progress?: number;
    isActionPending?: boolean;
  }
): boolean {
  return (
    prev.item === next.item &&
    prev.sceneImage === next.sceneImage &&
    prev.sceneVideo === next.sceneVideo &&
    prev.progress === next.progress &&
    prev.isActionPending === next.isActionPending
  );
}

function getAspectPadding(aspectRatio: "16:9" | "9:16", mediaType: WolfProjectItem["mediaType"]) {
  if (aspectRatio === "16:9") return "56.25%";
  return mediaType === "video" ? "174.78%" : "177.78%";
}

function displayWolfErrorMessage(message: string, t: (key: string) => string): string {
  const normalized = toUserFriendlyMediaErrorMessage(message);
  if (normalized === MEDIA_SYSTEM_BUSY_MESSAGE) return t(MEDIA_SYSTEM_BUSY_MESSAGE);
  if (normalized === MEDIA_CONTENT_POLICY_MESSAGE) return t(MEDIA_CONTENT_POLICY_MESSAGE);
  return normalized ?? t(MEDIA_SYSTEM_BUSY_MESSAGE);
}

export const WolfProjectItemCard = memo(function WolfProjectItemCard({
  item,
  sceneImage,
  sceneVideo,
  progress,
  isActionPending,
  onStop,
  onRetry,
  onDelete,
}: {
  item: WolfProjectItem;
  sceneImage?: GeneratedImageData;
  sceneVideo?: GeneratedVideoData;
  progress?: number;
  isActionPending?: boolean;
  onStop?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [showVideoModal, setShowVideoModal] = useState(false);

  const aspectRatio = item.aspectRatio ?? "16:9";
  const paddingTop = getAspectPadding(aspectRatio, item.mediaType);
  const isGenerating = item.status === "generating";
  const isFailed = item.status === "failed";
  const isCancelled = item.status === "cancelled";
  const isVideo = item.mediaType === "video";
  const canStop = isGenerating && !!onStop;
  const canRetry = !isGenerating && !!onRetry;

  const imageSrc = sceneImage ? getGeneratedImagePreviewSrc(sceneImage) : "";
  const videoSrc = sceneVideo ? getGeneratedVideoPreviewSrc(sceneVideo) : null;
  const hasImagePreview = !isVideo && !!imageSrc;
  const hasVideoPreview = isVideo && !!videoSrc;

  const renderGenerating = () => (
    <div
      className={`relative w-full overflow-hidden rounded-md border-2 border-dashed bg-slate-50 ${
        isVideo ? "bg-purple-50 border-purple-300" : "bg-pink-50 border-pink-300"
      }`}
      style={{ paddingTop }}
    >
      <div className="flex absolute inset-0 flex-col gap-1 justify-center items-center">
        <RiLoader4Line
          className={`text-xl animate-spin ${isVideo ? "text-purple-500" : "text-pink-500"}`}
        />
        {typeof progress === "number" && progress > 0 ? (
          <span
            className={`text-[10px] font-bold ${isVideo ? "text-purple-600" : "text-pink-600"}`}
          >
            {progress}%
          </span>
        ) : (
          <span className={`text-xs font-medium ${isVideo ? "text-purple-600" : "text-pink-600"}`}>
            {t("Đang tạo...")}
          </span>
        )}
      </div>
    </div>
  );

  const renderTerminalError = (title: string, tone: "red" | "amber") => (
    <div
      className={`relative w-full overflow-hidden rounded-md border-2 ${
        tone === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
      style={{ paddingTop }}
    >
      <div className="flex absolute inset-0 flex-col gap-1 justify-center items-center px-3">
        <span
          className={`text-xs font-medium ${tone === "red" ? "text-red-600" : "text-amber-700"}`}
        >
          {title}
        </span>
        {item.errorMessage && (
          <span
            className={`text-[10px] text-center line-clamp-2 ${
              tone === "red" ? "text-red-500" : "text-amber-600"
            }`}
          >
            {displayWolfErrorMessage(item.errorMessage, t)}
          </span>
        )}
      </div>
    </div>
  );

  const renderEmptyPlaceholder = () => (
    <div
      className={`relative w-full overflow-hidden rounded-md border-2 border-dashed bg-slate-50 ${
        isVideo ? "border-purple-200" : "border-slate-300"
      }`}
      style={{ paddingTop }}
    >
      <div className="flex absolute inset-0 flex-col gap-1 justify-center items-center">
        {isVideo ? (
          <RiVideoFill className="text-2xl text-purple-300" />
        ) : (
          <RiImageFill className="text-2xl text-slate-300" />
        )}
      </div>
    </div>
  );

  const renderImagePreview = () => {
    const imageFileName = `wolf-${item.id.slice(0, 8)}.${mimeTypeToFileExtension(sceneImage?.mimeType, "jpg")}`;

    return (
      <div className="relative w-full">
        <Img
          showImageOnClick
          lazyload={false}
          percent={parseFloat(paddingTop)}
          src={imageSrc}
          alt={item.prompt}
          className="overflow-hidden w-full rounded-md border border-green-300 border-dashed shadow-sm"
        />
        {isGenerating && (
          <div className="flex absolute inset-0 justify-center items-center rounded-md bg-white/50">
            <RiLoader4Line className="text-xl text-pink-500 animate-spin" />
          </div>
        )}
        {sceneImage && !isGenerating && (
          <GeneratedImageDownloadButtons
            variant="overlay"
            image={sceneImage}
            fileName={imageFileName}
            disabled={isActionPending}
          />
        )}
      </div>
    );
  };

  const renderVideoPreview = () => {
    const videoFileName = `wolf-${item.id.slice(0, 8)}.${mimeTypeToFileExtension(
      sceneVideo?.mimeType,
      "mp4"
    )}`;

    return (
      <>
        <div
          className="overflow-hidden relative w-full rounded-md border-2 border-purple-300 shadow-sm"
          style={{ paddingTop }}
        >
        <video
          src={videoSrc!}
          className="object-cover absolute inset-0 w-full h-full cursor-pointer"
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
          onMouseLeave={(e) => {
            const v = e.target as HTMLVideoElement;
            v.pause();
            v.currentTime = 0;
          }}
          onClick={() => setShowVideoModal(true)}
        />
        <div className="flex absolute inset-0 justify-center items-center bg-black bg-opacity-20 rounded-sm pointer-events-none opacity-100 transition-opacity group-hover:opacity-0">
          <div className="flex justify-center items-center w-10 h-10 bg-white bg-opacity-80 rounded-full">
            <BiPlayCircle className="w-12 h-12 text-white" />
          </div>
        </div>
        {isGenerating && (
          <div className="flex absolute inset-0 justify-center items-center bg-white/40">
            <RiLoader4Line className="text-xl text-purple-500 animate-spin" />
          </div>
        )}
        {sceneVideo && !isGenerating && (
          <GeneratedVideoDownloadButtons
            variant="overlay"
            video={sceneVideo}
            fileName={videoFileName}
            disabled={isActionPending}
          />
        )}
        </div>
        <VideoDialog
          videoUrl={videoSrc!}
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          aspectRatio={aspectRatio}
        />
      </>
    );
  };

  const renderVideoPlaceholder = () => (
    <div
      className="overflow-hidden relative w-full bg-purple-50 rounded-md border-2 border-purple-300"
      style={{ paddingTop }}
    >
      <RiVideoFill className="absolute inset-0 m-auto text-xl text-purple-400" />
    </div>
  );

  let mediaContent: ReactNode;
  if (isCancelled) {
    mediaContent = renderTerminalError(t("Đã dừng"), "amber");
  } else if (isFailed) {
    mediaContent = renderTerminalError(t("Tạo thất bại"), "red");
  } else if (hasImagePreview) {
    mediaContent = renderImagePreview();
  } else if (hasVideoPreview) {
    mediaContent = renderVideoPreview();
  } else if (isVideo && sceneVideo && !videoSrc) {
    mediaContent = renderVideoPlaceholder();
  } else if (isGenerating) {
    mediaContent = renderGenerating();
  } else {
    mediaContent = renderEmptyPlaceholder();
  }

  return (
    <div className="overflow-hidden bg-white rounded-2xl border shadow-sm group border-slate-200">
      <div className="relative p-2 w-full bg-slate-50">
        {mediaContent}

        <div
          className={`flex absolute top-3 right-3 z-20 gap-1 transition-opacity ${
            isGenerating ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {canStop && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStop?.();
              }}
              disabled={isActionPending}
              title={t("Dừng")}
              className="flex justify-center items-center w-7 h-7 text-amber-800 bg-white rounded-full border border-gray-50 shadow-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {isActionPending ? (
                <RiLoader4Line className="text-sm animate-spin" />
              ) : (
                <RiStopCircleLine className="text-sm" />
              )}
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.();
              }}
              disabled={isActionPending}
              title={t("Tạo lại")}
              className="flex justify-center items-center w-7 h-7 text-orange-600 bg-white rounded-full   border shadow-sm transition-colors border-slate-200 hover:bg-orange-100 disabled:opacity-50"
            >
              {isActionPending ? (
                <RiLoader4Line className="text-sm animate-spin" />
              ) : (
                <AiOutlineReload className="text-sm" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            disabled={isActionPending}
            title={t("Xóa")}
            className="flex justify-center items-center w-7 h-7 text-red-600 bg-white rounded-full border shadow-sm transition-colors border-slate-200 hover:bg-red-50 disabled:opacity-50"
          >
            {isActionPending && !canStop ? (
              <RiLoader4Line className="text-sm animate-spin" />
            ) : (
              <RiDeleteBinLine className="text-sm" />
            )}
          </button>
        </div>
      </div>

      {item.prompt && (
        <div className="px-3 py-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 line-clamp-2">{item.prompt}</p>
        </div>
      )}
    </div>
  );
},
isSameWolfProjectItemCardProps);
