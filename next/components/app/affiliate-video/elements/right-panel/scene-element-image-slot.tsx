/**
 * Ô ảnh tham chiếu vuông (kéo thả / hiển thị / xóa) – dùng trong scene batch row.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiCloseLine, RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { ImageDialog } from "../../../../shared/utilities/dialog/image-dialog";
import { ElementFormImage } from "../../constants";
import {
  fileToGenerationImageBase64,
  GENERATION_IMAGE_ACCEPTED_EXTENSIONS,
  GENERATION_IMAGE_ACCEPTED_TYPES,
} from "../../shared/compressGenerationImage";
import {
  getElementFormImagePreviewSrc,
  revokeElementFormImagePreviewUrl,
} from "../utils/elementFormImageUtils";

const ACCEPTED_IMAGE_TYPES = GENERATION_IMAGE_ACCEPTED_TYPES;
const ACCEPTED_EXTENSIONS = GENERATION_IMAGE_ACCEPTED_EXTENSIONS;

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
  }, [value?.fifeUrl, value?.imageBytes, value?.mimeType, value?.name]);

  useEffect(() => {
    return () => {
      if (value) revokeElementFormImagePreviewUrl(value);
    };
  }, [value]);

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
        const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
        onChange({
          fifeUrl: "",
          imageBytes,
          mimeType,
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
    <div className="relative flex-shrink-0 border-0.5 border-dashed bg-white">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={hasImage ? () => setZoomImage(previewSrc || "") : openFilePicker}
        className={`${imageClass} relative   overflow-hidden transition-all ${
          readOnly && !hasImage ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        } ${readOnly && hasImage ? "opacity-60" : ""} ${
          dragOver
            ? "bg-blue-50 ring-2 ring-blue-400"
            : hasImage
            ? "bg-gray-100"
            : "bg-gray-100/80 hover:bg-gray-100"
        } `}
      >
        <span className="flex absolute top-0 left-0 z-10 justify-center items-center px-1 font-bold text-white bg-gray-600 rounded-br-md min-w-4 h-min-w-4 text-10">
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
                className="flex absolute top-0 right-0 z-[2] justify-center items-center w-5 h-5 text-white rounded-bl-md transition-colors bg-black/50 hover:bg-red-600"
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
