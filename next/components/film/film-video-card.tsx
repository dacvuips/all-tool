/**
 * Card Video cảnh quay — UI bám tool (SceneCardVideoTab: purple border, preview, CTA dashed).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload, AiOutlineVideoCamera } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import {
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiLoader4Line,
  RiPauseFill,
  RiPlayFill,
  RiVideoFill,
} from "react-icons/ri";
import { SceneMediaError } from "../app/affiliate-video/shared/scene-media-error";
import { SceneMediaGenerationProgress } from "../app/affiliate-video/shared/scene-media-generation-progress";
import { Button } from "../shared/utilities/form";
import { FilmAspectRatio, FilmSceneRecord } from "./film-types";
import { sceneFrameReady } from "./film-shot-image-card";

type Props = {
  scene: FilmSceneRecord;
  aspectRatio?: FilmAspectRatio;
  onCreateVideo?: (scene: FilmSceneRecord) => void;
  onStopVideo?: (scene: FilmSceneRecord) => void;
  generationActionPending?: boolean;
};

export function sceneVideoReady(scene: FilmSceneRecord): boolean {
  return scene.videoStatus === "ready" || !!scene.videoUrl;
}

export function sceneVideoCreating(scene: FilmSceneRecord): boolean {
  return scene.videoStatus === "creating";
}

const CONTROL_BTN =
  "flex items-center justify-center w-8 h-8 rounded-md bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-colors border-0 cursor-pointer";

export default function FilmVideoCard({
  scene,
  aspectRatio = "9:16",
  onCreateVideo,
  onStopVideo,
  generationActionPending = false,
}: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoFrameReady, setIsVideoFrameReady] = useState(false);
  const [playingWithSound, setPlayingWithSound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
  const sceneTitle =
    scene.title?.trim() ||
    scene.summary?.trim() ||
    `${t("Cảnh quay")} ${indexLabel}`;
  const description =
    scene.summary || scene.action || scene.visualDescription || scene.dialogue || "";
  const duration = scene.durationSec ?? 0;
  const hasFrame = sceneFrameReady(scene);
  const ready = sceneVideoReady(scene);
  const creating = sceneVideoCreating(scene);
  const videoSrc = scene.videoUrl || null;
  const progress =
    typeof (scene as any).mediaJobProgress === "number"
      ? Math.max(0, Math.min(100, Math.round((scene as any).mediaJobProgress)))
      : 0;

  const isPortrait = aspectRatio === "9:16";
  // TW2: kích thước box qua style (không dùng aspect utility)
  const previewOuterClass = isPortrait
    ? "shrink-0 mx-auto"
    : "w-full max-w-xs shrink-0 mx-auto";
  const previewOuterStyle: CSSProperties = isPortrait
    ? { width: 140, paddingTop: "174.78%", position: "relative" }
    : { width: "100%", maxWidth: 240, paddingTop: "56.25%", position: "relative" };

  useEffect(() => {
    setIsVideoFrameReady(false);
    setPlayingWithSound(false);
    setIsPlaying(false);
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      setIsVideoFrameReady(true);
    }
  }, [videoSrc]);

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
    const onFs = () => {
      const el = document.fullscreenElement;
      setIsFullscreen(!!el && (el === containerRef.current || !!el?.contains(containerRef.current)));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const markReady = () => setIsVideoFrameReady(true);

  const handleMouseEnter = () => {
    const video = videoRef.current;
    if (!video || !videoSrc || playingWithSound || isFullscreen) return;
    video.muted = true;
    video.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    const video = videoRef.current;
    if (!video || playingWithSound || isFullscreen) return;
    video.pause();
    video.currentTime = 0;
  };

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video || !videoSrc || !isVideoFrameReady) return;
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

  const handleToggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video || !videoSrc) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
        video.muted = false;
        setPlayingWithSound(true);
        await video.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const canUseVideo = !!videoSrc && isVideoFrameReady;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:border-primary">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-10 font-bold bg-gray-800 text-white flex-shrink-0">
          {t("Cảnh")} {indexLabel}
        </span>
        <span className="text-xs font-semibold text-gray-800 truncate" title={sceneTitle}>
          {sceneTitle}
        </span>
        {duration > 0 && (
          <span className="ml-auto text-10 font-medium text-gray-400 flex-shrink-0">{duration}s</span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center justify-center gap-2 min-h-0">
          {ready && videoSrc ? (
            <div className="flex flex-col gap-1.5 items-center w-full">
              <div
                ref={containerRef}
                className={`rounded-md overflow-hidden border-2 border-purple-300 shadow-sm bg-black ${previewOuterClass} ${
                  isFullscreen ? "flex items-center justify-center !w-full !h-full !max-w-none" : ""
                }`}
                style={isFullscreen ? { position: "relative" } : previewOuterStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <video
                  ref={videoRef}
                  key={videoSrc}
                  className={`absolute inset-0 z-0 w-full h-full object-contain ${
                    canUseVideo ? "cursor-pointer" : "pointer-events-none"
                  }`}
                  muted={!playingWithSound && !isFullscreen}
                  loop
                  playsInline
                  preload="auto"
                  onClick={handleTogglePlay}
                  onLoadedMetadata={markReady}
                  onLoadedData={markReady}
                  onCanPlay={markReady}
                  onError={markReady}
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
                {!isPlaying && !isFullscreen && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black bg-opacity-20">
                    <BiPlayCircle className="text-white w-10 h-10 opacity-90" />
                  </div>
                )}
                {!isVideoFrameReady && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-purple-50 bg-opacity-80 pointer-events-none">
                    <RiLoader4Line className="text-2xl text-purple-400 animate-spin" />
                  </div>
                )}
                {canUseVideo && (
                  <div
                    className={`absolute z-20 flex items-center gap-2 ${
                      isFullscreen
                        ? "top-3 right-3"
                        : "inset-x-0 bottom-0 justify-center px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlay();
                      }}
                      title={isPlaying ? t("Tạm dừng") : t("Phát")}
                      className={CONTROL_BTN}
                    >
                      {isPlaying ? <RiPauseFill className="text-base" /> : <RiPlayFill className="text-base" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleFullscreen();
                      }}
                      title={isFullscreen ? t("Thoát toàn màn hình") : t("Toàn màn hình")}
                      className={CONTROL_BTN}
                    >
                      {isFullscreen ? (
                        <RiFullscreenExitLine className="text-base" />
                      ) : (
                        <RiFullscreenLine className="text-base" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-row gap-1.5 items-center justify-center">
                {creating ? (
                  <SceneMediaGenerationProgress
                    variant="video"
                    progress={progress || 5}
                    layout="compact"
                    actionPending={generationActionPending}
                    onStop={onStopVideo ? () => onStopVideo(scene) : undefined}
                  />
                ) : (
                  <Button
                    onClick={() => onCreateVideo?.(scene)}
                    icon={<AiOutlineReload />}
                    placement="bottom"
                    className="w-8 h-8 rounded-lg bg-orange-light text-orange"
                    iconClassName="text-xl font-bold"
                    tooltip={t("Tạo lại")}
                  />
                )}
              </div>
            </div>
          ) : ready && !videoSrc ? (
            /* ready giả (mock) — preview khung hình + nút tạo lại */
            <div className="flex flex-col gap-1.5 items-center w-full">
              <div
                className={`rounded-md overflow-hidden border-2 border-purple-300 shadow-sm bg-black ${previewOuterClass}`}
                style={previewOuterStyle}
              >
                {scene.frameImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scene.frameImageUrl}
                    alt={sceneTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-purple-50">
                    <RiVideoFill className="text-purple-400 text-xl" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <BiPlayCircle className="text-white w-10 h-10 opacity-90 drop-shadow" />
                </div>
              </div>
              <Button
                onClick={() => onCreateVideo?.(scene)}
                icon={<AiOutlineReload />}
                placement="bottom"
                className="w-8 h-8 rounded-lg bg-orange-light text-orange"
                iconClassName="text-xl font-bold"
                tooltip={t("Tạo lại")}
              />
            </div>
          ) : creating ? (
            <SceneMediaGenerationProgress
              variant="video"
              progress={progress || 5}
              layout="card"
              actionPending={generationActionPending}
              onStop={onStopVideo ? () => onStopVideo(scene) : undefined}
            />
          ) : (
            <button
              type="button"
              onClick={() => onCreateVideo?.(scene)}
              className="relative w-full max-w-xs h-20 rounded-xl border-2 border-dashed transition-all group border-gray-200 hover:bg-purple-50 bg-gray-50 hover:border-purple-200 cursor-pointer text-purple-500"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AiOutlineVideoCamera className="text-xl mb-0.5 text-gray-300 group-hover:text-purple-400" />
                <span className="text-xs font-medium text-gray-400 group-hover:text-purple-500">
                  {t("Tạo video đơn")}
                </span>
                {!hasFrame && (
                  <span className="text-10 text-gray-300 mt-0.5">{t("Nên có khung hình trước")}</span>
                )}
              </div>
            </button>
          )}
        </div>

        <SceneMediaError message={scene.videoError} />

        {description ? (
          <p className="text-xs text-gray-500 m-0 line-clamp-2 leading-relaxed" title={description}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
