/**
 * Nút bật/tắt tự động tải sau gen + Popover chọn độ phân giải ảnh/video.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdFileDownload, MdFileDownloadOff } from "react-icons/md";
import { RiDeleteBinLine, RiImageFill, RiVideoFill } from "react-icons/ri";
import { Button } from "../../../shared/utilities/form";
import { Popover } from "../../../shared/utilities/popover/popover";
import type { AutoDownloadImageResolution, VideoDownloadResolution } from "./autoDownloadUtils";

const IMAGE_OPTIONS: AutoDownloadImageResolution[] = ["1K", "2K", "4K"];
const VIDEO_OPTIONS: VideoDownloadResolution[] = ["720p", "1080p"];

function ResolutionRadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: T[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <label
            key={opt}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
              selected
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={selected}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

export interface AutoDownloadSettingsButtonProps {
  id?: string;
  disabled?: boolean;
  enabled: boolean;
  onToggle: () => void;
  imageResolution: AutoDownloadImageResolution;
  videoResolution: VideoDownloadResolution;
  onImageResolutionChange: (resolution: AutoDownloadImageResolution) => void;
  onVideoResolutionChange: (resolution: VideoDownloadResolution) => void;
  buttonClassName?: string;
}

export function AutoDownloadSettingsButton({
  id,
  disabled,
  enabled,
  onToggle,
  imageResolution,
  videoResolution,
  onImageResolutionChange,
  onVideoResolutionChange,
  buttonClassName,
}: AutoDownloadSettingsButtonProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const tooltip = enabled
    ? t("Tự động tải sau gen — ảnh {{img}}, video {{vid}}", {
        img: imageResolution,
        vid: videoResolution,
      })
    : t("Không tự động tải sau khi tạo ảnh/video xong");

  const baseBtnClass =
    buttonClassName ||
    `w-6 h-6 px-2 rounded-md shadow-sm ${
      enabled
        ? "text-green-500 bg-green-50 hover:bg-green-100"
        : "text-gray-400 bg-white hover:text-green-500 hover:bg-green-50"
    }`;

  return (
    <>
      <Button
        id={id}
        innerRef={buttonRef}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={baseBtnClass}
        iconClassName="text-sm"
        icon={enabled ? <MdFileDownload /> : <MdFileDownloadOff />}
        tooltip={tooltip}
        placement="bottom"
      />

      <Popover
        reference={buttonRef}
        trigger="click"
        placement="bottom-end"
        arrow
        maxWidth={220}
        visible={open}
        hideOnClickOutside
        zIndex={10050}
        onHidden={() => setOpen(false)}
        onClickOutside={() => setOpen(false)}
      >
        <div className="p-1 space-y-3 min-w-3xs" onClick={(e) => e.stopPropagation()}>
          <p
            className={`text-xs font-semibold text-center ${
              enabled ? "text-green-600" : "text-gray-400"
            }`}
          >
            {enabled ? t("Đang bật tự động tải") : t("Đang tắt tự động tải")}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <RiImageFill className="text-pink-500" />
              {t("Ảnh")}
            </div>
            <ResolutionRadioGroup
              name={`${id || "auto-dl"}-image`}
              options={IMAGE_OPTIONS}
              value={imageResolution}
              onChange={onImageResolutionChange}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <RiVideoFill className="text-purple-500" />
              {t("Video")}
            </div>
            <ResolutionRadioGroup
              name={`${id || "auto-dl"}-video`}
              options={VIDEO_OPTIONS}
              value={videoResolution}
              onChange={onVideoResolutionChange}
            />
          </div>

          <div className="pt-2 border-t border-gray-100 flex gap-1.5">
            <button
              type="button"
              disabled={disabled || enabled}
              title={t("Bật tự động tải sau khi gen")}
              onClick={() => {
                if (enabled) return;
                onToggle();
              }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-green-700 bg-green-50 border border-green-100 transition-colors hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
            >
              <MdFileDownload className="text-sm" />
              {t("Bật")}
            </button>
            <button
              type="button"
              disabled={disabled || !enabled}
              title={t("Hủy tự động tải sau khi gen")}
              onClick={() => {
                if (!enabled) return;
                onToggle();
              }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-red-600 bg-red-50 border border-red-100 transition-colors hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50"
            >
              <RiDeleteBinLine className="text-sm" />
              {t("Hủy")}
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}
