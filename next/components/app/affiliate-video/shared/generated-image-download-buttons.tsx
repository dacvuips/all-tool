/**
 * generated-image-download-buttons.tsx
 * Nút tải ảnh 1K (gốc) + upscale 2K/4K — inline hoặc overlay trên ảnh.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Button } from "../../../shared/utilities/form";
import { Popover } from "../../../shared/utilities/popover/popover";
import {
  downloadGeneratedImage,
  downloadUpsampledImage,
  GeneratedImageLike,
  hasFlow2UpsampleMeta,
  hasGeneratedImageData,
  UpsampleResolution,
} from "./generatedMediaUtils";

export interface GeneratedImageDownloadButtonsProps {
  image: GeneratedImageLike;
  fileName: string;
  disabled?: boolean;
  /** Hiển thị text "1K" thay vì icon tải (chỉ variant inline) */
  show1kLabel?: boolean;
  className?: string;
  /** inline: hàng nút dưới ảnh; overlay: góc trong ảnh (hover) */
  variant?: "inline" | "overlay";
  /** Khối toolbar MXH inline — nút 28×28 trong ô lưới */
  compact?: boolean;
}

const OVERLAY_BTN =
  "flex justify-center items-center min-w-7 h-7 px-1.5 text-10 font-bold bg-white rounded-full border border-slate-200 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50";

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

function OverlayResolutionButton({
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
      className={`${OVERLAY_BTN} ${toneClass}`}
    >
      {loading ? <RiLoader4Line className="text-xs animate-spin" /> : label}
    </button>
  );
}

export function GeneratedImageDownloadButtons({
  image,
  fileName,
  disabled = false,
  show1kLabel = false,
  className,
  variant = "inline",
  compact = false,
}: GeneratedImageDownloadButtonsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const downloadTriggerRef = useRef<HTMLButtonElement>(null);
  const [downloading1k, setDownloading1k] = useState(false);
  const [loadingRes, setLoadingRes] = useState<UpsampleResolution | null>(null);
  const isDownloading = downloading1k || loadingRes !== null;

  if (!hasGeneratedImageData(image)) {
    return null;
  }

  const handleDownload1k = async () => {
    if (downloading1k || disabled) return;
    setDownloading1k(true);
    try {
      await downloadGeneratedImage(image, fileName);
      toast.success(t("Đã tải ảnh"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("Không thể tải ảnh");
      toast.error(message);
    } finally {
      setDownloading1k(false);
    }
  };

  const handleUpsample = async (resolution: UpsampleResolution) => {
    if (loadingRes || disabled) return;
    setLoadingRes(resolution);
    try {
      await downloadUpsampledImage(image, fileName, resolution);
      toast.success(t("Đã tải ảnh {{res}}", { res: resolution }));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("Không thể upscale ảnh {{res}}", { res: resolution });
      toast.error(message);
    } finally {
      setLoadingRes(null);
    }
  };

  if (variant === "overlay") {
    return (
      <div
        className={`absolute bottom-2 left-2 z-20 flex gap-1 transition-opacity ${
          disabled ? "opacity-40 pointer-events-none" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <OverlayResolutionButton
          label="1K"
          toneClass="text-green-600 hover:bg-green-50"
          loading={downloading1k}
          disabled={disabled}
          title={t("Tải ảnh 1K")}
          onClick={handleDownload1k}
        />
        {hasFlow2UpsampleMeta(image, "2K") && (
          <OverlayResolutionButton
            label="2K"
            toneClass="text-violet-600 hover:bg-violet-50"
            loading={loadingRes === "2K"}
            disabled={disabled}
            title={t("Tải ảnh 2K")}
            onClick={() => void handleUpsample("2K")}
          />
        )}
        {hasFlow2UpsampleMeta(image, "4K") && (
          <OverlayResolutionButton
            label="4K"
            toneClass="text-indigo-600 hover:bg-indigo-50"
            loading={loadingRes === "4K"}
            disabled={disabled}
            title={t("Tải ảnh 4K")}
            onClick={() => void handleUpsample("4K")}
          />
        )}
      </div>
    );
  }

  const downloadBtnClass = compact
    ? "w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] p-0 rounded-md bg-transparent border-0 shadow-none text-success hover:bg-transparent"
    : isDownloading
      ? "w-8 h-8 rounded-lg bg-success-light text-success-dark"
      : show1kLabel
        ? "px-2 h-8 text-xs font-bold rounded-lg min-w-8 bg-success-light text-success"
        : "w-8 h-8 rounded-lg bg-success-light text-success";

  const wrapperClass = compact
    ? "flex items-center justify-center w-7 h-7 min-w-[28px] max-w-[28px] overflow-hidden shrink-0"
    : className || "flex flex-row gap-1 items-center justify-center flex-wrap";

  return (
    <div className={wrapperClass}>
      <Button
        innerRef={downloadTriggerRef}
        disabled={disabled}
        className={downloadBtnClass}
        iconClassName={compact ? "text-base" : "text-xl font-bold"}
        icon={
          isDownloading ? (
            <RiLoader4Line className="animate-spin" />
          ) : show1kLabel ? undefined : (
            <HiOutlineArrowDownTray />
          )
        }
      >
        {!isDownloading && show1kLabel ? "1K" : undefined}
      </Button>

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
            label="1K"
            toneClass="bg-success-light text-success hover:bg-green-100"
            loading={downloading1k}
            disabled={disabled}
            title={t("Tải ảnh 1K")}
            onClick={() => void handleDownload1k()}
          />
          {hasFlow2UpsampleMeta(image, "2K") && (
            <PopoverResolutionButton
              label="2K"
              toneClass="bg-violet-50 text-violet-600 hover:bg-violet-100"
              loading={loadingRes === "2K"}
              disabled={disabled}
              title={t("Tải ảnh 2K")}
              onClick={() => void handleUpsample("2K")}
            />
          )}
          {hasFlow2UpsampleMeta(image, "4K") && (
            <PopoverResolutionButton
              label="4K"
              toneClass="bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              loading={loadingRes === "4K"}
              disabled={disabled}
              title={t("Tải ảnh 4K")}
              onClick={() => void handleUpsample("4K")}
            />
          )}
        </div>
      </Popover>
    </div>
  );
}
