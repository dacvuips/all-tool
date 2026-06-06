/**
 * useSceneMedia.ts
 * Hook quản lý toàn bộ logic media (ảnh/video) cho mỗi scene:
 * - Load ảnh/video đã tạo từ IndexedDB
 * - Tạo ảnh mới từ AI (gọi API generation-image)
 * - Tạo video mới từ AI (gọi API generation-video, SSE)
 * - Download ảnh đã tạo về máy
 * - Download video đã tạo về máy
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SceneScript } from "../constants";
import { resolveObjectToPersonifyImageForApi } from "../elements/utils/elementFormImageUtils";
import {
  buildAffiliateImageGenerateParams,
  buildAffiliateVideoGenerateParams,
} from "../shared/affiliateSceneGenerationParams";

import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { useAffiliateVideoContext } from "../single/providers/affiliate-video-provider";
import { useAffiliateVideoApi } from "./useAffiliateVideoApi";
import { useConcurrencyLimits } from "./useConcurrencyLimits";

// ── Params ─────────────────────────────────────────────────────────────────

interface UseSceneMediaParams {
  /** Scene hiện tại */
  scene: SceneScript;
  nextSceneId?: string;
  /** Danh sách URL ảnh sản phẩm được chọn cho scene này */
  selectedProductImages?: string[];
  noText?: boolean;
}

// ── Return type ────────────────────────────────────────────────────────────

export interface UseSceneMediaReturn {
  // ── Image state ──
  /** Ảnh đã tạo (hoặc load từ cache) */
  generatedImage: GeneratedImageData | null;
  /** Đang trong quá trình tạo ảnh */
  generatingImage: boolean;
  /** Tiến trình tạo ảnh 0-100 */
  imageProgress: number;
  /** Lỗi tạo ảnh (hiển thị inline trong scene row) */
  imageError: string | null;

  // ── Video đơn state ──
  /** Video đã tạo (hoặc load từ cache) */
  generatedVideo: GeneratedVideoData | null;
  /** Đang trong quá trình tạo video */
  generatingVideo: boolean;
  /** Tiến trình tạo video 0-100 */
  videoProgress: number;
  /** Thông báo trạng thái video (SSE message) */
  videoStatusMessage: string;
  /** Lỗi tạo video đơn (hiển thị inline trong scene row) */
  videoError: string | null;

  // ── Video nối (extend) state ──
  /** Video nối đã tạo */
  generatedExtendVideo: GeneratedVideoData | null;
  /** Đang trong quá trình tạo video nối */
  generatingExtendVideo: boolean;
  /** Tiến trình tạo video nối 0-100 */
  extendVideoProgress: number;
  /** Lỗi tạo video nối (hiển thị inline trong scene row) */
  extendVideoError: string | null;

  /** Ảnh của scene kế tiếp (dùng cho video nối) */
  nextGeneratedImage: GeneratedImageData | null;

  // ── Actions ──
  /** Gọi API tạo ảnh mới từ scene.imageGenPrompt */
  handleGenerateImage: () => Promise<void>;
  /** Set ảnh thủ công (upload từ máy hoặc chọn từ gallery) */
  handleSetImage: (imageData: GeneratedImageData) => Promise<void>;
  /** Gọi API tạo video từ scene.motionPrompt + audio + dialogue */
  handleGenerateVideo: (isStitch?: boolean, isPromptToVideo?: boolean) => Promise<void>;
  /** Download ảnh đã tạo về máy (trigger browser download) */
  handleDownloadImage: () => void;
  /** Download video đã tạo về máy (trigger browser download) */
  handleDownloadVideo: () => Promise<void>;
  /** Download video nối đã tạo về máy (trigger browser download) */
  handleDownloadExtendVideo: () => Promise<void>;
  /** Báo lỗi video inline (vd. chưa có ảnh) */
  reportVideoError: (message: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSceneMedia({
  scene,
  nextSceneId,
  selectedProductImages,
  noText,
}: UseSceneMediaParams): UseSceneMediaReturn {
  const { t } = useTranslation();

  // ── Lấy concurrency limits từ plan của user ───
  const { IMAGE_CONCURRENCY, VIDEO_CONCURRENCY } = useConcurrencyLimits();

  // ── State ──
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageData | null>(null);
  const [nextGeneratedImage, setNextGeneratedImage] = useState<GeneratedImageData | null>(null);

  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusMessage, setVideoStatusMessage] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideoData | null>(null);

  // ── Extend video (video nối) state ──
  const [generatingExtendVideo, setGeneratingExtendVideo] = useState(false);
  const [extendVideoProgress, setExtendVideoProgress] = useState(0);
  const [extendVideoError, setExtendVideoError] = useState<string | null>(null);
  const [generatedExtendVideo, setGeneratedExtendVideo] = useState<GeneratedVideoData | null>(null);

  // ── Refs cho simulated progress timers ──
  const imageProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extendVideoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { generateImage, getGeneratedImage, saveGeneratedImage, generateVideo, getGeneratedVideo } =
    useAffiliateVideoApi();
  const {
    batchGeneratingSceneIdsRef,
    batchGeneratingVideoSceneIdsRef,
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
    subscribeBatchState,
    subscribeSceneError,
    reportSceneError,
    scriptData,
    affiliateVideoFormConfig,
  } = useAffiliateVideoContext();

  const reportVideoError = useCallback(
    (message: string) => {
      setVideoError(message);
      reportSceneError?.(scene.id, "video", message);
    },
    [scene.id, reportSceneError]
  );

  const objectToPersonifyImage = resolveObjectToPersonifyImageForApi({
    objectToPersonify: affiliateVideoFormConfig?.objectToPersonify,
    objectToPersonifyCode: affiliateVideoFormConfig?.objectToPersonifyCode,
    fallbackImage:
      scriptData?.objectToPersonifyImage ?? affiliateVideoFormConfig?.objectToPersonifyImage,
  });

  // ── Per-scene batch state via subscription (only THIS scene re-renders) ──
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchGeneratingVideo, setIsBatchGeneratingVideo] = useState(false);
  const [isBatchGeneratingExtendVideo, setIsBatchGeneratingExtendVideo] = useState(false);

  useEffect(() => {
    if (!subscribeBatchState) return;
    const unsub = subscribeBatchState(scene.id, (img, vid, ext) => {
      setIsBatchGenerating(img);
      setIsBatchGeneratingVideo(vid);
      setIsBatchGeneratingExtendVideo(ext);
    });
    return unsub;
  }, [scene.id, subscribeBatchState]);

  // ── Subscribe inline errors broadcast (batch generation failures) ──
  useEffect(() => {
    if (!subscribeSceneError) return;
    const unsub = subscribeSceneError(scene.id, (errors) => {
      if (errors.image !== undefined) setImageError(errors.image ?? null);
      if (errors.video !== undefined) setVideoError(errors.video ?? null);
      if (errors.extend !== undefined) setExtendVideoError(errors.extend ?? null);
    });
    return unsub;
  }, [scene.id, subscribeSceneError]);

  // // Combined flag: either local generation or batch generation
  const isGeneratingImage = generatingImage || isBatchGenerating;
  const isGeneratingVideo = generatingVideo || isBatchGeneratingVideo;
  const isGeneratingExtendVideo = generatingExtendVideo || isBatchGeneratingExtendVideo;

  // // ── Helper: bắt đầu giả lập progress ──
  // // Chạy từ random 1-10% → tăng dần đến 99% trong khoảng durationMs
  const startSimulatedProgress = useCallback(
    (
      setProgress: (pct: number) => void,
      timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
      durationMs: number
    ) => {
      // Xóa timer cũ nếu có
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const startPct = Math.floor(Math.random() * 10) + 1; // random 1-10%
      setProgress(startPct);

      const intervalMs = 500; // cập nhật mỗi 500ms
      const totalSteps = durationMs / intervalMs;
      const incrementPerStep = (99 - startPct) / totalSteps;
      let current = startPct;

      timerRef.current = setInterval(() => {
        current += incrementPerStep;
        if (current >= 99) {
          current = 99;
          if (timerRef.current) clearInterval(timerRef.current);
        }
        setProgress(Math.floor(current));
      }, intervalMs);
    },
    []
  );

  // // ── Helper: dừng giả lập progress ──
  const stopSimulatedProgress = useCallback(
    (
      setProgress: (pct: number) => void,
      timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
    ) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setProgress(100);
      }
      // Don't call setProgress(100) if no timer was running –
      // doing so would trigger a state update → re-render → effect re-run → infinite loop
    },
    []
  );

  // // ── Cleanup timers khi unmount ──
  useEffect(() => {
    return () => {
      if (imageProgressTimerRef.current) clearInterval(imageProgressTimerRef.current);
      if (videoProgressTimerRef.current) clearInterval(videoProgressTimerRef.current);
      if (extendVideoProgressTimerRef.current) clearInterval(extendVideoProgressTimerRef.current);
    };
  }, []);

  // // ── Reset all local states when scene.id changes ──
  // // This ensures stale loading/progress UI is cleared when switching history items
  useEffect(() => {
    // Stop any running progress timers
    if (imageProgressTimerRef.current) {
      clearInterval(imageProgressTimerRef.current);
      imageProgressTimerRef.current = null;
    }
    if (videoProgressTimerRef.current) {
      clearInterval(videoProgressTimerRef.current);
      videoProgressTimerRef.current = null;
    }
    if (extendVideoProgressTimerRef.current) {
      clearInterval(extendVideoProgressTimerRef.current);
      extendVideoProgressTimerRef.current = null;
    }
    // Reset local generating states
    setGeneratingImage(false);
    setImageProgress(0);
    setGeneratedImage(null);
    setNextGeneratedImage(null);
    setGeneratingVideo(false);
    setVideoProgress(0);
    setVideoStatusMessage("");
    setGeneratedVideo(null);
    setGeneratingExtendVideo(false);
    setExtendVideoProgress(0);
    setGeneratedExtendVideo(null);
  }, [scene.id]);

  // // ── Sync batch generation state with simulated progress ──
  useEffect(() => {
    if (isBatchGenerating && !generatingImage) {
      setImageProgress(0);
      startSimulatedProgress(setImageProgress, imageProgressTimerRef, 600_000);
    } else if (!isBatchGenerating && !generatingImage && imageProgressTimerRef.current) {
      stopSimulatedProgress(setImageProgress, imageProgressTimerRef);
    }
  }, [isBatchGenerating, generatingImage, startSimulatedProgress, stopSimulatedProgress]);

  useEffect(() => {
    if (isBatchGeneratingVideo && !generatingVideo) {
      setVideoProgress(0);
      startSimulatedProgress(setVideoProgress, videoProgressTimerRef, 700_000);
    } else if (!isBatchGeneratingVideo && !generatingVideo && videoProgressTimerRef.current) {
      stopSimulatedProgress(setVideoProgress, videoProgressTimerRef);
    }
  }, [isBatchGeneratingVideo, generatingVideo, startSimulatedProgress, stopSimulatedProgress]);

  useEffect(() => {
    if (isBatchGeneratingExtendVideo && !generatingExtendVideo) {
      setExtendVideoProgress(0);
      startSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef, 700_000);
    } else if (
      !isBatchGeneratingExtendVideo &&
      !generatingExtendVideo &&
      extendVideoProgressTimerRef.current
    ) {
      stopSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef);
    }
  }, [
    isBatchGeneratingExtendVideo,
    generatingExtendVideo,
    startSimulatedProgress,
    stopSimulatedProgress,
  ]);

  // // ── Load ảnh đã tạo trước đó từ IndexedDB ──
  // // Re-check whenever batch generating state changes (image may have been saved)
  useEffect(() => {
    getGeneratedImage(scene.id).then((img) => {
      if (img) setGeneratedImage(img);
    });
  }, [scene.id, isBatchGenerating]);

  // // ── Load ảnh của scene kế tiếp từ IndexedDB ──
  useEffect(() => {
    if (nextSceneId) {
      getGeneratedImage(nextSceneId).then((img) => {
        if (img) setNextGeneratedImage(img);
        else setNextGeneratedImage(null);
      });
    } else {
      setNextGeneratedImage(null);
    }
  }, [nextSceneId, isBatchGenerating]);

  // ── Load video đã tạo trước đó từ IndexedDB ──
  // Re-check whenever batch video generating state changes (video may have been saved)
  useEffect(() => {
    getGeneratedVideo(scene.id).then((vid) => {
      if (vid) setGeneratedVideo(vid);
    });
  }, [scene.id, isBatchGeneratingVideo]);

  // ── Load video nối (stitch) đã tạo trước đó từ IndexedDB ──
  useEffect(() => {
    getGeneratedVideo(scene.id + "::stitch").then((vid) => {
      if (vid) setGeneratedExtendVideo(vid);
    });
  }, [scene.id, isBatchGeneratingExtendVideo]);

  // // ─────────────────────────────────────────────────────────────────────────
  // handleGenerateImage
  // Gọi API tạo ảnh từ scene.imageGenPrompt.
  // Giả lập progress chạy trong ~2 phút (120s), từ random 1-10% → 99%.
  // Khi API trả kết quả, dừng giả lập và set 100%.
  // ─────────────────────────────────────────────────────────────────────────
  const handleGenerateImage = async () => {
    if (generatingImage || !scene.imageGenPrompt) return;

    // ── Check concurrency limit ──
    const currentImageGenerating = batchGeneratingSceneIdsRef?.current?.size ?? 0;
    if (currentImageGenerating >= IMAGE_CONCURRENCY) {
      const message = t("Đang tạo ảnh tối đa {{max}} ảnh cùng lúc. Vui lòng chờ hoàn thành.", {
        max: IMAGE_CONCURRENCY,
      });
      setImageError(message);
      reportSceneError?.(scene.id, "image", message);
      return;
    }

    setImageError(null);
    reportSceneError?.(scene.id, "image", null);
    setGeneratingImage(true);
    setImageProgress(0);
    addBatchGeneratingSceneId(scene.id);

    // Bắt đầu giả lập progress (~2 phút)
    startSimulatedProgress(setImageProgress, imageProgressTimerRef, 600_000);

    try {
      const imageParams = await buildAffiliateImageGenerateParams({
        scene,
        scriptData,
        selectedProductImages,
        noText,
        objectToPersonifyImage,
      });

      const result = await generateImage({
        ...imageParams,
        onError: (msg) => {
          setImageError(msg);
          reportSceneError?.(scene.id, "image", msg);
        },
      });

      if (result) {
        setGeneratedImage(result);
        setImageError(null);
        reportSceneError?.(scene.id, "image", null);
      } else {
        console.warn("[handleGenerateImage] No result returned");
      }
    } catch (err) {
      console.error("[handleGenerateImage] Error:", err);
    } finally {
      stopSimulatedProgress(setImageProgress, imageProgressTimerRef);
      removeBatchGeneratingSceneId(scene.id);
      setGeneratingImage(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleSetImage
  // Set ảnh thủ công (upload từ máy hoặc chọn từ gallery IndexedDB).
  // Lưu vào IndexedDB theo sceneId và cập nhật state.
  // ─────────────────────────────────────────────────────────────────────────
  const handleSetImage = async (imageData: GeneratedImageData) => {
    try {
      await saveGeneratedImage(scene.id, imageData);
      setGeneratedImage(imageData);
      setImageError(null);
      reportSceneError?.(scene.id, "image", null);
    } catch (err: any) {
      console.error("[handleSetImage] Error:", err);
      const message = err?.message || t("Không thể lưu ảnh. Vui lòng thử lại.");
      setImageError(message);
      reportSceneError?.(scene.id, "image", message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleGenerateVideo
  // Gọi API tạo video từ scene.motionPrompt + audio + dialogue.
  // Giả lập progress chạy trong ~5 phút (300s), từ random 1-10% → 99%.
  // Khi API trả kết quả (hoặc SSE progress thật), dừng giả lập và set 100%.
  // ─────────────────────────────────────────────────────────────────────────
  const handleGenerateVideo = async (isStitch?: boolean) => {
    // Chỉ chặn loại video tương ứng, không chặn chéo

    if (isStitch && generatingExtendVideo) return;
    if (!isStitch && generatingVideo) return;
    if (!scene.motionPrompt) return;

    // ── Check concurrency limit ──
    const currentVideoGenerating = batchGeneratingVideoSceneIdsRef?.current?.size ?? 0;
    if (currentVideoGenerating >= VIDEO_CONCURRENCY) {
      const message = t("Đang tạo video tối đa {{max}} video cùng lúc. Vui lòng chờ hoàn thành.", {
        max: VIDEO_CONCURRENCY,
      });
      if (isStitch) {
        setExtendVideoError(message);
        reportSceneError?.(scene.id + "::stitch", "extend", message);
      } else {
        setVideoError(message);
        reportSceneError?.(scene.id, "video", message);
      }
      return;
    }

    if (isStitch) {
      setExtendVideoError(null);
      reportSceneError?.(scene.id + "::stitch", "extend", null);
      setGeneratingExtendVideo(true);
      setExtendVideoProgress(0);
      startSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef, 700_000);
      addBatchGeneratingVideoSceneId(scene.id + "::stitch");
    } else {
      setVideoError(null);
      reportSceneError?.(scene.id, "video", null);
      setGeneratingVideo(true);
      setVideoProgress(0);
      setVideoStatusMessage("");
      startSimulatedProgress(setVideoProgress, videoProgressTimerRef, 700_000);
      addBatchGeneratingVideoSceneId(scene.id);
    }

    try {
      if (isStitch && (!generatedImage || !nextGeneratedImage)) {
        const message = t(
          "Không đủ ảnh để tạo video nối, cần ảnh ở cảnh hiện tại và cảnh tiếp theo"
        );
        setExtendVideoError(message);
        reportSceneError?.(scene.id + "::stitch", "extend", message);
        throw new Error("Missing start or end image");
      }

      const videoParams = buildAffiliateVideoGenerateParams({
        scene,
        scriptData,
        isStitch,
        generatedImage,
        nextGeneratedImage: isStitch ? nextGeneratedImage : undefined,
      });

      const result = await generateVideo({
        ...videoParams,
        onProgress: (pct) => {
          if (isStitch) {
            setExtendVideoProgress((prev) => Math.max(prev, pct));
          }
        },
        onStatusMessage: (msg) => {
          if (!isStitch) setVideoStatusMessage(msg);
        },
        onError: (msg) => {
          if (isStitch) {
            setExtendVideoError(msg);
            reportSceneError?.(scene.id + "::stitch", "extend", msg);
          } else {
            setVideoError(msg);
            reportSceneError?.(scene.id, "video", msg);
          }
        },
      });
      if (result) {
        if (isStitch) {
          setGeneratedExtendVideo(result);
          setExtendVideoError(null);
          reportSceneError?.(scene.id + "::stitch", "extend", null);
        } else {
          setGeneratedVideo(result);
          setVideoError(null);
          reportSceneError?.(scene.id, "video", null);
        }
      }
    } catch {
      // Lỗi đã được set qua onError hoặc validation phía trên
    } finally {
      if (isStitch) {
        stopSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef);
        setGeneratingExtendVideo(false);
        removeBatchGeneratingVideoSceneId(scene.id + "::stitch");
      } else {
        stopSimulatedProgress(setVideoProgress, videoProgressTimerRef);
        removeBatchGeneratingVideoSceneId(scene.id);
        setGeneratingVideo(false);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleDownloadImage
  // Chuyển base64 imageBytes → Blob → tạo URL tạm → trigger download file.
  // Tên file: scene-{sceneNumber}-image.{ext}
  // ─────────────────────────────────────────────────────────────────────────
  const handleDownloadImage = () => {
    if (!generatedImage) return;
    const byteChars = atob(generatedImage.imageBytes);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: generatedImage.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = generatedImage.mimeType.split("/")[1] || "png";
    a.download = `scene-${scene.sceneNumber}-image.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleDownloadVideo
  // Nếu có videoUri → fetch blob rồi download.
  // Nếu có videoBytes (base64) → decode → Blob → download.
  // Tên file: scene-{sceneNumber}-video.{ext}
  // ─────────────────────────────────────────────────────────────────────────
  const handleDownloadVideo = async () => {
    if (!generatedVideo) return;
    try {
      if (generatedVideo.videoUri) {
        // Download từ URI
        const res = await fetch(generatedVideo.videoUri);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scene-${scene.sceneNumber}-video.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (generatedVideo.videoBytes) {
        // Download từ base64
        const byteChars = atob(generatedVideo.videoBytes);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: generatedVideo.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = generatedVideo.mimeType.split("/")[1] || "mp4";
        a.download = `scene-${scene.sceneNumber}-video.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[handleDownloadVideo] Error:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleDownloadExtendVideo
  // Tương tự handleDownloadVideo nhưng cho video nối (extend/stitch).
  // Tên file: scene-{sceneNumber}-stitch-video.{ext}
  // ─────────────────────────────────────────────────────────────────────────
  const handleDownloadExtendVideo = async () => {
    if (!generatedExtendVideo) return;
    try {
      if (generatedExtendVideo.videoUri) {
        const res = await fetch(generatedExtendVideo.videoUri);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scene-${scene.sceneNumber}-stitch-video.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (generatedExtendVideo.videoBytes) {
        const byteChars = atob(generatedExtendVideo.videoBytes);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: generatedExtendVideo.mimeType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = generatedExtendVideo.mimeType.split("/")[1] || "mp4";
        a.download = `scene-${scene.sceneNumber}-stitch-video.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[handleDownloadExtendVideo] Error:", err);
    }
  };

  return {
    // Image
    generatedImage,
    nextGeneratedImage,
    generatingImage: isGeneratingImage,
    imageProgress,
    imageError,
    // Video đơn
    generatedVideo,
    generatingVideo: isGeneratingVideo,
    videoProgress,
    videoStatusMessage,
    videoError,
    // Video nối (extend)
    generatedExtendVideo,
    generatingExtendVideo: isGeneratingExtendVideo,
    extendVideoProgress,
    extendVideoError,
    // Actions
    handleGenerateImage,
    handleSetImage,
    handleGenerateVideo,
    handleDownloadImage,
    handleDownloadVideo,
    handleDownloadExtendVideo,
    reportVideoError,
  };
}
