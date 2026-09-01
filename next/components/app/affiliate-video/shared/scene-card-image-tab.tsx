/**
 * scene-card-image-tab.tsx
 * Tab component "Hình ảnh" cho Scene Card
 * Hiển thị ảnh đã generate + các action buttons (tải, tạo lại, upload, gallery)
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import React, { useRef, useState } from "react";
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
import { ImageDialog } from "../../../shared/utilities/dialog/image-dialog";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import type { AspectRatio } from "../constants";
import { fileToGenerationImageBase64 } from "./compressGenerationImage";
import { GeneratedImageDownloadButtons } from "./generated-image-download-buttons";
import {
  buildSceneImageFileName,
  getGeneratedImagePreviewSrc,
  hasGeneratedImageData,
  isGeneratedImageReadyForUi,
} from "./generatedMediaUtils";
import {
  INLINE_LIST_TOOLBAR_BTN,
  SceneInlineListCell,
  SceneInlineMediaColumn,
} from "./scene-inline-list-media";
import { getAspectPaddingPercent, isPortraitAspectRatio } from "./aspect-ratio-utils";
import { SceneMediaError } from "./scene-media-error";
import { SceneMediaGenerationProgress } from "./scene-media-generation-progress";

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardImageTabProps {
  /** Aspect ratio của ảnh */
  aspectRatio: AspectRatio;
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
  /** Gộp preview + nút thành 1 hàng (danh sách MXH) */
  inline?: boolean;
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
  inline = false,
}: SceneCardImageTabProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState("");

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

  const paddingPct = getAspectPaddingPercent(aspectRatio);
  const progressLayout = inline ? "inline-cell" : "compact";
  const loadingProgressLayout = inline ? "inline-cell" : "card";
  const imagePaddingTop = `${paddingPct}%`;
  const isPortrait = isPortraitAspectRatio(aspectRatio);
  /** List/inline: cùng width với SceneCardVideoTab */
  const mediaBoxClass = isPortrait ? "w-16 shrink-0" : "w-28 shrink-0";
  /** inline: ảnh trái + icon phải (2×2); card: ảnh trên + icon dưới */
  const mediaStackClass = inline
    ? "flex flex-row items-center gap-1.5"
    : "flex flex-col gap-1.5 items-center w-full";
  const actionToolsClass = inline
    ? "grid grid-cols-2 gap-1 shrink-0 content-center"
    : "flex flex-row flex-nowrap gap-1.5 items-center justify-center";
  // Chỉ coi là có ảnh thật khi đã có mediaBlob/base64 — URL remote (sau clear WM chưa blob) vẫn giữ loading.
  const imageReady = isGeneratedImageReadyForUi(generatedImage);
  const imagePreviewSrc = generatedImage ? getGeneratedImagePreviewSrc(generatedImage) : null;
  const canShowInlineImage =
    !!generatedImage && hasGeneratedImageData(generatedImage) && !!imagePreviewSrc;
  const showImageLoading =
    generatingImage || (!!generatedImage && !imageReady && !canShowInlineImage);

  const handleOpenImageZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imagePreviewSrc) setPreviewImage(imagePreviewSrc);
  };

  /** Khung padding-aspect cố định (list + film) — đồng kích thước ảnh/video */
  const renderAspectFrame = (
    inner: React.ReactNode,
    frameClass: string,
    opts?: { onClick?: () => void }
  ) => (
    <div className="relative w-full">
      <div style={{ paddingTop: imagePaddingTop }} className="w-full" />
      {opts?.onClick ? (
        <button
          id={generateButtonId}
          type="button"
          onClick={opts.onClick}
          className={`absolute inset-0 flex flex-col justify-center items-center w-full h-full rounded-md border-2 border-dashed transition-all cursor-pointer group ${frameClass}`}
        >
          {inner}
        </button>
      ) : (
        <div
          className={`absolute inset-0 flex flex-col justify-center items-center w-full h-full rounded-md border-2 border-dashed ${frameClass}`}
        >
          {inner}
        </div>
      )}
    </div>
  );

  /** Khung rỗng / loading khớp kích thước khung ảnh */
  const renderUniformPlaceholder = (inner: React.ReactNode, clickable?: boolean) =>
    renderAspectFrame(
      inner,
      clickable
        ? "bg-gray-50 border-gray-200 hover:border-pink-300 hover:bg-pink-50"
        : "bg-gray-50 border-pink-200",
      clickable ? { onClick: onGenerateImage } : undefined
    );

  /** Upload + Gallery — dùng khi đã có ảnh hoặc empty (chưa gen vẫn gán ảnh) */
  const renderUploadGalleryButtons = (compact?: boolean) => (
    <>
      <Button
        onClick={() => fileInputRef.current?.click()}
        icon={<RiUploadCloud2Line />}
        placement="bottom"
        className={
          compact
            ? `${INLINE_LIST_TOOLBAR_BTN} text-blue-500`
            : "w-8 h-8 text-blue-500 bg-blue-50 rounded-lg"
        }
        iconClassName={compact ? "text-base" : "text-xl font-bold"}
        tooltip={t("Upload ảnh")}
      />
      <Button
        onClick={onOpenGallery}
        icon={<RiGalleryLine />}
        placement="bottom"
        className={
          compact
            ? `${INLINE_LIST_TOOLBAR_BTN} text-purple-500`
            : "w-8 h-8 text-purple-500 bg-purple-50 rounded-lg"
        }
        iconClassName={compact ? "text-base" : "text-xl font-bold"}
        tooltip={t("Chọn từ Gallery")}
      />
    </>
  );

  const renderInlineImageToolbar = () => (
    <>
      {generatingImage ? (
        <SceneMediaGenerationProgress
          variant="image"
          progress={imageProgress}
          layout="minimal"
          actionPending={generationActionPending}
          onStop={onStopGeneration}
        />
      ) : (
        <Button
          onClick={onGenerateImage}
          icon={<AiOutlineReload />}
          placement="bottom"
          className={`${INLINE_LIST_TOOLBAR_BTN} text-orange`}
          iconClassName="text-base"
          tooltip={t("Tạo lại")}
        />
      )}
      {renderUploadGalleryButtons(true)}
    </>
  );

  return (
    <div
      className={`flex flex-col ${inline ? "gap-0 w-full items-start" : "gap-3"} ${
        isDisabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
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
      <div
        className={`flex gap-2 ${
          inline ? "justify-start items-start" : "justify-center items-center"
        } group w-full`}
      >
        {inline ? (
          <SceneInlineMediaColumn error={errorMessage}>
            {canShowInlineImage && generatedImage ? (
              <SceneInlineListCell
                aspectRatio={aspectRatio}
                variant="image"
                frameClassName="ring-1 ring-green-400"
                preview={
                  <button
                    type="button"
                    onClick={handleOpenImageZoom}
                    title={t("Phóng to")}
                    className="relative w-full h-full cursor-zoom-in border-0 p-0 bg-transparent block"
                  >
                    <img
                      key={imagePreviewSrc || sceneNumber}
                      src={imagePreviewSrc || undefined}
                      alt={`Scene ${sceneNumber}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {slotAssignCount > 0 && onAssignToSlot && (
                      <div className="absolute top-0 left-0 z-20 flex flex-wrap gap-0.5 p-0.5 max-w-full pointer-events-auto">
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
                              className={`flex items-center justify-center min-w-4 h-4 rounded text-9 font-bold shadow ${
                                isAssigned
                                  ? "bg-white ring-1 ring-green-500 text-green-600"
                                  : "bg-black/70 text-white"
                              }`}
                            >
                              {isAssigned ? <RiCheckLine className="text-9" /> : i + 1}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </button>
                }
                toolbar={
                  <>
                    <GeneratedImageDownloadButtons
                      image={generatedImage}
                      fileName={buildSceneImageFileName(sceneNumber, generatedImage.mimeType)}
                      disabled={isDisabled}
                      compact
                    />
                    {renderInlineImageToolbar()}
                  </>
                }
              />
            ) : showImageLoading ? (
              <SceneInlineListCell
                aspectRatio={aspectRatio}
                variant="image"
                frameClassName="ring-1 ring-dashed ring-pink-200"
                preview={
                  <SceneMediaGenerationProgress
                    variant="image"
                    progress={imageProgress}
                    layout="inline-cell"
                    actionPending={generationActionPending}
                    onStop={onStopGeneration}
                  />
                }
              />
            ) : (
              <SceneInlineListCell
                aspectRatio={aspectRatio}
                variant="image"
                frameClassName="ring-1 ring-dashed ring-gray-200"
                preview={
                  <button
                    id={generateButtonId}
                    type="button"
                    onClick={onGenerateImage}
                    className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-pink-50 transition-colors"
                    title={t("Tạo ảnh")}
                  >
                    <RiMagicFill className="text-lg text-pink-300" />
                  </button>
                }
                toolbar={
                  <>
                    <Button
                      onClick={onGenerateImage}
                      icon={<RiMagicFill />}
                      placement="bottom"
                      className={`${INLINE_LIST_TOOLBAR_BTN} text-pink-500`}
                      iconClassName="text-base"
                      tooltip={t("Tạo ảnh")}
                    />
                    {renderUploadGalleryButtons(true)}
                  </>
                }
              />
            )}
          </SceneInlineMediaColumn>
        ) : imageReady && generatedImage ? (
          <div className={mediaStackClass}>
            {/* Ảnh đã generate — cùng padding-aspect với khung video */}
            <div className={`relative ${inline ? mediaBoxClass : "w-full"}`}>
              <div className="relative w-full overflow-hidden rounded-md border-2 border-green-300 border-dashed shadow-sm transition-all hover:border-primary hover:shadow-lg">
                <div style={{ paddingTop: imagePaddingTop }} className="w-full" />
                <img
                  key={getGeneratedImagePreviewSrc(generatedImage) || sceneNumber}
                  src={getGeneratedImagePreviewSrc(generatedImage) || undefined}
                  alt={`Scene ${sceneNumber}`}
                  className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const src = getGeneratedImagePreviewSrc(generatedImage);
                    if (src) setPreviewImage(src);
                  }}
                />
              </div>
              {slotAssignCount > 0 && onAssignToSlot && (
                <div
                  className={`absolute top-0 left-0 z-20 flex flex-wrap gap-1 p-1 ${
                    inline ? "max-w-full" : ""
                  }`}
                >
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
                        className={`flex items-center gap-0.5 rounded-md font-bold shadow-md transition-all ${
                          inline ? "min-w-5 h-5 px-1 text-10" : "min-w-[28px] h-7 px-1.5 text-sm"
                        } ${
                          isAssigned
                            ? "bg-white ring-2 ring-green-500"
                            : "bg-black hover:bg-gray-900"
                        }`}
                      >
                        {isAssigned && (
                          <RiCheckLine
                            className={
                              inline ? "text-xs text-green-600" : "text-base text-green-600"
                            }
                          />
                        )}
                        <span className={isAssigned ? "text-green-600" : "text-white"}>
                          {i + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Action: dưới ảnh (card) / bên phải 2×2 (list) */}
            <div className={actionToolsClass}>
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
                  layout={progressLayout}
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
            <div className={inline ? mediaBoxClass : "w-full"}>
              {renderUniformPlaceholder(
                <SceneMediaGenerationProgress
                  variant="image"
                  progress={imageProgress}
                  layout="card"
                  actionPending={generationActionPending}
                  onStop={onStopGeneration}
                />
              )}
            </div>
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
          /* Empty: khung Tạo ảnh + Upload / Gallery (chưa có ảnh → không hiện Tạo lại) */
          <div className={mediaStackClass}>
            <div className={inline ? mediaBoxClass : "w-full"}>
              {renderUniformPlaceholder(
                <>
                  <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-2xl mb-0.5" />
                  {!inline && (
                    <span className="text-xs font-medium text-gray-400 group-hover:text-pink-500">
                      {t("Tạo ảnh")}
                    </span>
                  )}
                </>,
                true
              )}
            </div>
            <div className={actionToolsClass}>
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

      {errorSlot ?? (!inline ? <SceneMediaError message={errorMessage} /> : null)}

      <ImageDialog
        isOpen={!!previewImage}
        image={previewImage}
        onClose={() => setPreviewImage("")}
      />
    </div>
  );
}
