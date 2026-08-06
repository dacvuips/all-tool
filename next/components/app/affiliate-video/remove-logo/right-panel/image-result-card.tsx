/**
 * Card kết quả ẢNH — chỉ So sánh (slider) + Save
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckLine,
  RiCloseLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiFullscreenLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  copyImageToClipboard,
  downloadBase64,
  formatFileSize,
  makeCleanedFileName,
  RemoveLogoHistoryItem,
} from "../constants";
import { useMediaSrc } from "../hook/useMediaSrc";
import { BeforeAfterSlider } from "./before-after-slider";
import { RemoveLogoMediaLightbox } from "./remove-logo-media-lightbox";

type Props = {
  item: RemoveLogoHistoryItem;
  onRemove: (id: string) => void;
};

export function ImageResultCard({ item, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [zoom, setZoom] = useState("");
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const beforeSrc = useMediaSrc(item.originalBase64, item.mimeType || "image/jpeg");
  const afterSrc = useMediaSrc(
    item.cleanedBase64,
    item.cleanedMimeType || item.mimeType || "image/jpeg",
    item.cleanedUrl
  );

  const handleSave = () => {
    if (item.cleanedBase64) {
      downloadBase64(
        item.cleanedBase64,
        item.cleanedMimeType || item.mimeType || "image/jpeg",
        makeCleanedFileName(item.name, "image")
      );
      return;
    }
    if (item.cleanedUrl) {
      window.open(item.cleanedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await copyImageToClipboard({
        base64: item.cleanedBase64 || item.originalBase64,
        mimeType: item.cleanedMimeType || item.mimeType || "image/jpeg",
        srcUrl: afterSrc || beforeSrc,
      });
      setCopied(true);
      toast.success(t("Đã copy ảnh vào clipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      console.error("[ImageResultCard] copy failed:", err);
      toast.error(err?.message || t("Không copy được ảnh. Thử lại hoặc dùng Tải về."));
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="overflow-hidden relative w-full bg-gray-100" style={{ height: 269 }}>
        <div className="absolute inset-0">
          {beforeSrc || afterSrc ? (
            <BeforeAfterSlider
              beforeSrc={beforeSrc}
              afterSrc={afterSrc || beforeSrc}
              alt={item.name}
              className="w-full h-full"
            />
          ) : (
            <div className="flex justify-center items-center w-full h-full text-sm text-gray-500">
              {t("Không tải được ảnh xem trước")}
            </div>
          )}
        </div>

        <div className="absolute top-3 right-3 z-30 flex gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={copying}
            className="flex justify-center items-center w-8 h-8 text-white bg-gray-800 rounded-full border-0 cursor-pointer hover:bg-primary disabled:opacity-60"
            title={copied ? t("Đã copy") : t("Copy ảnh")}
          >
            {copied ? (
              <RiCheckLine className="text-lg text-white" />
            ) : (
              <RiFileCopyLine className="text-lg text-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="flex justify-center items-center w-8 h-8 text-white bg-gray-800 rounded-full border-0 cursor-pointer hover:bg-danger"
            title={t("Xóa")}
          >
            <RiCloseLine className="text-lg text-white" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => afterSrc && setZoom(afterSrc)}
          className="flex absolute bottom-3 left-3 z-30 justify-center items-center w-9 h-9 text-white rounded-full border-0 shadow cursor-pointer bg-primary hover:bg-primary-dark"
          title={t("Phóng to")}
        >
          <RiFullscreenLine className="text-lg text-white" />
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

      {zoom && (
        <RemoveLogoMediaLightbox
          open
          kind="image"
          src={zoom}
          title={item.name}
          onClose={() => setZoom("")}
        />
      )}
    </div>
  );
}
