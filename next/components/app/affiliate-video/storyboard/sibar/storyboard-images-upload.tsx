/**
 * storyboard-images-upload.tsx
 * Upload ảnh storyboard – kéo thả hoặc chọn file.
 * Tailwind CSS className only – no inline styles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiLoader4Line, RiUploadCloud2Line } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { ImageDialog } from "../../../../shared/utilities/dialog/image-dialog";
import { Button } from "../../../../shared/utilities/form";
import { ElementFormImage } from "../../constants";
import {
  getElementFormImagePreviewSrc,
  getImageDisplayName,
} from "../../elements/utils/elementFormImageUtils";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";
interface ObjectPersonifyImageUploadProps {
  imageValue?: ElementFormImage;
  onImageChange?: (image: ElementFormImage | undefined) => void;
  readOnly?: boolean;
  maxSizeMB?: number;
}
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

export function StoryboardImagesUpload({
  imageValue,
  onImageChange,
  readOnly = false,
  maxSizeMB = 10,
}: ObjectPersonifyImageUploadProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoomImage, setZoomImage] = useState("");

  const previewSrc = useMemo(() => {
    if (!imageValue) return null;
    return getElementFormImagePreviewSrc(imageValue);
  }, [imageValue]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  const processFile = useCallback(
    async (file: File) => {
      if (readOnly) return;

      const isImage =
        ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!isImage) {
        toast.error(t("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)"));
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(
          `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSizeMB}MB, ${t("file")}: ${sizeMB.toFixed(
            1
          )}MB`
        );
        return;
      }

      try {
        setUploading(true);
        const imageBytes = await fileToBase64(file);
        onImageChange?.({
          fifeUrl: "",
          imageBytes,
          mimeType: file.type || "image/png",
          name: file.name,
        });
        toast.success(t("Đã chọn ảnh thành công"));
      } catch (err) {
        console.error("[ObjectPersonifyImageUpload] Error:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, onImageChange, readOnly, t, toast]
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

  const handleClear = () => onImageChange?.(undefined);

  const openFilePicker = () => {
    if (!readOnly && !uploading) fileInputRef.current?.click();
  };

  const displayName = imageValue ? getImageDisplayName(imageValue) : "";

  return (
    <div>
      {imageValue?.imageBytes && previewSrc ? (
        <div className="overflow-hidden relative bg-gray-50 rounded-xl border-2 border-indigo-200">
          <div
            role="button"
            tabIndex={0}
            className="flex relative justify-center items-center w-full h-40 bg-gray-100 cursor-pointer"
            onClick={() => !uploading && setZoomImage(previewSrc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!uploading) setZoomImage(previewSrc);
              }
            }}
          >
            <img
              src={previewSrc}
              alt={t("Ảnh tham chiếu nhân hoá")}
              className="object-contain max-w-full max-h-full pointer-events-none"
            />
            {uploading && (
              <div className="flex absolute inset-0 flex-col gap-2 justify-center items-center bg-white/70">
                <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
                <span className="text-sm font-medium text-indigo-600">{t("Đang xử lý")}...</span>
              </div>
            )}
          </div>
          <ImageDialog
            isOpen={!!zoomImage}
            image={zoomImage}
            onClose={() => setZoomImage("")}
            imageDialogClassName="object-contain max-w-full max-h-[80vh]"
          />
          <div className="flex justify-between items-center px-3 py-2 bg-white border-t border-gray-200">
            <span className="text-xs text-gray-600 truncate" title={displayName || imageValue.name}>
              {displayName || t("Ảnh tham chiếu")}
            </span>
            {!readOnly && (
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <Button
                  onClick={openFilePicker}
                  icon={<RiUploadCloud2Line />}
                  className="w-7 h-7 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100"
                  iconClassName="text-base"
                  tooltip={t("Đổi ảnh")}
                />
                <Button
                  onClick={handleClear}
                  icon={<RiCloseLine />}
                  className="w-7 h-7 text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                  iconClassName="text-base"
                  tooltip={t("Xóa")}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-all ${
            readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          } ${
            dragOver
              ? "bg-indigo-50 border-indigo-400"
              : "border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col gap-2 items-center">
              <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
              <span className="text-sm font-medium text-indigo-600">{t("Đang xử lý")}...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center mb-2 w-10 h-10 bg-indigo-50 rounded-full">
                <RiUploadCloud2Line className="text-xl text-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-center text-gray-700">
                {t("Kéo thả hoặc bấm để chọn ảnh")}
              </span>
              <span className="mt-1 text-xs text-center text-gray-400">
                JPG, PNG, WebP, GIF • {t("Tối đa")} {maxSizeMB}MB
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        disabled={readOnly || uploading}
        onChange={handleFileChange}
      />
    </div>
  );
}
