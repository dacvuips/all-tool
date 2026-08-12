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
import { CopyVideoScene } from "../../constants";
import { resolveObjectToPersonifyImageForApi } from "../../elements/utils/elementFormImageUtils";
import { useConcurrencyLimits } from "../../hook/useConcurrencyLimits";
import { useSceneMediaGenerationActions } from "../../hook/useSceneMediaGenerationActions";
import {
  buildCopyVideoImageGenerateParams,
  buildCopyVideoVideoGenerateParams,
} from "../utils/copyVideoSceneGenerationParams";
import { downloadGeneratedVideo, downloadSceneImage, hasGeneratedImageData, hasPendingGeneratedVideoBase64, resumePendingGeneratedImageBinary, resumePendingGeneratedVideoBase64, toUiGeneratedImage, toUiGeneratedVideo } from "../../shared/generatedMediaUtils";
import { useGeneratedMediaReplaceReload } from "../../shared/useGeneratedMediaReplaceReload";

import { useCopyVideoContext } from "../providers/copy-video-provider";
import { GeneratedImageData, GeneratedVideoData, useCopyVideoApi } from "./useCopyVideoApi";

// ── Params ─────────────────────────────────────────────────────────────────

interface UseSceneMediaParams {
  /** Scene hiện tại */
  scene: CopyVideoScene;
  nextSceneId?: string;
  /** Ảnh gốc (data URL) dùng làm tham chiếu khi tạo ảnh AI */
  thumbnailOriginImage?: string | null;
  /** Danh sách URL ảnh sản phẩm được chọn cho scene này */
  selectedProductImages?: string[];
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

  handleStopImageGeneration: () => Promise<void>;
  handleRetryImageGeneration: () => void;
  imageCanRetry: boolean;
  imageActionPending: boolean;

  handleStopVideoGeneration: () => Promise<void>;
  handleRetryVideoGeneration: () => void;
  videoCanRetry: boolean;
  videoActionPending: boolean;

  handleStopExtendVideoGeneration: () => Promise<void>;
  handleRetryExtendVideoGeneration: () => void;
  extendCanRetry: boolean;
  extendActionPending: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCopyVideoSceneMedia({
  scene,
  nextSceneId,
  thumbnailOriginImage,
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

  const {
    copyVideoGenerateImage,
    getGeneratedImage,
    saveGeneratedImage,
    generateVideo,
    saveGeneratedVideo,
    getGeneratedVideo,
    cancelImageJob,
    cancelVideoJob,
  } = useCopyVideoApi();
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
    subscribeSceneProgress,
    registerSceneJob,
    getSceneJob,
    scriptData,
    copyVideoFormConfig,
  } = useCopyVideoContext();

  const reportVideoError = useCallback(
    (message: string) => {
      setVideoError(message);
      reportSceneError?.(scene.id, "video", message);
    },
    [scene.id, reportSceneError]
  );

  const generateImageRef = useRef<() => Promise<void>>(async () => undefined);
  const generateVideoRef = useRef<(isStitch?: boolean) => Promise<void>>(async () => undefined);

  const imageGenActions = useSceneMediaGenerationActions({
    sceneId: scene.id,
    kind: "image",
    cancelJob: cancelImageJob,
    registerSceneJob,
    getSceneJob,
    onStopCleanup: () => {
      removeBatchGeneratingSceneId(scene.id);
      setGeneratingImage(false);
      setImageProgress(0);
    },
    reportError: (message) => {
      setImageError(message);
      reportSceneError?.(scene.id, "image", message);
    },
    onRetry: () => {
      void generateImageRef.current();
    },
  });

  const videoGenActions = useSceneMediaGenerationActions({
    sceneId: scene.id,
    kind: "video",
    cancelJob: cancelVideoJob,
    registerSceneJob,
    getSceneJob,
    onStopCleanup: () => {
      removeBatchGeneratingVideoSceneId(scene.id);
      setGeneratingVideo(false);
      setVideoProgress(0);
      setVideoStatusMessage("");
    },
    reportError: (message) => {
      setVideoError(message);
      reportSceneError?.(scene.id, "video", message);
    },
    onRetry: () => {
      void generateVideoRef.current(false);
    },
  });

  const extendGenActions = useSceneMediaGenerationActions({
    sceneId: scene.id + "::stitch",
    kind: "extend",
    cancelJob: cancelVideoJob,
    registerSceneJob,
    getSceneJob,
    onStopCleanup: () => {
      removeBatchGeneratingVideoSceneId(scene.id + "::stitch");
      setGeneratingExtendVideo(false);
      setExtendVideoProgress(0);
    },
    reportError: (message) => {
      setExtendVideoError(message);
      reportSceneError?.(scene.id + "::stitch", "extend", message);
    },
    onRetry: () => {
      void generateVideoRef.current(true);
    },
  });

  const objectToPersonifyImage = resolveObjectToPersonifyImageForApi({
    objectToPersonify: copyVideoFormConfig?.objectToPersonify,
    objectToPersonifyCode: copyVideoFormConfig?.objectToPersonifyCode,
    fallbackImage:
      scriptData?.objectToPersonifyImage ?? copyVideoFormConfig?.objectToPersonifyImage,
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

  const isGeneratingImage = generatingImage || isBatchGenerating;
  const isGeneratingVideo = generatingVideo || isBatchGeneratingVideo;
  const isGeneratingExtendVideo = generatingExtendVideo || isBatchGeneratingExtendVideo;

  useEffect(() => {
    if (!subscribeSceneProgress) return;
    const unsub = subscribeSceneProgress(scene.id, (progress) => {
      if (progress.image != null) {
        setImageProgress((prev) => Math.max(prev, progress.image!));
      }
      if (progress.video != null) {
        setVideoProgress((prev) => Math.max(prev, progress.video!));
      }
      if (progress.extend != null) {
        setExtendVideoProgress((prev) => Math.max(prev, progress.extend!));
      }
    });
    return unsub;
  }, [scene.id, subscribeSceneProgress]);

  useEffect(() => {
    if (isBatchGenerating && !generatingImage) {
      setImageProgress(0);
    } else if (!isBatchGenerating && !generatingImage) {
      setImageProgress(0);
    }
  }, [isBatchGenerating, generatingImage]);

  useEffect(() => {
    if (isBatchGeneratingVideo && !generatingVideo) {
      setVideoProgress(0);
    } else if (!isBatchGeneratingVideo && !generatingVideo) {
      setVideoProgress(0);
    }
  }, [isBatchGeneratingVideo, generatingVideo]);

  useEffect(() => {
    if (isBatchGeneratingExtendVideo && !generatingExtendVideo) {
      setExtendVideoProgress(0);
    } else if (!isBatchGeneratingExtendVideo && !generatingExtendVideo) {
      setExtendVideoProgress(0);
    }
  }, [isBatchGeneratingExtendVideo, generatingExtendVideo]);

  useEffect(() => {
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
    imageGenActions.setCanRetry(false);
    videoGenActions.setCanRetry(false);
    extendGenActions.setCanRetry(false);
  }, [scene.id]);

  // // ── Load ảnh đã tạo trước đó từ IndexedDB ──
  // // Re-check whenever batch generating state changes (image may have been saved)
  useEffect(() => {
    getGeneratedImage(scene.id).then(async (img) => {
      if (!img) return;
      await resumePendingGeneratedImageBinary<GeneratedImageData>(
        scene.id,
        img,
        { set: saveGeneratedImage },
        { onUpdate: (data) => setGeneratedImage(data) }
      );
    });
  }, [scene.id, isBatchGenerating, getGeneratedImage, saveGeneratedImage]);

  // // ── Load ảnh của scene kế tiếp từ IndexedDB ──
  useEffect(() => {
    if (nextSceneId) {
      getGeneratedImage(nextSceneId).then((img) => {
        if (img) setNextGeneratedImage(toUiGeneratedImage(img));
        else setNextGeneratedImage(null);
      });
    } else {
      setNextGeneratedImage(null);
    }
  }, [nextSceneId, isBatchGenerating, getGeneratedImage]);

  // ── Load video đã tạo trước đó từ IndexedDB ──
  // Re-check whenever batch video generating state changes (video may have been saved)
  useEffect(() => {
    getGeneratedVideo(scene.id).then(async (vid) => {
      if (!vid) return;
      setGeneratedVideo(toUiGeneratedVideo(vid));
      if (!hasPendingGeneratedVideoBase64(vid)) return;
      await resumePendingGeneratedVideoBase64<GeneratedVideoData>(scene.id, vid, { set: saveGeneratedVideo }, {
        onUpdate: (data) => setGeneratedVideo(data),
      });
    });
  }, [scene.id, isBatchGeneratingVideo, getGeneratedVideo, saveGeneratedVideo]);

  // ── Load video nối (stitch) đã tạo trước đó từ IndexedDB ──
  useEffect(() => {
    const stitchId = scene.id + "::stitch";
    getGeneratedVideo(stitchId).then(async (vid) => {
      if (!vid) return;
      setGeneratedExtendVideo(toUiGeneratedVideo(vid));
      if (!hasPendingGeneratedVideoBase64(vid)) return;
      await resumePendingGeneratedVideoBase64<GeneratedVideoData>(stitchId, vid, { set: saveGeneratedVideo }, {
        onUpdate: (data) => setGeneratedExtendVideo(data),
      });
    });
  }, [scene.id, isBatchGeneratingExtendVideo, getGeneratedVideo, saveGeneratedVideo]);

  useGeneratedMediaReplaceReload({
    sceneId: scene.id,
    nextSceneId,
    getGeneratedImage,
    getGeneratedVideo,
    saveGeneratedImage,
    saveGeneratedVideo,
    setGeneratedImage: (data) => setGeneratedImage(data),
    setNextGeneratedImage: (data) => setNextGeneratedImage(data),
    setGeneratedVideo: (data) => setGeneratedVideo(data),
    setGeneratedExtendVideo: (data) => setGeneratedExtendVideo(data),
  });

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
    imageGenActions.setCanRetry(false);
    addBatchGeneratingSceneId(scene.id);

    try {
      const imageParams = await buildCopyVideoImageGenerateParams({
        scene,
        scriptData,
        thumbnailOriginImage,
        selectedProductImages,
        noText,
        objectToPersonifyImage,
      });

      const result = await copyVideoGenerateImage({
        ...imageParams,
        onProgress: (pct) => setImageProgress((prev) => Math.max(prev, pct)),
        onJobEnqueued: imageGenActions.bindJobEnqueued,
        onError: (msg) => {
          setImageError(msg);
          reportSceneError?.(scene.id, "image", msg);
          imageGenActions.setCanRetry(true);
        },
        onMediaUpdate: (data) => {
          setGeneratedImage(data);
          setImageError(null);
          reportSceneError?.(scene.id, "image", null);
        },
      });

      if (result) {
        setGeneratedImage((prev) =>
          prev?.mediaBlob && !result.mediaBlob ? prev : toUiGeneratedImage(result)
        );
        setImageError(null);
        reportSceneError?.(scene.id, "image", null);
        imageGenActions.markGenerationEnded(false);
      } else {
        console.warn("[handleGenerateImage] No result returned");
        imageGenActions.markGenerationEnded(true);
      }
    } catch (err) {
      console.error("[handleGenerateImage] Error:", err);
      imageGenActions.markGenerationEnded(true);
    } finally {
      removeBatchGeneratingSceneId(scene.id);
      setGeneratingImage(false);
    }
  };

  generateImageRef.current = handleCopyVideoGenerateImage;

  // ─────────────────────────────────────────────────────────────────────────
  // handleSetImage
  // Set ảnh thủ công (upload từ máy hoặc chọn từ gallery IndexedDB).
  // Lưu vào IndexedDB theo sceneId và cập nhật state.
  // ─────────────────────────────────────────────────────────────────────────
  const handleSetImage = async (imageData: GeneratedImageData) => {
    try {
      await saveGeneratedImage(scene.id, imageData);
      setGeneratedImage(toUiGeneratedImage(imageData));
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
    if (!scene.motion_description) return;

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
      extendGenActions.setCanRetry(false);
      addBatchGeneratingVideoSceneId(scene.id + "::stitch");
    } else {
      setVideoError(null);
      reportSceneError?.(scene.id, "video", null);
      setGeneratingVideo(true);
      setVideoProgress(0);
      setVideoStatusMessage("");
      videoGenActions.setCanRetry(false);
      addBatchGeneratingVideoSceneId(scene.id);
    }

    try {
      // Stitch: đọc lại từ IndexedDB — nextGeneratedImage trong state có thể stale
      // nếu cảnh kế đã gen ảnh sau lần load gần nhất của hook này.
      let stitchStartImage = generatedImage;
      let stitchEndImage = nextGeneratedImage;
      if (isStitch) {
        const [startFromIdb, endFromIdb] = await Promise.all([
          getGeneratedImage(scene.id),
          nextSceneId ? getGeneratedImage(nextSceneId) : Promise.resolve(undefined),
        ]);
        if (startFromIdb) {
          stitchStartImage = toUiGeneratedImage(startFromIdb);
          setGeneratedImage(stitchStartImage);
        }
        if (endFromIdb) {
          stitchEndImage = toUiGeneratedImage(endFromIdb);
          setNextGeneratedImage(stitchEndImage);
        }

        if (!hasGeneratedImageData(stitchStartImage) || !hasGeneratedImageData(stitchEndImage)) {
          const message = t(
            "Không đủ ảnh để tạo video nối, cần ảnh ở cảnh hiện tại và cảnh tiếp theo"
          );
          setExtendVideoError(message);
          reportSceneError?.(scene.id + "::stitch", "extend", message);
          throw new Error("Missing start or end image");
        }
      }

      const videoParams = await buildCopyVideoVideoGenerateParams({
        scene,
        scriptData,
        isStitch,
        generatedImage: isStitch ? stitchStartImage : generatedImage,
        nextGeneratedImage: isStitch ? stitchEndImage : undefined,
      });

      const result = await generateVideo({
        ...videoParams,
        onProgress: (pct) => {
          if (isStitch) {
            setExtendVideoProgress((prev) => Math.max(prev, pct));
          } else {
            setVideoProgress((prev) => Math.max(prev, pct));
          }
        },
        onJobEnqueued: isStitch
          ? extendGenActions.bindJobEnqueued
          : videoGenActions.bindJobEnqueued,
        onStatusMessage: (msg) => {
          if (!isStitch) setVideoStatusMessage(msg);
        },
        onError: (msg) => {
          if (isStitch) {
            setExtendVideoError(msg);
            reportSceneError?.(scene.id + "::stitch", "extend", msg);
            extendGenActions.setCanRetry(true);
          } else {
            setVideoError(msg);
            reportSceneError?.(scene.id, "video", msg);
            videoGenActions.setCanRetry(true);
          }
        },
        onMediaUpdate: (data) => {
          if (isStitch) {
            setGeneratedExtendVideo(data);
            setExtendVideoError(null);
            reportSceneError?.(scene.id + "::stitch", "extend", null);
          } else {
            setGeneratedVideo(data);
            setVideoError(null);
            reportSceneError?.(scene.id, "video", null);
          }
        },
      });
      if (result) {
        if (isStitch) {
          setGeneratedExtendVideo(result);
          setExtendVideoError(null);
          reportSceneError?.(scene.id + "::stitch", "extend", null);
          extendGenActions.markGenerationEnded(false);
        } else {
          setGeneratedVideo(result);
          setVideoError(null);
          reportSceneError?.(scene.id, "video", null);
          videoGenActions.markGenerationEnded(false);
        }
      } else if (isStitch) {
        extendGenActions.markGenerationEnded(true);
      } else {
        videoGenActions.markGenerationEnded(true);
      }
    } catch {
      if (isStitch) {
        extendGenActions.markGenerationEnded(true);
      } else {
        videoGenActions.markGenerationEnded(true);
      }
    } finally {
      if (isStitch) {
        setGeneratingExtendVideo(false);
        removeBatchGeneratingVideoSceneId(scene.id + "::stitch");
      } else {
        removeBatchGeneratingVideoSceneId(scene.id);
        setGeneratingVideo(false);
      }
    }
  };

  generateVideoRef.current = handleGenerateVideo;

  // ─────────────────────────────────────────────────────────────────────────
  // handleDownloadImage
  // Chuyển base64 imageBytes → Blob → tạo URL tạm → trigger download file.
  // Tên file: {sceneNumber} (vd. 1, 2, 3)
  // ─────────────────────────────────────────────────────────────────────────
  const handleDownloadImage = async () => {
    if (!generatedImage) return;
    try {
      await downloadSceneImage(generatedImage, scene.sceneNumber);
    } catch (err) {
      console.error("[handleDownloadImage] Error:", err);
    }
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
      const ext = generatedVideo.mimeType?.split("/")[1] || "mp4";
      await downloadGeneratedVideo(generatedVideo, `scene-${scene.sceneNumber}-video.${ext}`);
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
      const ext = generatedExtendVideo.mimeType?.split("/")[1] || "mp4";
      await downloadGeneratedVideo(
        generatedExtendVideo,
        `scene-${scene.sceneNumber}-stitch-video.${ext}`
      );
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
    handleStopImageGeneration: imageGenActions.handleStop,
    handleRetryImageGeneration: imageGenActions.handleRetry,
    imageCanRetry: imageGenActions.canRetry,
    imageActionPending: imageGenActions.actionPending,
    handleStopVideoGeneration: videoGenActions.handleStop,
    handleRetryVideoGeneration: videoGenActions.handleRetry,
    videoCanRetry: videoGenActions.canRetry,
    videoActionPending: videoGenActions.actionPending,
    handleStopExtendVideoGeneration: extendGenActions.handleStop,
    handleRetryExtendVideoGeneration: extendGenActions.handleRetry,
    extendCanRetry: extendGenActions.canRetry,
    extendActionPending: extendGenActions.actionPending,
  };
}
