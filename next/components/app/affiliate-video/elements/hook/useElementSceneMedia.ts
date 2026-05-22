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
import { CopyVideoScene, ElementFormImage } from "../../constants";
import { useConcurrencyLimits } from "../../hook/useConcurrencyLimits";

import { useElementContext } from "../providers/element-provider";
import {
  productImageUrlsToApiImages,
  resolveElementReferenceImagesForApi,
} from "../utils/elementFormImageUtils";
import { GeneratedImageData, GeneratedVideoData, useElementApi } from "./useElementApi";

// ── Params ─────────────────────────────────────────────────────────────────

interface UseSceneMediaParams {
  /** Scene hiện tại */
  scene: CopyVideoScene;
  nextSceneId?: string;
  /** Ảnh gốc (data URL) dùng làm tham chiếu khi tạo ảnh AI */
  thumbnailOriginImage?: string | null;
  /** Danh sách URL ảnh sản phẩm được chọn cho scene này */
  selectedProductImages?: string[];
  /** 3 ô ảnh tham chiếu đã chọn cho scene này */
  selectedElementImageSlots?: (ElementFormImage | undefined)[];
  /** Bật/tắt text (watermark/chữ) trong ảnh tạo ra */
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
  videoError: string | null;

  // ── Video nối (extend) state ──
  /** Video nối đã tạo */
  generatedExtendVideo: GeneratedVideoData | null;
  /** Đang trong quá trình tạo video nối */
  generatingExtendVideo: boolean;
  /** Tiến trình tạo video nối 0-100 */
  extendVideoProgress: number;
  extendVideoError: string | null;

  /** Ảnh của scene kế tiếp (dùng cho video nối) */
  nextGeneratedImage: GeneratedImageData | null;

  // ── Actions ──
  /** Gọi API tạo ảnh mới từ scene.imageGenPrompt */
  handleCopyVideoGenerateImage: () => Promise<void>;
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
  reportVideoError: (message: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useElementSceneMedia({
  scene,
  nextSceneId,
  thumbnailOriginImage,
  selectedProductImages,
  selectedElementImageSlots,
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

  const reportVideoError = useCallback((message: string) => setVideoError(message), []);

  // ── Refs cho simulated progress timers ──
  const imageProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extendVideoProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    elementGenerateImage,
    getGeneratedImage,
    saveGeneratedImage,
    generateVideo,
    getGeneratedVideo,
  } = useElementApi();
  const {
    batchGeneratingSceneIdsRef,
    batchGeneratingVideoSceneIdsRef,
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
    subscribeBatchState,
    scriptData,
  } = useElementContext();

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
      startSimulatedProgress(setImageProgress, imageProgressTimerRef, 120_000);
    } else if (!isBatchGenerating && !generatingImage && imageProgressTimerRef.current) {
      stopSimulatedProgress(setImageProgress, imageProgressTimerRef);
    }
  }, [isBatchGenerating, generatingImage, startSimulatedProgress, stopSimulatedProgress]);

  useEffect(() => {
    if (isBatchGeneratingVideo && !generatingVideo) {
      setVideoProgress(0);
      startSimulatedProgress(setVideoProgress, videoProgressTimerRef, 300_000);
    } else if (!isBatchGeneratingVideo && !generatingVideo && videoProgressTimerRef.current) {
      stopSimulatedProgress(setVideoProgress, videoProgressTimerRef);
    }
  }, [isBatchGeneratingVideo, generatingVideo, startSimulatedProgress, stopSimulatedProgress]);

  useEffect(() => {
    if (isBatchGeneratingExtendVideo && !generatingExtendVideo) {
      setExtendVideoProgress(0);
      startSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef, 300_000);
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
  const handleCopyVideoGenerateImage = async () => {
    if (generatingImage || !scene.visual_prompt) return;

    // ── Check concurrency limit ──
    const currentImageGenerating = batchGeneratingSceneIdsRef?.current?.size ?? 0;
    if (currentImageGenerating >= IMAGE_CONCURRENCY) {
      setImageError(
        t("Đang tạo ảnh tối đa {{max}} ảnh cùng lúc. Vui lòng chờ hoàn thành.", {
          max: IMAGE_CONCURRENCY,
        })
      );
      return;
    }

    setImageError(null);
    setGeneratingImage(true);
    setImageProgress(0);
    addBatchGeneratingSceneId(scene.id);

    // Bắt đầu giả lập progress (~2 phút)
    startSimulatedProgress(setImageProgress, imageProgressTimerRef, 120_000);

    try {
      // Parse thumbnailOriginImage data URL to extract base64 + mimeType
      let referenceImage: { imageBytes: string; mimeType: string } | undefined;
      if (thumbnailOriginImage) {
        const match = thumbnailOriginImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          referenceImage = { mimeType: match[1], imageBytes: match[2] };
        }
      }

      const additionalImages = await productImageUrlsToApiImages(selectedProductImages);

      const noTextStr = noText
        ? `\nIMPORTANT: Single full-frame image, vertical portrait composition (${scriptData?.aspectRatio} aspect ratio), no collage, no text overlay, no borders.`
        : "";

      const result = await elementGenerateImage({
        sceneId: scene.id,
        prompt: `${scene.visual_prompt}`,
        noText: noText,
        aspectRatio: scriptData?.aspectRatio,
        referenceImage,
        additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
        productImages: selectedProductImages?.length ? selectedProductImages : undefined,
        productImagePrompt: scene.product_image_prompt || undefined,
        onProgress: (pct) => {
          // Nếu server trả progress thật > giả lập thì dùng progress thật
          setImageProgress((prev) => Math.max(prev, pct));
        },
        onError: setImageError,
      });

      if (result) {
        setGeneratedImage(result);
        setImageError(null);
      } else {
        console.warn("[handleGenerateImage] No result returned");
      }
    } catch (err) {
      console.error("[handleGenerateImage] Error:", err);
    } finally {
      stopSimulatedProgress(setImageProgress, imageProgressTimerRef);
      setGeneratingImage(false);
      removeBatchGeneratingSceneId(scene.id);
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
    } catch (err) {
      console.error("[handleSetImage] Error:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleGenerateVideo
  // Gọi API tạo video từ scene.motionPrompt + audio + dialogue.
  // Giả lập progress chạy trong ~5 phút (300s), từ random 1-10% → 99%.
  // Khi API trả kết quả (hoặc SSE progress thật), dừng giả lập và set 100%.
  // ─────────────────────────────────────────────────────────────────────────
  const getVideoMotionPrompt = () =>
    (scene.motion_description || "").trim() || (scene.visual_prompt || "").trim();

  const handleGenerateVideo = async (isStitch?: boolean) => {
    // Chỉ chặn loại video tương ứng, không chặn chéo

    if (isStitch && generatingExtendVideo) return;
    if (!isStitch && generatingVideo) return;

    const motionPrompt = getVideoMotionPrompt();
    if (!motionPrompt) {
      if (isStitch) setExtendVideoError(t("Cần nhập prompt hoặc mô tả chuyển động trước khi tạo video"));
      else setVideoError(t("Cần nhập prompt hoặc mô tả chuyển động trước khi tạo video"));
      return;
    }

    // ── Check concurrency limit ──
    const currentVideoGenerating = batchGeneratingVideoSceneIdsRef?.current?.size ?? 0;
    if (currentVideoGenerating >= VIDEO_CONCURRENCY) {
      const message = t("Đang tạo video tối đa {{max}} video cùng lúc. Vui lòng chờ hoàn thành.", {
        max: VIDEO_CONCURRENCY,
      });
      if (isStitch) setExtendVideoError(message);
      else setVideoError(message);
      return;
    }

    if (isStitch) {
      setExtendVideoError(null);
      setGeneratingExtendVideo(true);
      setExtendVideoProgress(0);
      startSimulatedProgress(setExtendVideoProgress, extendVideoProgressTimerRef, 300_000);
      addBatchGeneratingVideoSceneId(scene.id + "::stitch");
    } else {
      setVideoError(null);
      setGeneratingVideo(true);
      setVideoProgress(0);
      setVideoStatusMessage("");
      startSimulatedProgress(setVideoProgress, videoProgressTimerRef, 300_000);
      addBatchGeneratingVideoSceneId(scene.id);
    }

    try {
      let imagesArray: any[] | undefined = undefined;

      if (isStitch) {
        if (!generatedImage || !nextGeneratedImage) {
          const message = t(
            "Không đủ ảnh để tạo video nối, cần ảnh ở cảnh hiện tại và cảnh tiếp theo"
          );
          setExtendVideoError(message);
          throw new Error("Missing start or end image");
        }
        imagesArray = [
          { imageBytes: generatedImage.imageBytes, mimeType: generatedImage.mimeType },
          { imageBytes: nextGeneratedImage.imageBytes, mimeType: nextGeneratedImage.mimeType },
        ];
      } else {
        const countFilledSlots = (arr?: (ElementFormImage | undefined)[]) =>
          arr?.filter((s) => s && (s.imageBytes || s.fifeUrl)).length ?? 0;
        const slotsForVideo =
          countFilledSlots(selectedElementImageSlots) >=
          countFilledSlots(scene.elementImageSlots)
            ? selectedElementImageSlots
            : scene.elementImageSlots ?? selectedElementImageSlots;

        imagesArray = await resolveElementReferenceImagesForApi({
          urls: selectedProductImages,
          slots: slotsForVideo,
        });
        const filledSlotCount = countFilledSlots(slotsForVideo);
        if (filledSlotCount > 0 && imagesArray.length < filledSlotCount) {
          console.warn(
            `[handleGenerateVideo] Scene ${scene.id}: ${filledSlotCount} ô ảnh đã gắn nhưng chỉ convert được ${imagesArray.length} ảnh gửi API`
          );
        }
      }

      const result = await generateVideo({
        sceneId: isStitch ? scene.id + "::stitch" : scene.id,
        prompt: scene.voiceDisable
          ? `[MOTION]${motionPrompt}`
          : `[MOTION]${motionPrompt}, [AUDIO]${scene.audio_description}, [DIALOGUE]${
              scene.translated_content || scene.original_content
            }`,
        images: imagesArray,
        aspectRatio: scriptData?.aspectRatio,
        onProgress: (pct) => {
          if (isStitch) {
            setExtendVideoProgress((prev) => Math.max(prev, pct));
          } else {
            setVideoProgress((prev) => Math.max(prev, pct));
          }
        },
        onStatusMessage: (msg) => {
          if (!isStitch) setVideoStatusMessage(msg);
        },
        onError: isStitch ? setExtendVideoError : setVideoError,
      });
      if (result) {
        if (isStitch) {
          setGeneratedExtendVideo(result);
          setExtendVideoError(null);
        } else {
          setGeneratedVideo(result);
          setVideoError(null);
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
        setGeneratingVideo(false);
        removeBatchGeneratingVideoSceneId(scene.id);
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
    handleCopyVideoGenerateImage,
    handleSetImage,
    handleGenerateVideo,
    handleDownloadImage,
    handleDownloadVideo,
    handleDownloadExtendVideo,
    reportVideoError,
  };
}
