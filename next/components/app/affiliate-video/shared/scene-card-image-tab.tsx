/**
 * scene-card-image-tab.tsx
 * Tab component "Hình ảnh" cho Scene Card
 * Hiển thị ảnh đã generate + các action buttons (tải, tạo lại, upload, gallery)
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiGalleryLine, RiImageFill, RiLoader4Line, RiUploadCloud2Line } from "react-icons/ri";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import { SceneMediaError } from "./scene-media-error";

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardImageTabProps {
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
  /** Tải ảnh xuống */
  onDownloadImage: () => void;
  /** Set ảnh từ file upload hoặc gallery */
  onSetImage: (imageData: GeneratedImageData) => void;
  /** Mở Gallery dialog */
  onOpenGallery: () => void;

  // ── Optional: Origin thumbnail (copy-video only) ──
  /** URL ảnh gốc (thumbnail từ video gốc, chỉ dùng cho copy-video) */
  originThumbnailUrl?: string | null;
  /** Đang loading origin thumbnail */
  originThumbnailLoading?: boolean;
  /** Timestamp của scene (hiển thị dưới origin thumbnail) */
  sceneTimestamp?: string;
  /** Lỗi tạo/upload ảnh (hiển thị inline) */
  errorMessage?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SceneCardImageTab({
  generatedImage,
  generatingImage,
  imageProgress,
  sceneNumber,
  isDisabled = false,
  onGenerateImage,
  onDownloadImage,
  onSetImage,
  onOpenGallery,
  originThumbnailUrl,
  originThumbnailLoading,
  sceneTimestamp,
  errorMessage,
}: SceneCardImageTabProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Xử lý upload ảnh từ file input */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) {
        onSetImage({
          imageBytes: base64,
          mimeType: file.type || "image/png",
          fifeUrl: "",
        });
      }
    };
    reader.readAsDataURL(file);
    // Reset input để có thể chọn lại cùng file
    e.target.value = "";
  };
  return (
    <div className={`flex flex-col gap-3 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
      {/* ── Origin Thumbnail (chỉ hiển thị cho copy-video) ── */}
      {(originThumbnailUrl || originThumbnailLoading) && (
        <div className="flex flex-col">
          {originThumbnailLoading ? (
            <div className="w-20 h-12 rounded-lg border border-dashed border-amber-300 bg-amber-50 flex items-center justify-center">
              <RiLoader4Line className="text-amber-500 text-sm animate-spin" />
            </div>
          ) : originThumbnailUrl ? (
            <div className="relative w-full max-w-xs group">
              <Img
                showImageOnClick
                lazyload={false}
                src={originThumbnailUrl}
                alt={`Origin frame - Scene ${sceneNumber}`}
                className="rounded-lg object-cover border border-amber-200 shadow-sm"
                ratio169
              />
              <span className="absolute top-1 left-0 px-1 py-0 rounded-r-full text-9 font-bold text-white border-white border bg-success-dark bg-opacity-70 shadow-sm z-10">
                {t("Ảnh gốc")}
              </span>
              {sceneTimestamp && (
                <span className="block text-center text-9 text-amber-600 font-medium -mt-2 bg-gray-100 pt-2 rounded-b-md">
                  {sceneTimestamp}
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Generated Image section ── */}
      <div className="flex items-center justify-center gap-2 group">
        {generatedImage ? (
          <div className="flex flex-col gap-1.5 items-center w-full">
            {/* Ảnh đã generate */}
            <div className="w-full min-h-20">
              <Img
                showImageOnClick
                lazyload={false}
                src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBytes}`}
                alt={`Scene ${sceneNumber}`}
                className="rounded-md object-cover border border-dashed border-green-300 shadow-sm"
                ratio916
              />
            </div>
            {/* Action buttons bên dưới ảnh */}
            <div className="flex flex-row gap-1.5 items-center justify-center flex-wrap">
              {/* Tải ảnh */}
              <Button
                onClick={onDownloadImage}
                className="w-8 rounded-lg h-8 bg-success-light text-success"
                iconClassName="text-xl font-bold"
                tooltip={t("Tải")}
                icon={<HiOutlineArrowDownTray />}
                placement="bottom"
              />
              {/* Tạo lại / progress */}
              {generatingImage ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 border border-pink-200">
                  <RiLoader4Line className="text-pink-500 text-sm animate-spin" />
                  <span className="text-pink-600 text-[10px] font-bold">{imageProgress}%</span>
                </div>
              ) : (
                <Button
                  onClick={onGenerateImage}
                  icon={<GenerateAiIcon />}
                  placement="bottom"
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              )}
              {/* Upload ảnh */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                icon={<RiUploadCloud2Line />}
                placement="bottom"
                className="w-8 rounded-lg h-8 bg-blue-50 text-blue-500"
                iconClassName="text-xl font-bold"
                tooltip={t("Upload ảnh")}
              />
              {/* Gallery */}
              <Button
                onClick={onOpenGallery}
                icon={<RiGalleryLine />}
                placement="bottom"
                className="w-8 rounded-lg h-8 bg-purple-50 text-purple-500"
                iconClassName="text-xl font-bold"
                tooltip={t("Chọn từ Gallery")}
              />
            </div>
          </div>
        ) : generatingImage ? (
          /* ── Spinner + progress khi chưa có ảnh ── */
          <div className="w-16 h-16 rounded-xl border-2 border-pink-300 bg-pink-50 flex flex-col items-center justify-center">
            <RiLoader4Line className="text-pink-500 text-xl animate-spin" />
            <span className="text-pink-600 text-[10px] font-bold mt-0.5">{imageProgress}%</span>
          </div>
        ) : (
          /* ── Default: nút tạo ảnh ── */
          <button
            onClick={onGenerateImage}
            className="w-full max-w-xs h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 bg-gray-50 hover:bg-pink-50 flex flex-col items-center justify-center cursor-pointer transition-all group"
          >
            <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-xl mb-0.5" />
            <span className="text-gray-400 group-hover:text-pink-500 text-xs font-medium">
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
