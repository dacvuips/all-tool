/**
 * scene-card-image-tab.tsx
 * Tab component "Hình ảnh" cho Scene Card
 * Hiển thị ảnh đã generate + các action buttons (tải, tạo lại, upload, gallery)
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload } from "react-icons/ai";
import {
  RiCheckLine,
  RiGalleryLine,
  RiImageFill,
  RiLoader4Line,
  RiUploadCloud2Line,
} from "react-icons/ri";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import { fileToGenerationImageBase64 } from "./compressGenerationImage";
import { GeneratedImageDownloadButtons } from "./generated-image-download-buttons";
import { buildSceneImageFileName, getGeneratedImagePreviewSrc } from "./generatedMediaUtils";
import { SceneMediaError } from "./scene-media-error";

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardImageTabProps {
  /** Aspect ratio của ảnh */
  aspectRatio: "16:9" | "9:16";
  /** Dữ liệu ảnh đã generate (null nếu chưa có) */
  generatedImage: GeneratedImageData | null;
  /** Đang trong quá trình generate ảnh */
  generatingImage: boolean;
  /** Phần trăm tiến trình generate ảnh */
  imageProgress: number;
  /** Scene number để hiển thị alt text */
  sceneNumber: number;
  /** Vô hiệu hóa tương tác khi scene bị disabled */
  isDisabled?: boolean;

  // ── Callbacks ──
  /** Generate/tạo lại ảnh */
  onGenerateImage: () => void;
  /** Set ảnh từ file upload hoặc gallery */
  onSetImage: (imageData: GeneratedImageData) => void;
  /** Mở Gallery dialog */
  onOpenGallery: () => void;

  // ── Optional: Origin thumbnail (copy-video / storyboard) ──
  /** URL ảnh gốc (thumbnail video hoặc panel storyboard đã cắt) */
  originThumbnailUrl?: string | null;
  /** Đang loading origin thumbnail */
  originThumbnailLoading?: boolean;
  /** Timestamp của scene (hiển thị dưới origin thumbnail) */
  sceneTimestamp?: string;
  /** Lỗi tạo/upload ảnh (hiển thị inline) */
  errorMessage?: string | null;

  /** Số nút gắn ảnh vào ô tham chiếu (bằng số slot) */
  slotAssignCount?: number;
  /** Các slot (0-based) đã gắn ảnh generate hiện tại */
  assignedSlotIndices?: number[];
  /** Gắn ảnh đã generate vào ô tham chiếu theo index (0-based) */
  onAssignToSlot?: (slotIndex: number) => void;
  /** ID cho nút tạo ảnh (intro tour) */
  generateButtonId?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SceneCardImageTab({
  generatedImage,
  aspectRatio,
  generatingImage,
  imageProgress,
  sceneNumber,
  isDisabled = false,
  onGenerateImage,
  onSetImage,
  onOpenGallery,
  originThumbnailUrl,
  originThumbnailLoading,
  sceneTimestamp,
  errorMessage,
  slotAssignCount = 0,
  assignedSlotIndices = [],
  onAssignToSlot,
  generateButtonId,
}: SceneCardImageTabProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Xử lý upload ảnh từ file input */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
      onSetImage({
        imageBytes,
        mimeType,
        fifeUrl: "",
      });
    } catch {
      // Caller có thể hiển thị lỗi qua UI khác; bỏ qua nếu đọc file thất bại.
    }
  };

  const imagePaddingTop = aspectRatio === "16:9" ? "56.25%" : "177.78%";
  return (
    <div className={`flex flex-col gap-3 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
      {/* ── Origin Thumbnail (copy-video / storyboard) ── */}
      {(originThumbnailUrl || originThumbnailLoading) && (
        <div className="flex flex-col">
          {originThumbnailLoading ? (
            <div className="flex justify-center items-center w-20 h-12 bg-amber-50 rounded-lg border border-amber-300 border-dashed">
              <RiLoader4Line className="text-sm text-amber-500 animate-spin" />
            </div>
          ) : originThumbnailUrl ? (
            <div className="relative w-full max-w-xs group">
              <Img
                showImageOnClick
                lazyload={false}
                src={originThumbnailUrl}
                alt={`Origin frame - Scene ${sceneNumber}`}
                className="object-cover rounded-lg border border-amber-200 shadow-sm"
                ratio169
              />
              <span className="absolute left-0 top-1 z-10 px-1 py-0 font-bold text-white bg-opacity-70 rounded-r-full border border-white shadow-sm text-9 bg-success-dark">
                {t("Ảnh gốc")}
              </span>
              {sceneTimestamp && (
                <span className="block pt-2 -mt-2 font-medium text-center text-amber-600 bg-gray-100 rounded-b-md text-9">
                  {sceneTimestamp}
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Generated Image section ── */}
      <div className="flex gap-2 justify-center items-center group">
        {generatedImage ? (
          <div className="flex flex-col gap-1.5 items-center w-full">
            {/* Ảnh đã generate — tỷ lệ theo aspectRatio (16:9 → 56.25%, 9:16 → 177.78%) */}
            <div className="relative w-full">
              <Img
                showImageOnClick
                lazyload={false}
                percent={parseFloat(imagePaddingTop)}
                src={getGeneratedImagePreviewSrc(generatedImage)}
                alt={`Scene ${sceneNumber}`}
                className="overflow-hidden w-full rounded-md border border-green-300 border-dashed shadow-sm"
              />
              {slotAssignCount > 0 && onAssignToSlot && (
                <div className="absolute top-0 left-0 z-10 flex gap-1.5 p-1">
                  {Array.from({ length: slotAssignCount }, (_, i) => {
                    const isAssigned = assignedSlotIndices.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignToSlot(i);
                        }}
                        title={t("Gắn vào ô ảnh {{n}}", { n: i + 1 })}
                        className={`flex items-center gap-0.5 min-w-[28px] h-7 px-1.5 rounded-md text-sm font-bold shadow-md transition-all ${
                          isAssigned
                            ? "bg-white ring-2 ring-green-500"
                            : "bg-black hover:bg-gray-900"
                        }`}
                      >
                        {isAssigned && <RiCheckLine className="text-base text-green-600" />}
                        <span className={isAssigned ? "text-green-600" : "text-white"}>
                          {i + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Action buttons bên dưới ảnh */}
            <div className="flex flex-row gap-1.5 items-center justify-center flex-wrap">
              <GeneratedImageDownloadButtons
                image={generatedImage}
                fileName={buildSceneImageFileName(sceneNumber, generatedImage.mimeType)}
                disabled={isDisabled}
              />
              {/* Tạo lại / progress */}
              {generatingImage ? (
                <div className="flex gap-1 items-center px-2 py-1 bg-pink-50 rounded-lg border border-pink-200">
                  <RiLoader4Line className="text-sm text-pink-500 animate-spin" />
                  <span className="font-bold text-pink-600 text-10">{imageProgress}%</span>
                </div>
              ) : (
                <Button
                  onClick={onGenerateImage}
                  icon={<AiOutlineReload />}
                  placement="bottom"
                  className="w-8 h-8 rounded-lg bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              )}
              {/* Upload ảnh */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                icon={<RiUploadCloud2Line />}
                placement="bottom"
                className="w-8 h-8 text-blue-500 bg-blue-50 rounded-lg"
                iconClassName="text-xl font-bold"
                tooltip={t("Upload ảnh")}
              />
              {/* Gallery */}
              <Button
                onClick={onOpenGallery}
                icon={<RiGalleryLine />}
                placement="bottom"
                className="w-8 h-8 text-purple-500 bg-purple-50 rounded-lg"
                iconClassName="text-xl font-bold"
                tooltip={t("Chọn từ Gallery")}
              />
            </div>
          </div>
        ) : generatingImage ? (
          /* ── Spinner + progress khi chưa có ảnh ── */
          <div className="flex flex-col justify-center items-center w-16 h-16 bg-pink-50 rounded-xl border-2 border-pink-300">
            <RiLoader4Line className="text-xl text-pink-500 animate-spin" />
            <span className="text-pink-600 text-[10px] font-bold mt-0.5">{imageProgress}%</span>
          </div>
        ) : (
          /* ── Default: nút tạo ảnh ── */
          <button
            id={generateButtonId}
            onClick={onGenerateImage}
            className="flex flex-col justify-center items-center w-full max-w-xs h-20 bg-gray-50 rounded-xl border-2 border-gray-200 border-dashed transition-all cursor-pointer hover:border-pink-300 hover:bg-pink-50 group"
          >
            <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-xl mb-0.5" />
            <span className="text-xs font-medium text-gray-400 group-hover:text-pink-500">
              {t("Tạo ảnh")}
            </span>
          </button>
        )}
      </div>

      {/* Hidden file input cho upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <SceneMediaError message={errorMessage} />
    </div>
  );
}
