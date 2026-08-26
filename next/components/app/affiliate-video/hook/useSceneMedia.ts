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
import { AffiliateVideoFormConfig, SceneScript, ScriptData } from "../constants";
import { resolveObjectToPersonifyImageForApi } from "../elements/utils/elementFormImageUtils";
import {
  buildAffiliateImageGenerateParams,
  buildAffiliateVideoGenerateParams,
  elementFormImageToGeneratedImage,
  resolveAffiliateVideoReferenceImage,
} from "../shared/affiliateSceneGenerationParams";
import { downloadGeneratedVideo, downloadSceneImage, hasGeneratedImageData, hasPendingGeneratedImageBinary, hasPendingGeneratedVideoBase64, isGeneratedImageReadyForUi, resumePendingGeneratedImageBinary, resumePendingGeneratedVideoBase64, toUiGeneratedImage, toUiGeneratedVideo } from "../shared/generatedMediaUtils";
import { useGeneratedMediaReplaceReload } from "../shared/useGeneratedMediaReplaceReload";

import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { useAffiliateVideoContext } from "../single/providers/affiliate-video-provider";
import { useAffiliateVideoApi } from "./useAffiliateVideoApi";
import { useConcurrencyLimits } from "./useConcurrencyLimits";
import { useSceneMediaGenerationActions } from "./useSceneMediaGenerationActions";
import type { SceneProgressKind } from "./useSceneProgressBroadcast";

// ── Params ─────────────────────────────────────────────────────────────────

/** Context slice từ provider module (storyboard/trending dùng provider riêng, không phải single). */
export type AffiliateVideoProviderSlice = Partial<{
  scriptData: ScriptData | null;
  setScriptData: (data: ScriptData | null) => void;
  affiliateVideoFormConfig: AffiliateVideoFormConfig;
  batchGeneratingSceneIdsRef: React.MutableRefObject<Set<string>>;
  batchGeneratingVideoSceneIdsRef: React.MutableRefObject<Set<string>>;
  addBatchGeneratingSceneId: (id: string) => void;
  removeBatchGeneratingSceneId: (id: string) => void;
  addBatchGeneratingVideoSceneId: (id: string) => void;
  removeBatchGeneratingVideoSceneId: (id: string) => void;
  subscribeBatchState: (
    sceneId: string,
    callback: (generating: boolean, generatingVideo: boolean, generatingExtendVideo: boolean) => void
  ) => () => void;
  subscribeSceneError: (sceneId: string, callback: (errors: any) => void) => () => void;
  getSceneErrors: (sceneId: string) => { image?: string | null; video?: string | null; extend?: string | null };
  reportSceneError: (sceneId: string, kind: any, message: string | null) => void;
  reportSceneProgress?: (
    sceneId: string,
    kind: "image" | "video" | "extend",
    progress: number | null
  ) => void;
  subscribeSceneProgress?: (
    sceneId: string,
    callback: (progress: { image?: number; video?: number; extend?: number }) => void
  ) => () => void;
  registerSceneJob?: (sceneId: string, kind: SceneProgressKind, jobId: string | null) => void;
  getSceneJob?: (sceneId: string, kind: SceneProgressKind) => string | undefined;
}>;

interface UseSceneMediaParams {
  /** Scene hiện tại */
  scene: SceneScript;
  nextSceneId?: string;
  /** Danh sách URL ảnh sản phẩm được chọn cho scene này */
  selectedProductImages?: string[];
  noText?: boolean;
  /** Provider context của module hiện tại (bắt buộc khi không dùng single provider, vd. storyboard) */
  providerContext?: AffiliateVideoProviderSlice;
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

  /** Dừng tạo ảnh đang chạy */
  handleStopImageGeneration: () => Promise<void>;
  /** Tạo lại ảnh sau khi dừng / lỗi */
  handleRetryImageGeneration: () => void;
  /** Có thể tạo lại ảnh (sau dừng) */
  imageCanRetry: boolean;
  imageActionPending: boolean;

  /** Dừng tạo video đơn */
  handleStopVideoGeneration: () => Promise<void>;
  handleRetryVideoGeneration: () => void;
  videoCanRetry: boolean;
  videoActionPending: boolean;

  /** Dừng tạo video nối */
  handleStopExtendVideoGeneration: () => Promise<void>;
  handleRetryExtendVideoGeneration: () => void;
  extendCanRetry: boolean;
  extendActionPending: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSceneMedia({
  scene,
  nextSceneId,
  selectedProductImages,
  noText,
  providerContext,
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

  const { generateImage, getGeneratedImage, saveGeneratedImage, generateVideo, getGeneratedVideo, saveGeneratedVideo, cancelImageJob, cancelVideoJob } =
    useAffiliateVideoApi();
  const singleContext = useAffiliateVideoContext();
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
    scriptData: contextScriptData,
    affiliateVideoFormConfig: contextFormConfig,
  } = { ...singleContext, ...providerContext };

  const scriptData = contextScriptData
    ? {
        ...contextScriptData,
        aspectRatio:
          contextScriptData.aspectRatio ?? providerContext?.affiliateVideoFormConfig?.aspectRatio,
      }
    : null;
  const affiliateVideoFormConfig = providerContext?.affiliateVideoFormConfig ?? contextFormConfig;

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

  // Combined flag: either local generation or batch generation
  const isGeneratingImage = generatingImage || isBatchGenerating;
  const isGeneratingVideo = generatingVideo || isBatchGeneratingVideo;
  const isGeneratingExtendVideo = generatingExtendVideo || isBatchGeneratingExtendVideo;

  // ── Subscribe poll progress broadcast (batch generation) ──
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

  // ── Reset progress when batch starts (background) or when generation ends ──
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

  // ── Reset all local states when scene.id changes ──
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
      // URL remote chưa blob → đẩy vào state để UI giữ loading (không hiện ảnh tạm).
      if (hasPendingGeneratedImageBinary(img) || !isGeneratedImageReadyForUi(img)) {
        setGeneratedImage(toUiGeneratedImage(img));
      }
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

  // ─────────────────────────────────────────────────────────────────────────
  // handleGenerateImage
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
    imageGenActions.setCanRetry(false);
    addBatchGeneratingSceneId(scene.id);

    try {
      const { resolveAudioImageBackgroundElement } = await import(
        "../audio-image-to-video/resolve-start-frame"
      );
      const bg = await resolveAudioImageBackgroundElement(
        affiliateVideoFormConfig?.videoBackgroundImage
      );
      const imageParams = await buildAffiliateImageGenerateParams({
        scene,
        scriptData,
        aspectRatio: affiliateVideoFormConfig?.aspectRatio,
        selectedProductImages,
        noText,
        objectToPersonifyImage,
        artStyle: affiliateVideoFormConfig?.artStyle,
        artStyleId: affiliateVideoFormConfig?.artStyleId,
        backgroundImage: bg,
      });
      if (
        affiliateVideoFormConfig?.useComponentVideo === true &&
        !imageParams.referenceImage?.imageBytes
      ) {
        const message = t("Gen ảnh chưa gắn được base64 ảnh nền");
        setImageError(message);
        reportSceneError?.(scene.id, "image", message);
        throw new Error(message);
      }

      const result = await generateImage({
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
      // Flag gen tắt; nếu chưa có blob thì SceneCard vẫn giữ loading qua !imageReady.
      setGeneratingImage(false);
    }
  };

  generateImageRef.current = handleGenerateImage;

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
      const requireImageBeforeVideo = affiliateVideoFormConfig?.requireImageBeforeVideo === true;

      // Stitch: đọc lại từ IndexedDB — nextGeneratedImage trong state có thể stale
      // nếu cảnh kế đã gen ảnh sau lần load gần nhất của hook này.
      let stitchStartImage = generatedImage;
      let stitchEndImage = nextGeneratedImage;
      if (isStitch) {
        const nextScene = scriptData?.scenes?.find((s) => s.id === nextSceneId);
        const originStart = elementFormImageToGeneratedImage(scene.storyboardCropImage);
        const originEnd = elementFormImageToGeneratedImage(nextScene?.storyboardCropImage);
        const useOriginCrops =
          requireImageBeforeVideo !== true &&
          hasGeneratedImageData(originStart) &&
          hasGeneratedImageData(originEnd);

        if (useOriginCrops) {
          stitchStartImage = originStart;
          stitchEndImage = originEnd;
        } else {
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
        }

        if (!hasGeneratedImageData(stitchStartImage) || !hasGeneratedImageData(stitchEndImage)) {
          const message =
            requireImageBeforeVideo !== true &&
            (scene.storyboardCropImage || nextScene?.storyboardCropImage)
              ? t(
                  "Không đủ ảnh gốc để tạo video nối, cần ảnh gốc ở cảnh hiện tại và cảnh tiếp theo"
                )
              : t("Không đủ ảnh để tạo video nối, cần ảnh ở cảnh hiện tại và cảnh tiếp theo");
          setExtendVideoError(message);
          reportSceneError?.(scene.id + "::stitch", "extend", message);
          throw new Error("Missing start or end image");
        }
      }

      const useComponentVideo =
        !isStitch && affiliateVideoFormConfig?.useComponentVideo === true;

      let videoStartImage = isStitch
        ? stitchStartImage
        : resolveAffiliateVideoReferenceImage(
            scene,
            generatedImage,
            affiliateVideoFormConfig?.requireImageBeforeVideo
          );
      let videoEndImage = isStitch ? stitchEndImage : undefined;

      if (useComponentVideo) {
        const { resolveAudioImageVideoBackground } = await import(
          "../audio-image-to-video/resolve-start-frame"
        );
        try {
          videoStartImage = await resolveAudioImageVideoBackground(
            affiliateVideoFormConfig?.videoBackgroundImage
          );
        } catch (err: any) {
          const message = err?.message || t("Không lấy được ảnh nền video");
          setVideoError(message);
          reportSceneError?.(scene.id, "video", message);
          throw err;
        }
        const endFromState = generatedImage;
        const endFromIdb = await getGeneratedImage(scene.id);
        videoEndImage = hasGeneratedImageData(endFromState)
          ? endFromState
          : endFromIdb
            ? toUiGeneratedImage(endFromIdb)
            : null;
        if (!hasGeneratedImageData(videoEndImage)) {
          const message = t("Chưa có ảnh gen ở tab Ảnh để làm ảnh cuối (tham chiếu thành phần)");
          setVideoError(message);
          reportSceneError?.(scene.id, "video", message);
          throw new Error("Missing end image for component video");
        }
      }

      let drawingHandImage: GeneratedImageData | null = null;
      if (useComponentVideo && affiliateVideoFormConfig?.showDrawingHand === true) {
        try {
          const { resolveDrawingHandVideoReference } = await import(
            "../audio-image-to-video/resolve-start-frame"
          );
          drawingHandImage = await resolveDrawingHandVideoReference();
        } catch (err: any) {
          const message = err?.message || t("Không lấy được ảnh bàn tay tham chiếu");
          setVideoError(message);
          reportSceneError?.(scene.id, "video", message);
          throw err;
        }
      }

      const videoRefImage = videoStartImage;

      const isStoryboardScene =
        !!scene.storyboardCropImage ||
        scene.storyboardSourceIndex != null ||
        !!scene.cropRegion;

      if (
        !isStitch &&
        !useComponentVideo &&
        requireImageBeforeVideo !== true &&
        isStoryboardScene &&
        !hasGeneratedImageData(videoRefImage)
      ) {
        const message = t("Không có ảnh gốc để tạo video");
        setVideoError(message);
        reportSceneError?.(scene.id, "video", message);
        throw new Error("Missing origin image");
      }

      const videoParams = await buildAffiliateVideoGenerateParams({
        scene,
        scriptData,
        aspectRatio: affiliateVideoFormConfig?.aspectRatio,
        isStitch,
        useComponentVideo,
        generatedImage: videoRefImage,
        nextGeneratedImage:
          isStitch || useComponentVideo ? videoEndImage : undefined,
        drawingHandImage,
        requireImageBeforeVideo: affiliateVideoFormConfig?.requireImageBeforeVideo,
        artStyle: affiliateVideoFormConfig?.artStyle,
        artStyleId: affiliateVideoFormConfig?.artStyleId,
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
    handleGenerateImage,
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
