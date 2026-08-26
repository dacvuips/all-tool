import { useTranslation } from "react-i18next";
import { RiDeleteBinLine, RiLoader4Line, RiStopCircleLine } from "react-icons/ri";

import { BatchMediaDownloadDropdown } from "../shared/batch-download-dropdown";

export function WolfProjectBatchToolbar({
  downloading,
  downloadingVideo,
  deletingAll,
  stoppingAll,
  generatingCount,
  downloadLabel,
  downloadVideoLabel,
  availableImageCount,
  availableVideoCount,
  disabled,
  onDownloadAllImages,
  onDownloadAllImages2k,
  onDownloadAllImages4k,
  onDownloadAllImagesZip,
  onDownloadAllImages2kZip,
  onDownloadAllImages4kZip,
  onDownloadAllVideos,
  onDownloadAllVideosZip,
  onDownloadAllVideos1080p,
  onDownloadAllVideos1080pZip,
  onDeleteAllProjectMedia,
  onStopAllGenerating,
}: {
  downloading: boolean;
  downloadingVideo: boolean;
  deletingAll: boolean;
  stoppingAll: boolean;
  generatingCount: number;
  downloadLabel: string;
  downloadVideoLabel: string;
  availableImageCount: number;
  availableVideoCount: number;
  disabled?: boolean;
  onDownloadAllImages: () => void;
  onDownloadAllImages2k: () => void;
  onDownloadAllImages4k: () => void;
  onDownloadAllImagesZip: () => void;
  onDownloadAllImages2kZip: () => void;
  onDownloadAllImages4kZip: () => void;
  onDownloadAllVideos: () => void;
  onDownloadAllVideosZip: () => void;
  onDownloadAllVideos1080p: () => void;
  onDownloadAllVideos1080pZip: () => void;
  onDeleteAllProjectMedia: () => void;
  onStopAllGenerating: () => void;
}) {
  const { t } = useTranslation();
  const isBusy = disabled || downloading || downloadingVideo || deletingAll || stoppingAll;
  const hasMedia = availableImageCount > 0 || availableVideoCount > 0;
  const canStop = generatingCount > 0;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {canStop && (
        <button
          type="button"
          disabled={stoppingAll}
          onClick={onStopAllGenerating}
          className="flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-danger hover:bg-danger-dark"
        >
          {stoppingAll ? <RiLoader4Line className="animate-spin" /> : <RiStopCircleLine />}
          {stoppingAll
            ? t("Đang dừng...")
            : t("Dừng tất cả ({{count}})", { count: generatingCount })}
        </button>
      )}
      <BatchMediaDownloadDropdown
        id="wolf-batch-download-media"
        downloading={downloading}
        downloadingVideo={downloadingVideo}
        downloadLabel={downloadLabel}
        downloadVideoLabel={downloadVideoLabel}
        availableImageCount={availableImageCount}
        availableVideoCount={availableVideoCount}
        onDownloadAllImages={onDownloadAllImages}
        onDownloadAllImages2k={onDownloadAllImages2k}
        onDownloadAllImages4k={onDownloadAllImages4k}
        onDownloadAllVideos={onDownloadAllVideos}
        onDownloadAllVideos1080p={onDownloadAllVideos1080p}
        onDownloadAllImagesZip={onDownloadAllImagesZip}
        onDownloadAllImages2kZip={onDownloadAllImages2kZip}
        onDownloadAllImages4kZip={onDownloadAllImages4kZip}
        onDownloadAllVideosZip={onDownloadAllVideosZip}
        onDownloadAllVideos1080pZip={onDownloadAllVideos1080pZip}
      />
      <button
        type="button"
        disabled={isBusy || !hasMedia}
        onClick={onDeleteAllProjectMedia}
        className="flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-red-500 hover:bg-red-600"
      >
        {deletingAll ? <RiLoader4Line className="animate-spin" /> : <RiDeleteBinLine />}
        {deletingAll ? t("Đang xóa...") : t("Xóa tất cả media")}
      </button>
    </div>
  );
}
