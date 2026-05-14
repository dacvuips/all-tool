/**
 * scene-card-extend-video-tab.tsx
 * Tab component "Video nối" cho Scene Card
 * Hiển thị extend video (nối giữa 2 scene liền kề) + action buttons
 * Chỉ hiển thị khi có nextSceneId (không phải scene cuối)
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCameraAdd } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Button } from "../../../shared/utilities/form";

// ── Types ────────────────────────────────────────────────────────────────────
export interface GeneratedExtendVideoData {
  videoUri?: string;
  videoBytes?: string;
  mimeType?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardExtendVideoTabProps {
  /** Dữ liệu extend video đã generate */
  generatedExtendVideo: GeneratedExtendVideoData | null;
  /** Đang generate extend video */
  generatingExtendVideo: boolean;
  /** Phần trăm tiến trình */
  extendVideoProgress: number;
  /** Vô hiệu hóa tương tác */
  isDisabled?: boolean;
  /** Có scene kế tiếp không (bắt buộc để tạo video nối) */
  nextSceneId?: string;
  /** Aspect ratio cho video dialog */
  aspectRatio?: string;

  // ── Callbacks ──
  /** Generate/tạo lại extend video. Truyền true để phân biệt với video đơn */
  onGenerateExtendVideo: () => void;
  /** Tải extend video xuống */
  onDownloadExtendVideo: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SceneCardExtendVideoTab({
  generatedExtendVideo,
  generatingExtendVideo,
  extendVideoProgress,
  isDisabled = false,
  nextSceneId,
  aspectRatio,
  onGenerateExtendVideo,
  onDownloadExtendVideo,
}: SceneCardExtendVideoTabProps) {
  const { t } = useTranslation();
  const [showExtendVideoModal, setShowExtendVideoModal] = useState(false);

  /** Lấy video source URL từ data */
  const getExtendVideoSrc = (): string | null => {
    if (!generatedExtendVideo) return null;
    return (
      generatedExtendVideo.videoUri ||
      (generatedExtendVideo.videoBytes
        ? `data:${generatedExtendVideo.mimeType};base64,${generatedExtendVideo.videoBytes}`
        : null)
    );
  };

  const extVideoSrc = getExtendVideoSrc();

  /* Không có scene kế tiếp → hiển thị thông báo */
  if (!nextSceneId) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-gray-400">
        <AiOutlineVideoCameraAdd className="text-2xl mb-1 opacity-50" />
        <span className="text-xs font-medium">{t("Scene cuối, không có video nối")}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-start gap-2">
        {generatedExtendVideo ? (
          <>
            {/* ── Extend video preview ── */}
            <div className="relative flex-1 max-w-xs shrink-0 group">
              {extVideoSrc ? (
                <>
                  {/* Video container 16:9 */}
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-teal-300 shadow-sm aspect-video">
                    <video
                      src={extVideoSrc}
                      className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        const v = e.target as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                      onClick={() => setShowExtendVideoModal(true)}
                      onError={(e) => {
                        console.error(
                          "[SceneCardExtendVideoTab] Extend video load error:",
                          extVideoSrc,
                          e
                        );
                      }}
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                        <BiPlayCircle className="text-white w-12 h-12" />
                      </div>
                    </div>
                  </div>
                  {/* Fullscreen extend video modal */}
                  <VideoDialog
                    videoUrl={extVideoSrc}
                    isOpen={showExtendVideoModal}
                    onClose={() => setShowExtendVideoModal(false)}
                    aspectRatio={aspectRatio}
                  />
                </>
              ) : (
                /* Video placeholder */
                <div className="relative w-full rounded-xl border-2 border-teal-300 bg-teal-50 aspect-video">
                  <RiVideoFill className="absolute inset-0 m-auto text-teal-400 text-xl" />
                </div>
              )}
            </div>

            {/* Action buttons bên phải video */}
            <div className="flex flex-col gap-1.5 items-center">
              {/* Tải extend video */}
              <Button
                onClick={onDownloadExtendVideo}
                className="w-8 rounded-lg h-8 bg-success-light text-success"
                iconClassName="text-xl font-bold"
                tooltip={t("Tải")}
                icon={<HiOutlineArrowDownTray />}
                placement="right"
              />
              {/* Tạo lại / progress */}
              {generatingExtendVideo ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 border border-teal-200">
                  <RiLoader4Line className="text-teal-500 text-sm animate-spin" />
                  <span className="text-teal-600 text-[10px] font-bold">
                    {extendVideoProgress}%
                  </span>
                </div>
              ) : (
                <Button
                  onClick={onGenerateExtendVideo}
                  icon={<GenerateAiIcon />}
                  placement="right"
                  tooltip={t("Tạo lại video nối")}
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                />
              )}
            </div>
          </>
        ) : generatingExtendVideo ? (
          /* ── Spinner khi đang generate ── */
          <div className="w-16 h-16 rounded-xl border-2 border-teal-300 bg-teal-50 flex flex-col items-center justify-center">
            <RiLoader4Line className="text-teal-500 text-xl animate-spin" />
            <span className="text-teal-600 text-[10px] font-bold mt-0.5">
              {extendVideoProgress}%
            </span>
          </div>
        ) : (
          /* ── Default: nút tạo video nối ── */
          <button
            onClick={onGenerateExtendVideo}
            className="relative w-full max-w-xs h-20 shrink-0 rounded-xl border-2 border-dashed transition-all group border-gray-200 hover:border-primary-dark bg-gray-50 hover:bg-primary-light cursor-pointer"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AiOutlineVideoCameraAdd className="text-xl mb-0.5 text-primary group-hover:text-teal-400" />
              <span className="text-xs font-medium text-primary group-hover:text-teal-500">
                {t("Tạo video nối")}
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
