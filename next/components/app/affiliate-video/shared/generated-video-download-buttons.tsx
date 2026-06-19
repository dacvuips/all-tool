/**
 * generated-video-download-buttons.tsx
 * Nút tải video 720p (gốc) + 1080p (upsample Flow2) — inline hoặc popover.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Button } from "../../../shared/utilities/form";
import { Popover } from "../../../shared/utilities/popover/popover";
import {
  downloadVideoAtResolution,
  GeneratedVideoLike,
  hasFlow2Upsample1080pVideoMeta,
  hasGeneratedVideoData,
  VideoDownloadResolution,
} from "./generatedMediaUtils";

export interface GeneratedVideoDownloadButtonsProps {
  video: GeneratedVideoLike;
  fileName: string;
  disabled?: boolean;
  className?: string;
}

const POPOVER_RES_BTN =
  "flex justify-center items-center min-w-8 h-7 px-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function PopoverResolutionButton({
  label,
  toneClass,
  loading,
  disabled,
  title,
  onClick,
}: {
  label: string;
  toneClass: string;
  loading: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${POPOVER_RES_BTN} ${toneClass}`}
    >
      {loading ? <RiLoader4Line className="text-sm animate-spin" /> : label}
    </button>
  );
}

export function GeneratedVideoDownloadButtons({
  video,
  fileName,
  disabled = false,
  className,
}: GeneratedVideoDownloadButtonsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const downloadTriggerRef = useRef<HTMLButtonElement>(null);
  const [loadingRes, setLoadingRes] = useState<VideoDownloadResolution | null>(null);
  const isDownloading = loadingRes !== null;

  if (!hasGeneratedVideoData(video)) {
    return null;
  }

  const handleDownload = async (resolution: VideoDownloadResolution) => {
    if (loadingRes || disabled) return;
    setLoadingRes(resolution);
    try {
      await downloadVideoAtResolution(video, fileName, resolution);
      toast.success(t("Đã tải video {{res}}", { res: resolution }));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("Không thể tải video {{res}}", { res: resolution });
      toast.error(message);
    } finally {
      setLoadingRes(null);
    }
  };

  return (
    <>
      <div className={className || "flex flex-row gap-1 items-center justify-center"}>
        <Button
          innerRef={downloadTriggerRef}
          disabled={disabled || isDownloading}
          className="w-8 h-8 rounded-lg bg-success-light text-success"
          iconClassName="text-xl font-bold"
          icon={isDownloading ? <RiLoader4Line className="animate-spin" /> : <HiOutlineArrowDownTray />}
          tooltip={t("Tải video")}
          placement="bottom"
        />
      </div>

      <Popover
        reference={downloadTriggerRef}
        trigger="hover"
        placement="bottom"
        arrow
        maxWidth="none"
        zIndex={10050}
      >
        <div className="flex flex-row gap-1 items-center px-0.5 py-0.5">
          <PopoverResolutionButton
            label="720p"
            toneClass="bg-success-light text-success hover:bg-green-100"
            loading={loadingRes === "720p"}
            disabled={disabled}
            title={t("Tải video 720p")}
            onClick={() => void handleDownload("720p")}
          />
          {hasFlow2Upsample1080pVideoMeta(video) && (
            <PopoverResolutionButton
              label="1080p"
              toneClass="bg-violet-50 text-violet-600 hover:bg-violet-100"
              loading={loadingRes === "1080p"}
              disabled={disabled}
              title={t("Tải video 1080p")}
              onClick={() => void handleDownload("1080p")}
            />
          )}
        </div>
      </Popover>
    </>
  );
}
