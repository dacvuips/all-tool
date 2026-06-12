/**
 * scene-card-video-tab.tsx
 * Tab component "Video đơn" cho Scene Card
 * Hiển thị video đã generate + action buttons (tải, tạo lại)
 * Hover video để play, click để mở fullscreen modal
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload, AiOutlineVideoCamera } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Button } from "../../../shared/utilities/form";
import { getGeneratedVideoPreviewSrc } from "./generatedMediaUtils";
import { SceneMediaError } from "./scene-media-error";

// ── Types cho video data ─────────────────────────────────────────────────────
export interface GeneratedVideoData {
  videoUri?: string;
  videoBytes?: string;
  mimeType?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardVideoTabProps {
  /** Dữ liệu video đã generate */
  generatedVideo: GeneratedVideoData | null;
  /** Đang generate video */
  generatingVideo: boolean;
  /** Phần trăm tiến trình */
  videoProgress: number;
  /** Vô hiệu hóa tương tác */
  isDisabled?: boolean;
  /** Có ảnh chưa (cần ảnh trước khi tạo video, trừ prompt_to_video) */
  hasImage: boolean;
  /** Chế độ prompt_to_video (không cần ảnh trước) */
  isPromptToVideo?: boolean;
  /** Aspect ratio của video (preview + dialog) */
  aspectRatio?: "16:9" | "9:16";
  /** Thông báo lỗi khi chưa có ảnh */
  onImageRequired?: () => void;
  /** Lỗi tạo video (hiển thị inline) */
  errorMessage?: string | null;

  // ── Callbacks ──
  /** Generate/tạo lại video */
  onGenerateVideo: () => void;
  /** Tải video xuống */
  onDownloadVideo: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SceneCardVideoTab({
  generatedVideo,
  generatingVideo,
  videoProgress,
  isDisabled = false,
  hasImage,
  isPromptToVideo = false,
  aspectRatio,
  onImageRequired,
  errorMessage,
  onGenerateVideo,
  onDownloadVideo,
}: SceneCardVideoTabProps) {
  const { t } = useTranslation();
  const [showVideoModal, setShowVideoModal] = useState(false);

  /** Kiểm tra điều kiện trước khi generate video */
  const handleClickGenerate = () => {
    if (!isPromptToVideo && !hasImage) {
      onImageRequired?.();
      return;
    }
    onGenerateVideo();
  };

  /** Lấy video source — ưu tiên base64, fallback link */
  const getVideoSrc = (): string | null => {
    if (!generatedVideo) return null;
    return getGeneratedVideoPreviewSrc(generatedVideo);
  };

  const videoSrc = getVideoSrc();
  const videoPaddingTop = aspectRatio === "16:9" ? "56.25%" : "174.78%";

  return (
    <div className={`flex flex-col gap-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-center gap-2 group">
        {generatedVideo ? (
          <div className="flex flex-col gap-1.5 items-center w-full">
            {/* ── Video preview ── */}
            <div className="w-full min-h-20">
              {videoSrc ? (
                <>
                  {/* Video preview — tỷ lệ theo aspectRatio (16:9 → 56.25%, 9:16 → 177.78%) */}
                  <div
                    className="relative w-full rounded-md overflow-hidden border-2 border-purple-300 shadow-sm"
                    style={{ paddingTop: videoPaddingTop }}
                  >
                    <video
                      src={videoSrc}
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
                      onClick={() => setShowVideoModal(true)}
                      onError={(e) => {
                        console.error("[SceneCardVideoTab] Video load error:", videoSrc, e);
                      }}
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-sm bg-black bg-opacity-20 opacity-100 hover-parent-hide transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
                        <BiPlayCircle className="text-white w-12 h-12" />
                      </div>
                    </div>
                  </div>
                  {/* Fullscreen video modal */}
                  <VideoDialog
                    videoUrl={videoSrc}
                    isOpen={showVideoModal}
                    onClose={() => setShowVideoModal(false)}
                    aspectRatio={aspectRatio}
                  />
                </>
              ) : (
                /* Video placeholder khi có data nhưng không có src */
                <div
                  className="relative w-full rounded-xl border-2 border-purple-300 bg-purple-50"
                  style={{ paddingTop: videoPaddingTop }}
                >
                  <RiVideoFill className="absolute inset-0 m-auto text-purple-400 text-xl" />
                </div>
              )}
            </div>
            {/* Action buttons bên dưới video */}
            <div className="flex flex-row gap-1.5 items-center justify-center">
              {/* Tải video */}
              <Button
                onClick={onDownloadVideo}
                className="w-8 rounded-lg h-8 bg-success-light text-success"
                iconClassName="text-xl font-bold"
                tooltip={t("Tải")}
                icon={<HiOutlineArrowDownTray />}
                placement="bottom"
              />
              {/* Tạo lại / progress */}
              {generatingVideo ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 border border-purple-200">
                  <RiLoader4Line className="text-purple-500 text-sm animate-spin" />
                  <span className="text-purple-600 text-[10px] font-bold">{videoProgress}%</span>
                </div>
              ) : (
                <Button
                  onClick={handleClickGenerate}
                  icon={<AiOutlineReload />}
                  placement="bottom"
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              )}
              {/* Tạo lại / progress */}
              {generatingVideo ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 border border-purple-200">
                  <RiLoader4Line className="text-purple-500 text-sm animate-spin" />
                  <span className="text-purple-600 text-[10px] font-bold">{videoProgress}%</span>
                </div>
              ) : (
                <div className="flex flex-row gap-1 items-center   bg-purple-200 rounded-lg h-8 divide-x-0.5 overflow-hidden  ">
                  <Button
                    text={"2k"}
                    className="px-2 font-medium rounded-none text-purple-500"
                    tooltip={t("Tạo video 2k (1080p)")}
                  />
                  <Button
                    text={"4k"}
                    className="px-2 font-medium rounded-none text-purple-500"
                    tooltip={t("Tạo video 4k (2160p)")}
                  />
                  <Button
                    text={"8k"}
                    className="px-2 font-medium rounded-none text-purple-500"
                    tooltip={t("Tạo video 8k (4320p)")}
                  />
                </div>
              )}
            </div>
          </div>
        ) : generatingVideo ? (
          /* ── Spinner khi đang generate ── */
          <div className="w-16 h-16 rounded-xl border-2 border-purple-300 bg-purple-50 flex flex-col items-center justify-center">
            <RiLoader4Line className="text-purple-500 text-xl animate-spin" />
            <span className="text-purple-600 text-[10px] font-bold mt-0.5">{videoProgress}%</span>
          </div>
        ) : (
          /* ── Default: nút tạo video ── */
          <button
            onClick={handleClickGenerate}
            className="relative w-full max-w-xs h-20 rounded-xl border-2 border-dashed transition-all group border-gray-200 hover:bg-purple-50 bg-gray-50 hover:border-purple-200 cursor-pointer text-purple-500"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AiOutlineVideoCamera className="text-xl mb-0.5 text-gray-300 group-hover:text-purple-400" />
              <span className="text-xs font-medium text-gray-400 group-hover:text-purple-500">
                {t("Tạo video đơn")}
              </span>
            </div>
          </button>
        )}
      </div>

      <SceneMediaError message={errorMessage} />
    </div>
  );
}
