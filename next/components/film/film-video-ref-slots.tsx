/**
 * Hàng ô Ảnh tham chiếu khi Tạo video — UI giống tool (ô dashed + số thứ tự).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiCloseLine, RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import {
  fileToGenerationImageBase64,
  GENERATION_IMAGE_ACCEPTED_EXTENSIONS,
  GENERATION_IMAGE_ACCEPTED_TYPES,
} from "../app/affiliate-video/shared/compressGenerationImage";
import { getOrCreateBlobPreviewUrl } from "../app/affiliate-video/shared/generatedMediaUtils";
import { ImageDialog } from "../shared/utilities/dialog/image-dialog";
import type { FilmVideoRefMode, FilmVideoRefSlot } from "./film-video-ref-mode";
import { FILM_VIDEO_REF_SLOT_COUNT, padVideoRefSlots } from "./film-video-ref-mode";

type Props = {
  mode: FilmVideoRefMode;
  slots?: Array<FilmVideoRefSlot | null>;
  disabled?: boolean;
  onChange: (slots: Array<FilmVideoRefSlot | null>) => void;
};

function slotPreviewSrc(slot: FilmVideoRefSlot | null | undefined): string | null {
  if (!slot) return null;
  if (slot.imageBlob instanceof Blob && slot.imageBlob.size > 0) {
    return getOrCreateBlobPreviewUrl(slot.imageBlob);
  }
  const url = (slot.imageUrl || "").trim();
  return url || null;
}

export default function FilmVideoRefSlots({
  mode,
  slots: rawSlots,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const slotCount = FILM_VIDEO_REF_SLOT_COUNT[mode];
  const slots = useMemo(() => padVideoRefSlots(rawSlots, mode), [rawSlots, mode]);
  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="relative">
      <div className="flex justify-between items-center">
        <span className="mr-1 text-xs font-bold tracking-wide text-blue-600 uppercase">
          {t("Ảnh tham chiếu")}:
        </span>
        {filledCount > 0 && (
          <span className="text-9 text-blue-500 mt-0.5 block leading-none">
            {t("Đã gắn")} {filledCount}/{slotCount}
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-1">
        {slots.map((slot, i) => (
          <FilmVideoRefSlotCell
            key={i}
            slotIndex={i + 1}
            value={slot}
            disabled={disabled}
            onChange={(next) => {
              const copy = [...slots];
              copy[i] = next;
              onChange(copy);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FilmVideoRefSlotCell({
  slotIndex,
  value,
  disabled,
  onChange,
}: {
  slotIndex: number;
  value: FilmVideoRefSlot | null;
  disabled?: boolean;
  onChange: (value: FilmVideoRefSlot | null) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoomImage, setZoomImage] = useState("");

  const previewSrc = useMemo(() => slotPreviewSrc(value), [value]);

  const processFile = useCallback(
    async (file: File) => {
      if (disabled) return;
      const isImage =
        GENERATION_IMAGE_ACCEPTED_TYPES.includes(file.type) ||
        /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!isImage) {
        toast.error(t("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)"));
        return;
      }
      try {
        setUploading(true);
        const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
        const binary = atob(imageBytes);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType || "image/jpeg" });
        onChange({
          imageBlob: blob,
          name: file.name,
        });
      } catch (err) {
        console.error("[FilmVideoRefSlot] process file:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [disabled, onChange, t, toast]
  );

  const hasImage = !!(value && previewSrc);

  // Cố định 56×56 (box-border) để empty / có ảnh cùng kích thước ngoài
  const slotBoxClass =
    "relative flex-shrink-0 overflow-hidden rounded-sm border border-dashed border-gray-300 bg-gray-50 box-border";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void processFile(file);
      }}
      onClick={() => {
        if (hasImage && previewSrc) {
          setZoomImage(previewSrc);
          return;
        }
        if (!disabled && !uploading) fileInputRef.current?.click();
      }}
      className={`${slotBoxClass} ${
        disabled && !hasImage ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${
        dragOver ? "bg-blue-50 border-blue-400" : hasImage ? "bg-gray-100" : "hover:bg-gray-100"
      }`}
      style={{ width: 56, height: 56 }}
    >
      <span
        className="flex absolute top-0 left-0 z-10 justify-center items-center px-1 h-4 font-bold text-white bg-gray-600 rounded-br-md text-10"
        style={{ minWidth: 16 }}
      >
        {slotIndex}
      </span>
      {uploading ? (
        <div className="flex justify-center items-center w-full h-full">
          <RiLoader4Line className="text-xl text-gray-400 animate-spin" />
        </div>
      ) : hasImage ? (
        <>
          <img
            src={previewSrc || ""}
            alt={value?.name || `Slot ${slotIndex}`}
            className="block object-cover w-full h-full"
            draggable={false}
          />
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="flex absolute top-0 right-0 z-20 justify-center items-center p-0 w-5 h-5 text-white bg-black bg-opacity-50 rounded-bl-md border-0 transition-colors cursor-pointer hover:bg-red-600"
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
      <input
        ref={fileInputRef}
        type="file"
        accept={GENERATION_IMAGE_ACCEPTED_EXTENSIONS}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void processFile(file);
          e.target.value = "";
        }}
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
