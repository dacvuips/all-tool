/**
 * Ô ảnh tham chiếu vuông (kéo thả / hiển thị / xóa) – dùng trong scene batch row.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiCloseLine, RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { ImageDialog } from "../../../../shared/utilities/dialog/image-dialog";
import { ElementFormImage } from "../../constants";
import { getElementFormImagePreviewSrc } from "../utils/elementFormImageUtils";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";

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

export interface SceneElementImageSlotProps {
  slotIndex: number;
  value?: ElementFormImage;
  readOnly?: boolean;
  onChange: (value: ElementFormImage | undefined) => void;
  maxSizeMB?: number;
  imageClass?: string;
}

export function SceneElementImageSlot({
  slotIndex,
  value,
  readOnly = false,
  onChange,
  maxSizeMB = 10,
  imageClass = "w-14 h-14",
}: SceneElementImageSlotProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoomImage, setZoomImage] = useState("");

  const previewSrc = useMemo(() => {
    if (!value) return null;
    return getElementFormImagePreviewSrc(value);
  }, [value]);

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
        onChange({
          fifeUrl: "",
          imageBytes,
          mimeType: file.type || "image/png",
          name: file.name,
        });
      } catch (err) {
        console.error("[SceneElementImageSlot] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
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

  const hasImage = !!(value && previewSrc);

  return (
    <div className="relative flex-shrink-0 border-0.5 border-dashed ">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={hasImage ? () => setZoomImage(previewSrc || "") : openFilePicker}
        className={`${imageClass} relative   overflow-hidden transition-all ${
          readOnly && !hasImage
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer"
        } ${readOnly && hasImage ? "opacity-60" : ""} ${
          dragOver
            ? "bg-blue-50 ring-2 ring-blue-400"
            : hasImage
            ? "bg-gray-100"
            : "bg-gray-100/80 hover:bg-gray-100"
        } `}
      >
        <span className="absolute top-0 left-0 z-10 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-gray-600 rounded-br-md">
          {slotIndex}
        </span>

        {uploading ? (
          <div className="flex justify-center items-center w-full h-full">
            <RiLoader4Line className="text-xl text-gray-400 animate-spin" />
          </div>
        ) : hasImage ? (
          <>
            <img
              src={previewSrc}
              alt={value?.name || `Slot ${slotIndex}`}
              className="object-cover w-full h-full"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                className="flex absolute top-0 right-0 z-20 justify-center items-center w-5 h-5 text-white rounded-bl-md transition-colors bg-black/50 hover:bg-red-600"
                aria-label={t("Xóa ảnh")}
              >
                <RiCloseLine className="text-sm" />
              </button>
            )}
          </>
        ) : (
          <div className="flex justify-center items-center w-full h-full">
            <RiAddLine className="text-2xl font-light text-gray-300" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        disabled={readOnly}
        onChange={handleFileChange}
      />
      <ImageDialog
        isOpen={!!zoomImage}
        image={zoomImage}
        onClose={() => setZoomImage("")}
        imageDialogClassName="object-contain max-w-full max-h-[80vh]"
      />
    </div>
  );
}
