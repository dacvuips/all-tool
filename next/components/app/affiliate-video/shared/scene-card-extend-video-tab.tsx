/**
 * scene-card-extend-video-tab.tsx
 * Tab component "Video nối" cho Scene Card
 * Hiển thị extend video (nối giữa 2 scene liền kề) + action buttons
 * Chỉ hiển thị khi có nextSceneId (không phải scene cuối)
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload, AiOutlineVideoCameraAdd } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { RiLoader4Line, RiVideoFill } from "react-icons/ri";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Button } from "../../../shared/utilities/form";
import { getGeneratedVideoPreviewSrc } from "./generatedMediaUtils";
import { SceneMediaError } from "./scene-media-error";

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
  /** Aspect ratio của video (preview + dialog) */
  aspectRatio?: "16:9" | "9:16";
  /** Lỗi tạo video nối (hiển thị inline) */
  errorMessage?: string | null;

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
  errorMessage,
  onGenerateExtendVideo,
  onDownloadExtendVideo,
}: SceneCardExtendVideoTabProps) {
  const { t } = useTranslation();
  const [showExtendVideoModal, setShowExtendVideoModal] = useState(false);

  /** Lấy video source — ưu tiên base64, fallback link */
  const getExtendVideoSrc = (): string | null => {
    if (!generatedExtendVideo) return null;
    return getGeneratedVideoPreviewSrc(generatedExtendVideo);
  };

  const extVideoSrc = getExtendVideoSrc();
  const videoPaddingTop = aspectRatio === "16:9" ? "56.25%" : "174.78%";

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
      <div className="flex items-center justify-center gap-2 group">
        {generatedExtendVideo ? (
          <div className="flex flex-col gap-1.5 items-center w-full">
            {/* ── Extend video preview ── */}
            <div className="w-full min-h-20">
              {extVideoSrc ? (
                <>
                  {/* Video preview — tỷ lệ theo aspectRatio (16:9 → 56.25%, 9:16 → 177.78%) */}
                  <div
                    className="relative w-full rounded-md overflow-hidden border-2 border-teal-300 shadow-sm"
                    style={{ paddingTop: videoPaddingTop }}
                  >
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
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-sm   bg-black bg-opacity-20 opacity-100 hover-parent-hide transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
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
                <div
                  className="relative w-full rounded-xl border-2 border-teal-300 bg-teal-50"
                  style={{ paddingTop: videoPaddingTop }}
                >
                  <RiVideoFill className="absolute inset-0 m-auto text-teal-400 text-xl" />
                </div>
              )}
            </div>
            {/* Action buttons bên dưới video */}
            <div className="flex flex-row gap-1.5 items-center justify-center">
              {/* Tải extend video */}
              <Button
                onClick={onDownloadExtendVideo}
                className="w-8 rounded-lg h-8 bg-success-light text-success"
                iconClassName="text-xl font-bold"
                tooltip={t("Tải")}
                icon={<HiOutlineArrowDownTray />}
                placement="bottom"
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
                  icon={<AiOutlineReload />}
                  placement="bottom"
                  tooltip={t("Tạo lại video nối")}
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                />
              )}

              {/* Tạo lại / progress */}
              {generatingExtendVideo ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 border border-purple-200">
                  <RiLoader4Line className="text-purple-500 text-sm animate-spin" />
                  <span className="text-purple-600 text-[10px] font-bold">
                    {extendVideoProgress}%
                  </span>
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

      <SceneMediaError message={errorMessage} />
    </div>
  );
}
