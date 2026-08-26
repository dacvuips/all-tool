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
  RiMagicFill,
  RiUploadCloud2Line,
} from "react-icons/ri";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import { fileToGenerationImageBase64 } from "./compressGenerationImage";
import { GeneratedImageDownloadButtons } from "./generated-image-download-buttons";
import { buildSceneImageFileName, getGeneratedImagePreviewSrc, isGeneratedImageReadyForUi } from "./generatedMediaUtils";
import { SceneMediaError } from "./scene-media-error";
import { SceneMediaGenerationProgress } from "./scene-media-generation-progress";

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
  /** Thay khối lỗi mặc định (film: chip item chưa có ảnh) */
  errorSlot?: React.ReactNode;

  /** Số nút gắn ảnh vào ô tham chiếu (bằng số slot) */
  slotAssignCount?: number;
  /** Các slot (0-based) đã gắn ảnh generate hiện tại */
  assignedSlotIndices?: number[];
  /** Gắn ảnh đã generate vào ô tham chiếu theo index (0-based) */
  onAssignToSlot?: (slotIndex: number) => void;
  /** ID cho nút tạo ảnh (intro tour) */
  generateButtonId?: string;

  /** Dừng khi đang generate (hover loader) */
  onStopGeneration?: () => void;
  generationActionPending?: boolean;
  /**
   * Khung empty / loading / ảnh đã gen cùng một aspect (film).
   * Tool mặc định: false (empty h-20 như cũ).
   */
  uniformFrame?: boolean;
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
  errorSlot,
  slotAssignCount = 0,
  assignedSlotIndices = [],
  onAssignToSlot,
  generateButtonId,
  onStopGeneration,
  generationActionPending = false,
  uniformFrame = false,
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

  const paddingPct = aspectRatio === "16:9" ? 56.25 : 177.78;
  const imagePaddingTop = `${paddingPct}%`;
  // Chỉ coi là có ảnh thật khi đã có mediaBlob/base64 — URL remote (sau clear WM chưa blob) vẫn giữ loading.
  const imageReady = isGeneratedImageReadyForUi(generatedImage);
  const showImageLoading = generatingImage || (!!generatedImage && !imageReady);
  /** Khung rỗng / loading khớp kích thước khung ảnh */
  const renderUniformPlaceholder = (inner: React.ReactNode, clickable?: boolean) => (
    <div className="relative w-full">
      <div style={{ paddingTop: imagePaddingTop }} className="w-full" />
      {clickable ? (
        <button
          id={generateButtonId}
          type="button"
          onClick={onGenerateImage}
          className="absolute inset-0 flex flex-col justify-center items-center w-full h-full bg-gray-50 rounded-md border-2 border-gray-200 border-dashed transition-all cursor-pointer hover:border-pink-300 hover:bg-pink-50 group"
        >
          {inner}
        </button>
      ) : (
        <div className="absolute inset-0 flex flex-col justify-center items-center w-full h-full bg-gray-50 rounded-md border-2 border-pink-200 border-dashed">
          {inner}
        </div>
      )}
    </div>
  );

  /** Upload + Gallery — dùng khi đã có ảnh hoặc empty (chưa gen vẫn gán ảnh) */
  const renderUploadGalleryButtons = () => (
    <>
      <Button
        onClick={() => fileInputRef.current?.click()}
        icon={<RiUploadCloud2Line />}
        placement="bottom"
        className="w-8 h-8 text-blue-500 bg-blue-50 rounded-lg"
        iconClassName="text-xl font-bold"
        tooltip={t("Upload ảnh")}
      />
      <Button
        onClick={onOpenGallery}
        icon={<RiGalleryLine />}
        placement="bottom"
        className="w-8 h-8 text-purple-500 bg-purple-50 rounded-lg"
        iconClassName="text-xl font-bold"
        tooltip={t("Chọn từ Gallery")}
      />
    </>
  );

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
      <div className="flex gap-2 justify-center items-center group w-full">
        {imageReady && generatedImage ? (
          <div className="flex flex-col gap-1.5 items-center w-full">
            {/* Ảnh đã generate — tỷ lệ theo aspectRatio (16:9 → 56.25%, 9:16 → 177.78%) */}
            <div className="relative w-full rounded-md overflow-hidden border-2 border-transparent transition-all hover:border-primary hover:shadow-lg">
              <Img
                key={getGeneratedImagePreviewSrc(generatedImage) || sceneNumber}
                showImageOnClick
                lazyload={false}
                percent={paddingPct}
                src={getGeneratedImagePreviewSrc(generatedImage)}
                alt={`Scene ${sceneNumber}`}
                className="overflow-hidden w-full rounded-md border border-green-300 border-dashed shadow-sm object-cover"
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
                <SceneMediaGenerationProgress
                  variant="image"
                  progress={imageProgress}
                  layout="compact"
                  actionPending={generationActionPending}
                  onStop={onStopGeneration}
                />
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
              {renderUploadGalleryButtons()}
            </div>
          </div>
        ) : showImageLoading ? (
          uniformFrame ? (
            renderUniformPlaceholder(
              <SceneMediaGenerationProgress
                variant="image"
                progress={imageProgress}
                layout="card"
                actionPending={generationActionPending}
                onStop={onStopGeneration}
              />
            )
          ) : (
            <SceneMediaGenerationProgress
              variant="image"
              progress={imageProgress}
              layout="card"
              actionPending={generationActionPending}
              onStop={onStopGeneration}
            />
          )
        ) : uniformFrame ? (
          /* Empty film: khung Tạo ảnh + Upload / Gallery (chưa có ảnh → không hiện Tạo lại) */
          <div className="flex flex-col gap-1.5 items-center w-full">
            {renderUniformPlaceholder(
              <>
                <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-2xl mb-0.5" />
                <span className="text-xs font-medium text-gray-400 group-hover:text-pink-500">
                  {t("Tạo ảnh")}
                </span>
              </>,
              true
            )}
            <div className="flex flex-row gap-1.5 items-center justify-center flex-wrap">
              <Button
                onClick={onGenerateImage}
                icon={<RiMagicFill />}
                placement="bottom"
                className="w-8 h-8 rounded-lg bg-pink-50 text-pink-500"
                iconClassName="text-xl font-bold"
                tooltip={t("Tạo ảnh")}
              />
              {renderUploadGalleryButtons()}
            </div>
          </div>
        ) : (
          /* ── Default tool: nút tạo ảnh compact ── */
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

      {errorSlot ?? <SceneMediaError message={errorMessage} />}
    </div>
  );
}
