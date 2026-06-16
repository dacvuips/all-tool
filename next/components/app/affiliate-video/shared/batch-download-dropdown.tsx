/**
 * batch-download-dropdown.tsx
 * Nút "Tải Ảnh/Video" kèm Popover: tuần tự hoặc ZIP cho ảnh và video.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowDownSLine, RiDownloadLine, RiLoader4Line } from "react-icons/ri";
import { Popover } from "../../../shared/utilities/popover/popover";

interface BatchMediaDownloadDropdownProps {
  id?: string;
  downloading: boolean;
  downloadingVideo: boolean;
  downloadLabel: string;
  downloadVideoLabel: string;
  availableImageCount: number;
  availableVideoCount: number;
  onDownloadAllImages: () => void;
  onDownloadAllVideos: () => void;
  onDownloadAllImagesZip: () => void;
  onDownloadAllVideosZip: () => void;
}

export function BatchMediaDownloadDropdown({
  id = "batch-download-media",
  downloading,
  downloadingVideo,
  downloadLabel,
  downloadVideoLabel,
  availableImageCount,
  availableVideoCount,
  onDownloadAllImages,
  onDownloadAllVideos,
  onDownloadAllImagesZip,
  onDownloadAllVideosZip,
}: BatchMediaDownloadDropdownProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const isBusy = downloading || downloadingVideo;
  const nothingToDownload = availableImageCount === 0 && availableVideoCount === 0;

  const menuItems = [
    {
      label: t("Tải tất cả ảnh"),
      disabled: availableImageCount === 0 || isBusy,
      action: onDownloadAllImages,
    },
    {
      label: t("Tải tất cả video"),
      disabled: availableVideoCount === 0 || isBusy,
      action: onDownloadAllVideos,
    },
    {
      label: t("Tải tất cả ảnh (Zip)"),
      disabled: availableImageCount === 0 || isBusy,
      action: onDownloadAllImagesZip,
    },
    {
      label: t("Tải tất cả video (Zip)"),
      disabled: availableVideoCount === 0 || isBusy,
      action: onDownloadAllVideosZip,
    },
  ];

  const handleSelect = (action: () => void) => {
    setOpen(false);
    action();
  };

  const buttonColor = isBusy ? "bg-blue-400 cursor-wait" : "bg-blue-500 hover:bg-blue-600";

  const buttonLabel = isBusy
    ? `${t("Đang tải")} ${downloading ? downloadLabel : downloadVideoLabel}...`
    : t("Tải Ảnh/Video");

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={isBusy || nothingToDownload}
        onClick={() => {
          if (isBusy || nothingToDownload) return;
          setOpen((prev) => !prev);
        }}
        className={`flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {isBusy ? <RiLoader4Line className="animate-spin" /> : <RiDownloadLine />}
        {buttonLabel}
        {!isBusy && <RiArrowDownSLine className="text-sm opacity-80" />}
      </button>

      <Popover
        reference={buttonRef}
        trigger="click"
        placement="bottom-start"
        arrow={false}
        maxWidth={240}
        visible={open}
        hideOnClickOutside
        zIndex={10050}
        onHidden={() => setOpen(false)}
        onClickOutside={() => setOpen(false)}
      >
        <div className="py-1 min-w-[220px]">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={() => {
                if (item.disabled) return;
                handleSelect(item.action);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/** @deprecated Dùng BatchMediaDownloadDropdown */
export const BatchDownloadDropdown = BatchMediaDownloadDropdown;
