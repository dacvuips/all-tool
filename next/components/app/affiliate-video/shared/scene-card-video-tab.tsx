/**
 * scene-card-video-tab.tsx
 * Tab component "Video đơn" cho Scene Card
 * Hover preview tắt tiếng; trong video: play + fullscreen; bên ngoài: download + tạo lại
 * Tái sử dụng cho: single, trending, copy-video modules
 * className only – Tailwind CSS, no inline styles
 */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload, AiOutlineVideoCamera } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import {
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiGalleryLine,
  RiLoader4Line,
  RiPauseFill,
  RiPlayFill,
  RiUploadCloud2Line,
  RiVideoFill,
} from "react-icons/ri";
import { Button } from "../../../shared/utilities/form";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { GeneratedVideoDownloadButtons } from "./generated-video-download-buttons";
import {
  GeneratedVideoLike,
  getGeneratedVideoPreviewSrc,
  hasGeneratedVideoData,
} from "./generatedMediaUtils";
import { SceneMediaError } from "./scene-media-error";
import { SceneMediaGenerationProgress } from "./scene-media-generation-progress";
import {
  INLINE_LIST_TOOLBAR_BTN,
  SceneInlineListCell,
  SceneInlineMediaColumn,
} from "./scene-inline-list-media";

const CONTROL_BTN_INSIDE =
  "flex items-center justify-center w-8 h-8 rounded-md bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
};

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.mozFullScreenElement ?? null;
}

async function exitAnyFullscreen(video?: HTMLVideoElement | null): Promise<void> {
  const doc = document as FullscreenDocument;
  const fsEl = getFullscreenElement();

  if (fsEl && doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }
  if (doc.mozCancelFullScreen) {
    await doc.mozCancelFullScreen();
    return;
  }
  const vid = video as FullscreenVideoElement | null | undefined;
  if (vid?.webkitExitFullscreen) {
    vid.webkitExitFullscreen();
  }
}

function isContainerFullscreen(container: HTMLElement | null): boolean {
  if (!container) return false;
  const fsEl = getFullscreenElement();
  return fsEl === container || !!fsEl?.contains(container);
}

// ── Types cho video data ─────────────────────────────────────────────────────
export type GeneratedVideoData = GeneratedVideoLike;

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardVideoTabProps {
  generatedVideo: GeneratedVideoData | null;
  generatingVideo: boolean;
  videoProgress: number;
  isDisabled?: boolean;
  hasImage: boolean;
  isPromptToVideo?: boolean;
  aspectRatio?: "16:9" | "9:16";
  sceneNumber?: number;
  onImageRequired?: () => void;
  errorMessage?: string | null;
  onGenerateVideo: () => void;
  generateButtonId?: string;
  onStopGeneration?: () => void;
  generationActionPending?: boolean;
  /**
   * Khung empty / loading / video đã gen cùng aspect (film Ảnh/video cảnh quay).
   * Tool mặc định: false (empty h-20 như cũ).
   */
  uniformFrame?: boolean;
  /** Upload / chọn gallery → gán video (film) */
  onSetVideo?: (videoData: GeneratedVideoData) => void;
  /** Mở Gallery video */
  onOpenGallery?: () => void;
  /** Gộp preview + nút thành 1 hàng (danh sách MXH) */
  inline?: boolean;
  /** Slot dưới preview (vd. chọn giọng) — chỉ inline */
  inlineFooter?: ReactNode;
}

export function SceneCardVideoTab({
  generatedVideo,
  generatingVideo,
  videoProgress,
  isDisabled = false,
  hasImage,
  isPromptToVideo = false,
  aspectRatio,
  sceneNumber = 0,
  onImageRequired,
  errorMessage,
  onGenerateVideo,
  generateButtonId,
  onStopGeneration,
  generationActionPending = false,
  uniformFrame = false,
  onSetVideo,
  onOpenGallery,
  inline = false,
  inlineFooter,
}: SceneCardVideoTabProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevVideoSrcRef = useRef<string | null>(null);
  const [isVideoFrameReady, setIsVideoFrameReady] = useState(false);
  const [playingWithSound, setPlayingWithSound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVideoZoom, setShowVideoZoom] = useState(false);

  const canAssignVideo = !!onSetVideo;
  const progressLayout = inline ? "minimal" : "compact";
  const loadingProgressLayout = inline ? "minimal" : "card";

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onSetVideo) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name)) {
      return;
    }
    onSetVideo({
      videoUri: null,
      mimeType: file.type || "video/mp4",
      mediaBlob: file,
    });
  };

  const renderUploadGalleryButtons = (compact?: boolean) => {
    if (!canAssignVideo) return null;
    return (
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
          tooltip={t("Upload video")}
        />
        {onOpenGallery ? (
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
        ) : null}
      </>
    );
  };

  const renderInlineVideoToolbar = () => (
    <>
      {generatedVideo ? (
        <GeneratedVideoDownloadButtons
          video={generatedVideo}
          fileName={videoFileName}
          disabled={isDisabled}
          compact
        />
      ) : null}
      {generatingVideo ? (
        <SceneMediaGenerationProgress
          variant="video"
          progress={videoProgress}
          layout="minimal"
          actionPending={generationActionPending}
          onStop={onStopGeneration}
        />
      ) : (
        <Button
          onClick={handleClickGenerate}
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

  const handleClickGenerate = () => {
    if (!isPromptToVideo && !hasImage) {
      onImageRequired?.();
      return;
    }
    onGenerateVideo();
  };

  const videoSrc =
    generatedVideo && hasGeneratedVideoData(generatedVideo)
      ? getGeneratedVideoPreviewSrc(generatedVideo)
      : null;
  const canClickVideo = !!videoSrc && isVideoFrameReady && !isDisabled;

  const videoMimeType = generatedVideo?.mimeType || "video/mp4";
  const videoFileName = `scene-${sceneNumber || "video"}-video.mp4`;

  useEffect(() => {
    const prev = prevVideoSrcRef.current;
    prevVideoSrcRef.current = videoSrc;

    // URL/proxy → blob: cùng clip (sau enrich): giữ preview, không reset spinner
    const isEnrichTransition =
      !!prev &&
      !!videoSrc &&
      prev.includes("/api/file/download-proxy") &&
      (videoSrc.startsWith("blob:") || videoSrc.startsWith("data:"));

    if (!isEnrichTransition) {
      setIsVideoFrameReady(false);
      setPlayingWithSound(false);
      setIsPlaying(false);
    }
  }, [videoSrc]);

  const markVideoReady = () => setIsVideoFrameReady(true);

  // Video đã cache / load xong trước khi gắn listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      markVideoReady();
    }
  }, [videoSrc]);

  // Không để spinner che mãi nếu proxy/base64 load chậm hoặc lỗi im lặng
  useEffect(() => {
    if (!videoSrc || isVideoFrameReady) return;
    const timer = window.setTimeout(markVideoReady, 8000);
    return () => window.clearTimeout(timer);
  }, [videoSrc, isVideoFrameReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoSrc]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(isContainerFullscreen(containerRef.current));
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    document.addEventListener("mozfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
      document.removeEventListener("mozfullscreenchange", syncFullscreenState);
    };
  }, []);

  const handleVideoMouseEnter = () => {
    const video = videoRef.current;
    if (!video || !videoSrc || playingWithSound || isFullscreen) return;
    video.muted = true;
    video.play().catch(() => {});
  };

  const handleVideoMouseLeave = () => {
    const video = videoRef.current;
    if (!video || playingWithSound || isFullscreen) return;
    video.pause();
    video.currentTime = 0;
  };

  const handleTogglePlayPause = () => {
    if (!canClickVideo) return;
    const video = videoRef.current;
    if (!video) return;

    // Đang play tắt tiếng (hover preview) → bật tiếng, giữ play
    if (!playingWithSound && !video.paused) {
      video.muted = false;
      setPlayingWithSound(true);
      return;
    }

    if (video.paused) {
      video.muted = false;
      setPlayingWithSound(true);
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.stopPropagation();
    handleTogglePlayPause();
  };

  const handleInlineVideoZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoSrc || isDisabled) return;
    setShowVideoZoom(true);
  };

  const handleExitFullscreen = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      await exitAnyFullscreen(videoRef.current);
    } catch (err) {
      console.warn("[SceneCardVideoTab] Exit fullscreen failed:", err);
    } finally {
      setIsFullscreen(false);
    }
  };

  const handleEnterFullscreen = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canClickVideo) return;
    const container = containerRef.current;
    const video = videoRef.current as FullscreenVideoElement | null;
    if (!container || !video) return;

    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
      setIsFullscreen(true);
      video.muted = false;
      setPlayingWithSound(true);
      await video.play().catch(() => {});
    } catch (err) {
      console.warn("[SceneCardVideoTab] Fullscreen failed:", err);
    }
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isContainerFullscreen(containerRef.current)) {
      void handleExitFullscreen();
    } else {
      void handleEnterFullscreen();
    }
  };

  const isPortrait = aspectRatio === "9:16";
  /** Chế độ inline (danh sách MXH): preview nhỏ, nút bên cạnh */
  const inlineMediaWidthClass = isPortrait ? "w-16 shrink-0" : "w-28 shrink-0";
  /** Chế độ card (phân cảnh thường): giữ kích thước ban đầu */
  const cardPreviewBoxClass = isPortrait
    ? "w-[140px] shrink-0 aspect-[9/16]"
    : "w-full max-w-[240px] shrink-0 aspect-video";
  const inlinePreviewBoxClass = isPortrait
    ? `${inlineMediaWidthClass} aspect-[9/16]`
    : `${inlineMediaWidthClass} aspect-video`;
  const previewBoxClass = inline ? inlinePreviewBoxClass : cardPreviewBoxClass;
  const usePaddingFrame = uniformFrame || inline;
  const mediaStackClass = inline
    ? "flex flex-row items-center gap-1.5"
    : "flex flex-col gap-1.5 items-center w-full";
  const videoColumnClass = inline ? inlineMediaWidthClass : "w-full";
  const actionToolsClass = inline
    ? "grid grid-cols-2 gap-1 shrink-0 content-center"
    : "flex flex-row flex-nowrap gap-1.5 items-center justify-center";

  /** Cùng padding aspect với SceneCardImageTab (film) */
  const paddingPct = aspectRatio === "16:9" ? 56.25 : 177.78;
  const imagePaddingTop = `${paddingPct}%`;

  const renderUniformPlaceholder = (
    inner: ReactNode,
    opts?: { clickable?: boolean; dashedPurple?: boolean }
  ) => {
    const clickable = !!opts?.clickable;
    const borderClass = opts?.dashedPurple
      ? "border-2 border-purple-200 border-dashed"
      : "border-2 border-gray-200 border-dashed hover:border-purple-300 hover:bg-purple-50";
    return (
      <div className="relative w-full">
        <div style={{ paddingTop: imagePaddingTop }} className="w-full" />
        {clickable ? (
          <button
            id={generateButtonId}
            type="button"
            onClick={handleClickGenerate}
            className={`absolute inset-0 flex flex-col justify-center items-center w-full h-full bg-gray-50 rounded-md transition-all cursor-pointer group ${borderClass}`}
          >
            {inner}
          </button>
        ) : (
          <div
            className={`absolute inset-0 flex flex-col justify-center items-center w-full h-full bg-gray-50 rounded-md ${borderClass}`}
          >
            {inner}
          </div>
        )}
      </div>
    );
  };

  if (inline) {
    return (
      <SceneInlineMediaColumn error={errorMessage}>
        <div
          className={`inline-flex flex-col items-stretch gap-0.5 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}
        >
        {generatedVideo && videoSrc ? (
          <SceneInlineListCell
            aspectRatio={aspectRatio}
            variant="video"
            frameClassName="ring-1 ring-purple-400 bg-black"
            preview={
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  key={videoSrc}
                  className={`z-0 w-full h-full object-contain ${
                    videoSrc && !isDisabled ? "cursor-zoom-in" : "pointer-events-none"
                  }`}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onClick={handleInlineVideoZoom}
                  onLoadedMetadata={markVideoReady}
                  onLoadedData={markVideoReady}
                  onCanPlay={markVideoReady}
                >
                  <source src={videoSrc} type={videoMimeType} />
                </video>
                {videoSrc && !isDisabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                    <BiPlayCircle className="text-white text-xl opacity-90" />
                  </div>
                )}
                {!isVideoFrameReady && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-purple-50/90 pointer-events-none">
                    <RiLoader4Line className="text-lg text-purple-400 animate-spin" />
                  </div>
                )}
              </div>
            }
            toolbar={renderInlineVideoToolbar()}
          />
        ) : generatingVideo ? (
          <SceneInlineListCell
            aspectRatio={aspectRatio}
            variant="video"
            frameClassName="ring-1 ring-dashed ring-purple-200"
            preview={
              <SceneMediaGenerationProgress
                variant="video"
                progress={videoProgress}
                layout="inline-cell"
                actionPending={generationActionPending}
                onStop={onStopGeneration}
              />
            }
          />
        ) : (
          <SceneInlineListCell
            aspectRatio={aspectRatio}
            variant="video"
            frameClassName="ring-1 ring-dashed ring-gray-200"
              preview={
                <button
                  id={generateButtonId}
                  type="button"
                  onClick={handleClickGenerate}
                  className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-purple-50 transition-colors"
                  title={t("Tạo video")}
                >
                  <AiOutlineVideoCamera className="text-lg text-purple-300" />
                </button>
              }
            toolbar={
              <>
                <Button
                  onClick={handleClickGenerate}
                  icon={<AiOutlineVideoCamera />}
                  placement="bottom"
                  className={`${INLINE_LIST_TOOLBAR_BTN} text-purple-500`}
                  iconClassName="text-base"
                  tooltip={t("Tạo video")}
                />
                {renderUploadGalleryButtons(true)}
              </>
            }
          />
        )}
        {canAssignVideo ? (
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.mkv,.m4v"
            className="hidden"
            onChange={handleFileUpload}
          />
        ) : null}
        {inlineFooter}
        {videoSrc ? (
          <VideoDialog
            videoUrl={videoSrc}
            isOpen={showVideoZoom}
            onClose={() => setShowVideoZoom(false)}
            aspectRatio={aspectRatio}
          />
        ) : null}
        </div>
      </SceneInlineMediaColumn>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 ${inline ? "w-full items-center" : ""} ${
        isDisabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className={`flex items-center justify-center gap-2 group ${inline ? "" : "w-full"}`}>
        {generatedVideo ? (
          <div className={mediaStackClass}>
            <div className={`flex flex-col gap-1 items-center ${videoColumnClass}`}>
              {videoSrc ? (
                usePaddingFrame ? (
                  <div
                    ref={containerRef}
                    className={`relative w-full rounded-md overflow-hidden border-2 border-purple-300 shadow-sm bg-black ${
                      isFullscreen
                        ? "flex items-center justify-center !w-full !h-full !max-w-none"
                        : ""
                    }`}
                    onMouseEnter={handleVideoMouseEnter}
                    onMouseLeave={handleVideoMouseLeave}
                  >
                    {!isFullscreen && (
                      <div style={{ paddingTop: imagePaddingTop }} className="w-full" />
                    )}
                    <div
                      className={
                        isFullscreen
                          ? "relative w-full h-full"
                          : "absolute inset-0 w-full h-full"
                      }
                    >
                      <video
                        ref={videoRef}
                        key={videoSrc}
                        className={`relative z-0 w-full h-full object-contain ${
                          canClickVideo ? "cursor-pointer" : "cursor-default pointer-events-none"
                        }`}
                        muted={!playingWithSound && !isFullscreen}
                        loop
                        playsInline
                        controls={canClickVideo && isFullscreen}
                        controlsList="nofullscreen"
                        preload="auto"
                        onClick={handleVideoClick}
                        onLoadedMetadata={markVideoReady}
                        onLoadedData={markVideoReady}
                        onCanPlay={markVideoReady}
                        onError={(e) => {
                          console.error("[SceneCardVideoTab] Video load error:", videoSrc, e);
                          markVideoReady();
                        }}
                      >
                        <source src={videoSrc} type={videoMimeType} />
                      </video>
                      {!isPlaying && !isFullscreen && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-sm bg-black bg-opacity-20">
                          <div className="w-8 h-8 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
                            <BiPlayCircle className="text-white w-10 h-10" />
                          </div>
                        </div>
                      )}
                      {!isVideoFrameReady && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-purple-50 bg-opacity-80 pointer-events-none">
                          <RiLoader4Line className="text-2xl text-purple-400 animate-spin" />
                        </div>
                      )}
                      {canClickVideo && (
                        <div
                          className={`absolute z-[9999] flex items-center gap-2 ${
                            isFullscreen
                              ? "top-3 right-3"
                              : "inset-x-0 bottom-0 justify-center px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent"
                          }`}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleTogglePlayPause();
                            }}
                            title={isPlaying ? t("Tạm dừng") : t("Phát")}
                            className={`${CONTROL_BTN_INSIDE} ${isFullscreen ? "w-10 h-10" : ""}`}
                          >
                            {isPlaying ? (
                              <RiPauseFill className={isFullscreen ? "text-xl" : "text-base"} />
                            ) : (
                              <RiPlayFill className={isFullscreen ? "text-xl" : "text-base"} />
                            )}
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={handleToggleFullscreen}
                            title={isFullscreen ? t("Thoát toàn màn hình") : t("Toàn màn hình")}
                            className={`${CONTROL_BTN_INSIDE} ${isFullscreen ? "w-10 h-10 ring-1 ring-white/40" : ""}`}
                          >
                            {isFullscreen ? (
                              <RiFullscreenExitLine className={isFullscreen ? "text-xl" : "text-base"} />
                            ) : (
                              <RiFullscreenLine className={isFullscreen ? "text-xl" : "text-base"} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                <div
                  ref={containerRef}
                  className={`relative rounded-md overflow-hidden border-2 border-purple-300 shadow-sm bg-black ${previewBoxClass} [&:fullscreen]:overflow-visible [&:fullscreen]:border-0 [&:fullscreen]:rounded-none ${
                    isFullscreen ? "flex items-center justify-center !w-full !h-full !max-w-none !aspect-auto" : ""
                  }`}
                  onMouseEnter={handleVideoMouseEnter}
                  onMouseLeave={handleVideoMouseLeave}
                >
                  <video
                    ref={videoRef}
                    key={videoSrc}
                    className={`relative z-0 ${
                      isFullscreen
                        ? "w-full h-full max-h-screen object-contain"
                        : "block w-full h-full object-contain"
                    } ${canClickVideo ? "cursor-pointer" : "cursor-default pointer-events-none"}`}
                    muted={!playingWithSound && !isFullscreen}
                    loop
                    playsInline
                    controls={canClickVideo && isFullscreen}
                    controlsList="nofullscreen"
                    preload="auto"
                    onClick={handleVideoClick}
                    onLoadedMetadata={markVideoReady}
                    onLoadedData={markVideoReady}
                    onCanPlay={markVideoReady}
                    onError={(e) => {
                      console.error("[SceneCardVideoTab] Video load error:", videoSrc, e);
                      markVideoReady();
                    }}
                  >
                    <source src={videoSrc} type={videoMimeType} />
                  </video>
                  {!isPlaying && !isFullscreen && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-sm bg-black bg-opacity-20 opacity-100 hover-parent-hide transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
                        <BiPlayCircle className="text-white w-10 h-10" />
                      </div>
                    </div>
                  )}
                  {!isVideoFrameReady && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-purple-50 bg-opacity-80 pointer-events-none">
                      <RiLoader4Line className="text-2xl text-purple-400 animate-spin" />
                    </div>
                  )}
                  {canClickVideo && (
                    <div
                      className={`absolute z-[9999] flex items-center gap-2 ${
                        isFullscreen
                          ? "top-3 right-3"
                          : "inset-x-0 bottom-0 justify-center px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent"
                      }`}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTogglePlayPause();
                        }}
                        title={isPlaying ? t("Tạm dừng") : t("Phát")}
                        className={`${CONTROL_BTN_INSIDE} ${isFullscreen ? "w-10 h-10" : ""}`}
                      >
                        {isPlaying ? (
                          <RiPauseFill className={isFullscreen ? "text-xl" : "text-base"} />
                        ) : (
                          <RiPlayFill className={isFullscreen ? "text-xl" : "text-base"} />
                        )}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={handleToggleFullscreen}
                        title={isFullscreen ? t("Thoát toàn màn hình") : t("Toàn màn hình")}
                        className={`${CONTROL_BTN_INSIDE} ${isFullscreen ? "w-10 h-10 ring-1 ring-white/40" : ""}`}
                      >
                        {isFullscreen ? (
                          <RiFullscreenExitLine className={isFullscreen ? "text-xl" : "text-base"} />
                        ) : (
                          <RiFullscreenLine className={isFullscreen ? "text-xl" : "text-base"} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                )
              ) : usePaddingFrame ? (
                renderUniformPlaceholder(
                  <RiVideoFill className="text-purple-400 text-xl" />,
                  { dashedPurple: true }
                )
              ) : (
                <div
                  className={`relative flex items-center justify-center rounded-xl border-2 border-purple-300 bg-purple-50 ${previewBoxClass}`}
                >
                  <RiVideoFill className="text-purple-400 text-xl" />
                </div>
              )}
            </div>
            <div className={actionToolsClass}>
              <GeneratedVideoDownloadButtons
                video={generatedVideo}
                fileName={videoFileName}
                disabled={isDisabled}
              />
              {generatingVideo ? (
                <SceneMediaGenerationProgress
                  variant="video"
                  progress={videoProgress}
                  layout={progressLayout}
                  actionPending={generationActionPending}
                  onStop={onStopGeneration}
                />
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
              {renderUploadGalleryButtons()}
            </div>
          </div>
        ) : generatingVideo ? (
          inline ? (
            <SceneMediaGenerationProgress
              variant="video"
              progress={videoProgress}
              layout={loadingProgressLayout}
              actionPending={generationActionPending}
              onStop={onStopGeneration}
            />
          ) : usePaddingFrame ? (
            <div className={inline ? inlineMediaWidthClass : "w-full"}>
              {renderUniformPlaceholder(
                <SceneMediaGenerationProgress
                  variant="video"
                  progress={videoProgress}
                  layout="card"
                  actionPending={generationActionPending}
                  onStop={onStopGeneration}
                />,
                { dashedPurple: true }
              )}
            </div>
          ) : (
            <SceneMediaGenerationProgress
              variant="video"
              progress={videoProgress}
              layout="card"
              actionPending={generationActionPending}
              onStop={onStopGeneration}
            />
          )
        ) : usePaddingFrame ? (
          <div className={mediaStackClass}>
            <div className={inline ? inlineMediaWidthClass : "w-full"}>
              {renderUniformPlaceholder(
                <>
                  <AiOutlineVideoCamera className="text-xl mb-0.5 text-gray-300 group-hover:text-purple-400" />
                  {!inline && (
                    <span className="px-1 text-10 font-medium text-center text-gray-400 group-hover:text-purple-500">
                      {t("Tạo video đơn")}
                    </span>
                  )}
                </>,
                { clickable: true }
              )}
            </div>
            <div className={actionToolsClass}>
              <Button
                onClick={handleClickGenerate}
                icon={<AiOutlineVideoCamera />}
                placement="bottom"
                className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500"
                iconClassName="text-xl font-bold"
                tooltip={t("Tạo video")}
              />
              {renderUploadGalleryButtons()}
            </div>
          </div>
        ) : (
          <button
            id={generateButtonId}
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

      {canAssignVideo ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv,.m4v"
          className="hidden"
          onChange={handleFileUpload}
        />
      ) : null}

      <SceneMediaError message={errorMessage} />
    </div>
  );
}
