/**
 * useBatchActions.ts
 * Custom hook chứa toàn bộ logic xử lý batch actions:
 * - Batch image generation (create / stop)
 * - Batch video generation (create / stop)
 * - Batch extend video chain (create / stop)
 * - Download images / extended video
 * - Export prompt CSV
 * - Voice export dialog state (dialogue / audio copy, TTS)
 * - Counting pending / available items
 */
import { saveAs } from "file-saver";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { DB_NAME } from "../../constants";
import { ReviewScene } from "../constants";

import { useIndexedDB } from "../../hook/useIndexedDB";
import { THUMBNAIL_KEY_PREFIX } from "../../hook/useVideoThumbnail";
import { useReviewContext } from "../providers/review-provider";
import {
  buildReviewImageGenerateParams,
  buildReviewVideoGenerateParams,
} from "../utils/reviewSceneGenerationParams";
import {
  collectSceneImageFiles,
  collectSceneVideoFiles,
  downloadSceneImagesAsZip,
  downloadSceneImagesSequentially,
  downloadSceneVideosAsZip,
  downloadSceneVideosSequentially,
  handleBatchUpsampleDownloadAction,
  handleBatchUpsampleVideoDownloadAction,
} from "../../shared/batchDownloadMedia";
import {
  collectFailedRetryTasks,
  runBatchRetryWorkerPool,
} from "../../shared/batchRetryFailed";
import { resolveObjectToPersonifyImageForApi } from "../utils/reviewFormImageUtils";
import { useReviewApi } from "./useReviewApi";

// ─── Concurrency limits (fallback defaults) ───
export const DEFAULT_IMAGE_CONCURRENCY = 2;
export const DEFAULT_VIDEO_CONCURRENCY = 2;

function getSceneMotionPrompt(scene: ReviewScene): string {
  return (scene.motionPrompt || "").trim() || (scene.visualPrompt || "").trim();
}

function sceneHasVideoPrompt(scene: ReviewScene): boolean {
  return !!getSceneMotionPrompt(scene);
}

export function useReviewBatchActions(scenes: ReviewScene[]) {
  const { t } = useTranslation();
  const {
    reviewGenerateImage,
    generateVideo,
    getGeneratedImage,
    getGeneratedVideo,
    generateAudioTTS,
  } = useReviewApi();
  const {
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
    reportSceneError,
    reportSceneProgress,
    getSceneErrors,
    scriptData,
    reviewFormConfig,
  } = useReviewContext();

  const objectToPersonifyImage = resolveObjectToPersonifyImageForApi({
    objectToPersonify: reviewFormConfig?.objectToPersonify,
    objectToPersonifyCode: reviewFormConfig?.objectToPersonifyCode,
    objectToPersonifyImage: reviewFormConfig?.objectToPersonifyImage,
    fallbackImage: scriptData?.objectToPersonifyImage,
  });

  // Reviews: tạo video trực tiếp từ prompt, không bắt buộc ảnh trước
  const isPromptToVideo = true;
  const toast = useToast();

  // ─── Lấy concurrency limits từ plan của user ───
  const { customer } = useAuth();
  const IMAGE_CONCURRENCY = customer?.googlePackage?.imageStreamCount || DEFAULT_IMAGE_CONCURRENCY;
  const VIDEO_CONCURRENCY = customer?.googlePackage?.videoStreamCount || DEFAULT_VIDEO_CONCURRENCY;

  // ── IndexedDB for selected product images per scene ──
  const selectedProductImagesDB = useIndexedDB<string[]>("selected-images", DB_NAME.generateReview);
  const thumbnailDB = useIndexedDB<string>("scene-thumbnails", DB_NAME.generateReview);

  const getSceneProductImageUrls = useCallback(
    async (scene: ReviewScene) =>
      (await selectedProductImagesDB.get(scene.id)) ?? scene.selectedProductImages,
    [selectedProductImagesDB]
  );

  const getSceneThumbnailUrl = useCallback(
    async (sceneId: string) => (await thumbnailDB.get(`${THUMBNAIL_KEY_PREFIX}${sceneId}`)) ?? null,
    [thumbnailDB]
  );

  // ═══════════════════════════════════════════════════════════════════
  // ── Voice Export Dialog state ──
  // ═══════════════════════════════════════════════════════════════════
  const [showVoiceExportDialog, setShowVoiceExportDialog] = useState(false);
  const [dialogueCopied, setDialogueCopied] = useState(false);
  const [audioCopied, setAudioCopied] = useState(false);

  /** Aggregate all dialogue from enabled scenes */
  const dialogueExportText = useMemo(() => {
    const eligibleScenes = scenes.filter((s) => !s.disabled);
    if (eligibleScenes.length === 0) return "";
    return eligibleScenes
      .filter((s) => s.dialogue)
      .map((s) => `"${s.dialogue}"`)
      .join("\n");
  }, [scenes]);

  /** Aggregate voice profile – review analysis doesn't have global voice config */
  const audioExportText = useMemo(() => {
    return "";
  }, []);

  const handleCopyDialogue = useCallback(() => {
    navigator.clipboard.writeText(dialogueExportText).then(() => {
      setDialogueCopied(true);
      toast.success(t("Đã sao chép Dialogue!"));
      setTimeout(() => setDialogueCopied(false), 2000);
    });
  }, [dialogueExportText, toast, t]);

  const handleCopyAudio = useCallback(() => {
    navigator.clipboard.writeText(audioExportText).then(() => {
      setAudioCopied(true);
      toast.success(t("Đã sao chép Audio!"));
      setTimeout(() => setAudioCopied(false), 2000);
    });
  }, [audioExportText, toast, t]);

  // ═══════════════════════════════════════════════════════════════════
  // ── TTS Generation state ──
  // ═══════════════════════════════════════════════════════════════════
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsVoiceName, setTtsVoiceName] = useState("Kore");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerateTTS = useCallback(async () => {
    if (ttsGenerating || !dialogueExportText) return;
    setTtsGenerating(true);
    setTtsAudioUrl(null);
    try {
      const cacheKey = `voice-export-${Date.now()}`;
      const audioData = await generateAudioTTS({
        cacheKey,
        text: dialogueExportText,
        voiceName: ttsVoiceName,
        stylePrompt: audioExportText ? `Voice style: ${audioExportText}` : undefined,
      });
      if (audioData?.audioBytes) {
        const dataUrl = `data:${audioData.mimeType};base64,${audioData.audioBytes}`;
        setTtsAudioUrl(dataUrl);
        toast.success(t("Đã tạo giọng AI thành công!"));
      }
    } catch (err) {
      console.error("[TTS] Error:", err);
    } finally {
      setTtsGenerating(false);
    }
  }, [
    ttsGenerating,
    dialogueExportText,
    ttsVoiceName,
    audioExportText,
    generateAudioTTS,
    toast,
    t,
  ]);

  const handleDownloadTTSAudio = useCallback(() => {
    if (!ttsAudioUrl) return;
    const link = document.createElement("a");
    link.href = ttsAudioUrl;
    link.download = `voice-ai-${Date.now()}.wav`;
    link.click();
  }, [ttsAudioUrl]);

  // ═══════════════════════════════════════════════════════════════════
  // ── Batch image generation state ──
  // ═══════════════════════════════════════════════════════════════════
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(-1);
  const [batchCurrentSceneLabel, setBatchCurrentSceneLabel] = useState("");
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [batchErrors, setBatchErrors] = useState(0);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const stopRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════
  // ── Batch video generation state ──
  // ═══════════════════════════════════════════════════════════════════
  const [videoBatchRunning, setVideoBatchRunning] = useState(false);
  const [videoBatchDone, setVideoBatchDone] = useState(false);
  const [videoBatchCurrentIndex, setVideoBatchCurrentIndex] = useState(-1);
  const [videoBatchCurrentSceneLabel, setVideoBatchCurrentSceneLabel] = useState("");
  const [videoBatchTotal, setVideoBatchTotal] = useState(0);
  const [videoBatchCompleted, setVideoBatchCompleted] = useState(0);
  const [videoBatchErrors, setVideoBatchErrors] = useState(0);
  const [videoBatchSkipped, setVideoBatchSkipped] = useState(0);
  const videoStopRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════
  // ── Batch extend (stitch) video generation state ──
  // ═══════════════════════════════════════════════════════════════════
  const [extendBatchRunning, setExtendBatchRunning] = useState(false);
  const [extendBatchDone, setExtendBatchDone] = useState(false);
  const [extendBatchCurrentIndex, setExtendBatchCurrentIndex] = useState(-1);
  const [extendBatchCurrentSceneLabel, setExtendBatchCurrentSceneLabel] = useState("");
  const [extendBatchTotal, setExtendBatchTotal] = useState(0);
  const [extendBatchCompleted, setExtendBatchCompleted] = useState(0);
  const [extendBatchErrors, setExtendBatchErrors] = useState(0);
  const [extendBatchSkipped, setExtendBatchSkipped] = useState(0);
  const extendStopRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════
  // ── Batch retry failed scenes state ──
  // ═══════════════════════════════════════════════════════════════════
  const [retryRunning, setRetryRunning] = useState(false);
  const [retryDone, setRetryDone] = useState(false);
  const [retryCurrentLabel, setRetryCurrentLabel] = useState("");
  const [retryTotal, setRetryTotal] = useState(0);
  const [retryCompleted, setRetryCompleted] = useState(0);
  const [retryErrors, setRetryErrors] = useState(0);
  const retryStopRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════
  // ── Count scenes without generated image & scenes with generated image ──
  // ═══════════════════════════════════════════════════════════════════
  const [pendingImageCount, setPendingImageCount] = useState<number | null>(null);
  const [availableImageCount, setAvailableImageCount] = useState<number>(0);

  useEffect(() => {
    if (batchRunning) return;
    let cancelled = false;
    (async () => {
      const eligible = scenes.filter((s) => !s.disabled && (s.imageGenPrompt || s.visualPrompt));
      let pending = 0;
      let available = 0;
      for (const scene of eligible) {
        const img = await getGeneratedImage(scene.id);
        if (!img) pending++;
        else available++;
      }
      if (!cancelled) {
        setPendingImageCount(pending);
        setAvailableImageCount(available);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenes, batchRunning, getGeneratedImage]);

  // ── Count scenes with generated image but without generated video & scenes with video ──
  const [pendingVideoCount, setPendingVideoCount] = useState<number | null>(null);
  const [availableVideoCount, setAvailableVideoCount] = useState<number>(0);

  useEffect(() => {
    if (videoBatchRunning) return;
    let cancelled = false;
    (async () => {
      const eligible = scenes.filter((s) => !s.disabled && sceneHasVideoPrompt(s));
      let pending = 0;
      let available = 0;
      for (const scene of eligible) {
        const vid = await getGeneratedVideo(scene.id);
        if (vid) {
          available++;
        } else if (isPromptToVideo) {
          // prompt_to_video mode: no image needed, always pending
          pending++;
        } else {
          // image_to_video mode: count as pending if it has a generated image OR an visual_prompt
          const img = await getGeneratedImage(scene.id);
          if (img || scene.imageGenPrompt || scene.visualPrompt) pending++;
        }
      }
      if (!cancelled) {
        setPendingVideoCount(pending);
        setAvailableVideoCount(available);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenes, videoBatchRunning, getGeneratedVideo, getGeneratedImage, isPromptToVideo]);

  // ── Count extend chain status ──
  const [pendingExtendCount, setPendingExtendCount] = useState<number | null>(null);
  const [availableExtendCount, setAvailableExtendCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Match the actual batch logic: pairs from all eligible (non-disabled) scenes
      // The last scene is excluded because it can never be the START of a stitch pair
      const eligibleScenes = scenes.filter((s) => !s.disabled);
      if (eligibleScenes.length < 2) {
        if (!cancelled) {
          setPendingExtendCount(0);
          setAvailableExtendCount(0);
        }
        return;
      }

      let pending = 0;
      let available = 0;
      // Iterate pairs: (scene[0]→scene[1]), (scene[1]→scene[2]), ..., (scene[N-2]→scene[N-1])
      // Last scene (scene[N-1]) is only used as endImage, never as start → excluded
      for (let i = 0; i < eligibleScenes.length - 1; i++) {
        const scene = eligibleScenes[i];
        const existingStitch = await getGeneratedVideo(scene.id + "::stitch");
        if (existingStitch) {
          available++;
        } else {
          pending++;
        }
      }

      if (!cancelled) {
        setPendingExtendCount(pending);
        setAvailableExtendCount(available);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenes, getGeneratedVideo]);

  // ═══════════════════════════════════════════════════════════════════
  // ── Download states ──
  // ═══════════════════════════════════════════════════════════════════
  const [downloadingExtended, setDownloadingExtended] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("");
  const [downloadVideoLabel, setDownloadVideoLabel] = useState("");

  // ═══════════════════════════════════════════════════════════════════
  // ── handleDownloadAllImages / Zip ──
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadAllImages = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);

    try {
      const scenesWithImages = await collectSceneImageFiles(scenes, getGeneratedImage);
      if (scenesWithImages.length === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        return;
      }

      const total = await downloadSceneImagesSequentially(scenesWithImages, (cur, tot) =>
        setDownloadLabel(`${cur}/${tot}`)
      );
      toast.success(`${t("Đã tải")} ${total} ${t("ảnh thành công!")}`);
    } catch (err) {
      console.error("[handleDownloadAllImages] Error:", err);
      toast.error(t("Lỗi khi tải ảnh hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  const handleDownloadAllImagesZip = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);

    try {
      const scenesWithImages = await collectSceneImageFiles(scenes, getGeneratedImage);
      if (scenesWithImages.length === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        return;
      }

      setDownloadLabel(t("Đang nén"));
      await downloadSceneImagesAsZip(scenesWithImages, (cur, tot) =>
        setDownloadLabel(`${cur}/${tot}`)
      );
      toast.success(`${t("Đã tải")} ${scenesWithImages.length} ${t("ảnh trong file ZIP!")}`);
    } catch (err) {
      console.error("[handleDownloadAllImagesZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  const handleDownloadAllImages2k = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);
    try {
      await handleBatchUpsampleDownloadAction({
        scenes,
        getGeneratedImage,
        resolution: "2K",
        asZip: false,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllImages2k] Error:", err);
      toast.error(t("Lỗi khi tải ảnh 2K hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  const handleDownloadAllImages4k = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);
    try {
      await handleBatchUpsampleDownloadAction({
        scenes,
        getGeneratedImage,
        resolution: "4K",
        asZip: false,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllImages4k] Error:", err);
      toast.error(t("Lỗi khi tải ảnh 4K hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  const handleDownloadAllImages2kZip = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);
    try {
      setDownloadLabel(t("Đang nén"));
      await handleBatchUpsampleDownloadAction({
        scenes,
        getGeneratedImage,
        resolution: "2K",
        asZip: true,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllImages2kZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh 2K"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  const handleDownloadAllImages4kZip = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);
    try {
      setDownloadLabel(t("Đang nén"));
      await handleBatchUpsampleDownloadAction({
        scenes,
        getGeneratedImage,
        resolution: "4K",
        asZip: true,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllImages4kZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh 4K"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

  // ═══════════════════════════════════════════════════════════════════
  // ── handleDownloadAllVideos / Zip ──
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadAllVideos = useCallback(async () => {
    if (downloadingVideo || videoBatchRunning) return;
    setDownloadingVideo(true);

    try {
      const scenesWithVideos = await collectSceneVideoFiles(scenes, getGeneratedVideo);
      if (scenesWithVideos.length === 0) {
        toast.warn(t("Chưa có video nào được tạo để tải"));
        return;
      }

      const downloaded = await downloadSceneVideosSequentially(scenesWithVideos, (cur, tot) =>
        setDownloadVideoLabel(`${cur}/${tot}`)
      );

      if (downloaded === 0) {
        toast.warn(t("Không thể tải video nào"));
      } else {
        toast.success(`${t("Đã tải")} ${downloaded} video ${t("thành công!")}`);
      }
    } catch (err) {
      console.error("[handleDownloadAllVideos] Error:", err);
      toast.error(t("Lỗi khi tải video hàng loạt"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, videoBatchRunning, scenes, getGeneratedVideo, toast, t]);

  const handleDownloadAllVideosZip = useCallback(async () => {
    if (downloadingVideo || videoBatchRunning) return;
    setDownloadingVideo(true);

    try {
      const scenesWithVideos = await collectSceneVideoFiles(scenes, getGeneratedVideo);
      if (scenesWithVideos.length === 0) {
        toast.warn(t("Chưa có video nào được tạo để tải"));
        return;
      }

      setDownloadVideoLabel(t("Đang nén"));
      const downloaded = await downloadSceneVideosAsZip(scenesWithVideos, (cur, tot) =>
        setDownloadVideoLabel(`${cur}/${tot}`)
      );

      if (downloaded === 0) {
        toast.warn(t("Không thể tải video nào"));
      } else {
        toast.success(`${t("Đã tải")} ${downloaded} video ${t("trong file ZIP!")}`);
      }
    } catch (err) {
      console.error("[handleDownloadAllVideosZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP video"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, videoBatchRunning, scenes, getGeneratedVideo, toast, t]);

  const handleDownloadAllVideos1080p = useCallback(async () => {
    if (downloadingVideo || videoBatchRunning) return;
    setDownloadingVideo(true);
    try {
      await handleBatchUpsampleVideoDownloadAction({
        scenes,
        getGeneratedVideo,
        asZip: false,
        setDownloadVideoLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllVideos1080p] Error:", err);
      toast.error(t("Lỗi khi tải video 1080p hàng loạt"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, videoBatchRunning, scenes, getGeneratedVideo, toast, t]);

  const handleDownloadAllVideos1080pZip = useCallback(async () => {
    if (downloadingVideo || videoBatchRunning) return;
    setDownloadingVideo(true);
    try {
      setDownloadVideoLabel(t("Đang nén"));
      await handleBatchUpsampleVideoDownloadAction({
        scenes,
        getGeneratedVideo,
        asZip: true,
        setDownloadVideoLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[handleDownloadAllVideos1080pZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP video 1080p"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, videoBatchRunning, scenes, getGeneratedVideo, toast, t]);

  // ═══════════════════════════════════════════════════════════════════
  // ── handleCreateAllImage: worker pool ──
  // ═══════════════════════════════════════════════════════════════════
  const handleCreateAllImage = async () => {
    if (batchRunning) return;

    // Filter out disabled scenes
    const eligibleScenes = scenes.filter((s) => !s.disabled);
    if (eligibleScenes.length === 0) return;

    setBatchRunning(true);
    setBatchTotal(eligibleScenes.length);
    setBatchCompleted(0);
    setBatchErrors(0);
    setBatchSkipped(0);
    setBatchCurrentIndex(0);
    setBatchCurrentSceneLabel("");
    stopRef.current = false;

    let completed = 0;
    let errors = 0;
    let skipped = 0;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        if (stopRef.current) return;

        const idx = nextIndex++;
        if (idx >= eligibleScenes.length) return;

        const scene = eligibleScenes[idx];

        // Skip scenes that already have a generated image
        const existing = await getGeneratedImage(scene.id);
        if (existing) {
          skipped++;
          setBatchSkipped(skipped);
          completed++;
          setBatchCompleted(completed);
          continue;
        }

        // Skip scenes without an image prompt
        if (!(scene.imageGenPrompt || scene.visualPrompt)) {
          skipped++;
          setBatchSkipped(skipped);
          completed++;
          setBatchCompleted(completed);
          continue;
        }

        try {
          addBatchGeneratingSceneId(scene.id);
          reportSceneError?.(scene.id, "image", null);
          const selectedUrls = await getSceneProductImageUrls(scene);
          const thumbnailUrl = await getSceneThumbnailUrl(scene.id);
          const imageParams = await buildReviewImageGenerateParams({
            scene,
            scriptData,
            thumbnailOriginImage: thumbnailUrl,
            selectedProductImages: selectedUrls,
            noText: scene.noText,
            objectToPersonifyImage,
          });
          await reviewGenerateImage({
            ...imageParams,
            onProgress: (pct) => reportSceneProgress?.(scene.id, "image", pct),
            onError: (msg) => reportSceneError?.(scene.id, "image", msg),
          });
          completed++;
          setBatchCompleted(completed);
        } catch (err: any) {
          console.error(`[BatchCreateAllImage] Scene #${scene.sceneNumber} error:`, err);
          reportSceneError?.(scene.id, "image", err?.message || t("Lỗi tạo ảnh"));
          errors++;
          setBatchErrors(errors);
          completed++;
          setBatchCompleted(completed);
        } finally {
          reportSceneProgress?.(scene.id, "image", null);
          removeBatchGeneratingSceneId(scene.id);
        }
      }
    };

    // Start N workers – each independently pulls next scene from queue
    await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, () => worker()));

    setBatchRunning(false);
    setBatchDone(true);
    setBatchCurrentIndex(-1);
    setBatchCurrentSceneLabel("");

    // Toast thông báo kết quả
    const generated = completed - skipped - errors;
    if (stopRef.current) {
      toast.info(
        `${t("Đã dừng. Tạo được")} ${generated} ${t("ảnh")}, ${skipped} ${t(
          "bỏ qua"
        )}, ${errors} ${t("lỗi")}.`
      );
    } else if (errors > 0) {
      toast.warn(
        `${t("Hoàn thành! Tạo được")} ${generated} ${t("ảnh")}, ${skipped} ${t(
          "bỏ qua"
        )}, ${errors} ${t("lỗi")}.`
      );
    } else {
      toast.success(
        `${t("Đã hoàn thành! Tạo được")} ${generated} ${t("ảnh")}${
          skipped > 0 ? `, ${skipped} ${t("bỏ qua")}` : ""
        }.`
      );
    }
  };

  const handleStopBatch = () => {
    stopRef.current = true;
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── handleCreateAllVideo: worker pool ──
  // ═══════════════════════════════════════════════════════════════════
  const handleCreateAllVideo = async () => {
    if (videoBatchRunning || batchRunning) return;

    // Filter: not disabled, có prompt video (motion hoặc visual)
    const eligibleScenes = scenes.filter((s) => !s.disabled && sceneHasVideoPrompt(s));
    if (eligibleScenes.length === 0) return;

    setVideoBatchRunning(true);
    setVideoBatchTotal(eligibleScenes.length);
    setVideoBatchCompleted(0);
    setVideoBatchErrors(0);
    setVideoBatchSkipped(0);
    setVideoBatchCurrentIndex(0);
    setVideoBatchCurrentSceneLabel("");
    videoStopRef.current = false;

    let completed = 0;
    let errors = 0;
    let skipped = 0;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        if (videoStopRef.current) return;

        const idx = nextIndex++;
        if (idx >= eligibleScenes.length) return;

        const scene = eligibleScenes[idx];

        // Skip scenes that already have a generated video
        const existingVideo = await getGeneratedVideo(scene.id);
        if (existingVideo) {
          skipped++;
          setVideoBatchSkipped(skipped);
          completed++;
          setVideoBatchCompleted(completed);
          continue;
        }

        const sceneImage = await getGeneratedImage(scene.id);
        if (!sceneImage) {
          skipped++;
          setVideoBatchSkipped(skipped);
          completed++;
          setVideoBatchCompleted(completed);
          continue;
        }

        try {
          addBatchGeneratingVideoSceneId(scene.id);
          reportSceneError?.(scene.id, "video", null);
          const videoParams = await buildReviewVideoGenerateParams({
            scene,
            scriptData,
            generatedImage: sceneImage,
          });
          await generateVideo({
            ...videoParams,
            onProgress: (pct) => reportSceneProgress?.(scene.id, "video", pct),
            onError: (msg) => reportSceneError?.(scene.id, "video", msg),
          });
          completed++;
          setVideoBatchCompleted(completed);
        } catch (err: any) {
          console.error(`[BatchCreateAllVideo] Scene #${scene.sceneNumber} error:`, err);
          reportSceneError?.(scene.id, "video", err?.message || t("Lỗi tạo video"));
          errors++;
          setVideoBatchErrors(errors);
          completed++;
          setVideoBatchCompleted(completed);
        } finally {
          reportSceneProgress?.(scene.id, "video", null);
          removeBatchGeneratingVideoSceneId(scene.id);
        }
      }
    };

    // Start N workers – each independently pulls next scene from queue
    await Promise.all(Array.from({ length: VIDEO_CONCURRENCY }, () => worker()));

    setVideoBatchRunning(false);
    setVideoBatchDone(true);
    setVideoBatchCurrentIndex(-1);
    setVideoBatchCurrentSceneLabel("");

    const generated = completed - skipped - errors;
    if (videoStopRef.current) {
      toast.info(
        `${t("Đã dừng. Tạo được")} ${generated} video, ${skipped} ${t("bỏ qua")}, ${errors} ${t(
          "lỗi"
        )}.`
      );
    } else if (errors > 0) {
      toast.warn(
        `${t("Hoàn thành! Tạo được")} ${generated} video, ${skipped} ${t("bỏ qua")}, ${errors} ${t(
          "lỗi"
        )}.`
      );
    } else {
      toast.success(
        `${t("Đã hoàn thành! Tạo được")} ${generated} video${
          skipped > 0 ? `, ${skipped} ${t("bỏ qua")}` : ""
        }.`
      );
    }
  };

  const handleStopVideoBatch = () => {
    videoStopRef.current = true;
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── handleCreateAllExtendVideo: batch stitch consecutive scene pairs ──
  // ═══════════════════════════════════════════════════════════════════
  const handleCreateAllExtendVideo = async () => {
    if (extendBatchRunning || videoBatchRunning || batchRunning) return;

    // Eligible scenes: not disabled
    const eligibleScenes = scenes.filter((s) => !s.disabled);
    if (eligibleScenes.length < 2) {
      toast.warn(t("Cần ít nhất 2 cảnh để tạo video nối"));
      return;
    }

    // Build pairs: each pair = (scene[i], scene[i+1]) where both have generated images
    const pairs: { scene: ReviewScene; nextScene: ReviewScene }[] = [];
    for (let i = 0; i < eligibleScenes.length - 1; i++) {
      pairs.push({ scene: eligibleScenes[i], nextScene: eligibleScenes[i + 1] });
    }

    if (pairs.length === 0) return;

    setExtendBatchRunning(true);
    setExtendBatchTotal(pairs.length);
    setExtendBatchCompleted(0);
    setExtendBatchErrors(0);
    setExtendBatchSkipped(0);
    setExtendBatchCurrentIndex(0);
    setExtendBatchCurrentSceneLabel("");
    extendStopRef.current = false;

    let completed = 0;
    let errors = 0;
    let skipped = 0;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        if (extendStopRef.current) return;

        const idx = nextIndex++;
        if (idx >= pairs.length) return;

        const { scene, nextScene } = pairs[idx];
        setExtendBatchCurrentIndex(idx);
        setExtendBatchCurrentSceneLabel(`#${scene.sceneNumber} → #${nextScene.sceneNumber}`);

        // Skip if stitch video already exists for this scene
        const existingStitch = await getGeneratedVideo(scene.id + "::stitch");
        if (existingStitch) {
          skipped++;
          setExtendBatchSkipped(skipped);
          completed++;
          setExtendBatchCompleted(completed);
          continue;
        }

        // Need both images
        const startImage = await getGeneratedImage(scene.id);
        const endImage = await getGeneratedImage(nextScene.id);

        if (!startImage || !endImage) {
          // Cannot stitch without both images – skip
          skipped++;
          setExtendBatchSkipped(skipped);
          completed++;
          setExtendBatchCompleted(completed);
          continue;
        }

        try {
          addBatchGeneratingVideoSceneId(scene.id + "::stitch");
          reportSceneError?.(scene.id + "::stitch", "extend", null);
          const videoParams = await buildReviewVideoGenerateParams({
            scene,
            scriptData,
            isStitch: true,
            generatedImage: startImage,
            nextGeneratedImage: endImage,
          });
          await generateVideo({
            ...videoParams,
            onProgress: (pct) => reportSceneProgress?.(scene.id + "::stitch", "extend", pct),
            onError: (msg) => reportSceneError?.(scene.id + "::stitch", "extend", msg),
          });
          completed++;
          setExtendBatchCompleted(completed);
        } catch (err: any) {
          console.error(
            `[BatchCreateAllExtendVideo] Scene #${scene.sceneNumber} → #${nextScene.sceneNumber} error:`,
            err
          );
          reportSceneError?.(
            scene.id + "::stitch",
            "extend",
            err?.message || t("Lỗi tạo video nối")
          );
          errors++;
          setExtendBatchErrors(errors);
          completed++;
          setExtendBatchCompleted(completed);
        } finally {
          reportSceneProgress?.(scene.id + "::stitch", "extend", null);
          removeBatchGeneratingVideoSceneId(scene.id + "::stitch");
        }
      }
    };

    // Start N workers
    await Promise.all(Array.from({ length: VIDEO_CONCURRENCY }, () => worker()));

    setExtendBatchRunning(false);
    setExtendBatchDone(true);
    setExtendBatchCurrentIndex(-1);
    setExtendBatchCurrentSceneLabel("");

    const generated = completed - skipped - errors;
    if (extendStopRef.current) {
      toast.info(
        `${t("Đã dừng. Tạo được")} ${generated} video nối, ${skipped} ${t("bỏ qua")}, ${errors} ${t(
          "lỗi"
        )}.`
      );
    } else if (errors > 0) {
      toast.warn(
        `${t("Hoàn thành! Tạo được")} ${generated} video nối, ${skipped} ${t(
          "bỏ qua"
        )}, ${errors} ${t("lỗi")}.`
      );
    } else {
      toast.success(
        `${t("Đã hoàn thành! Tạo được")} ${generated} video nối${
          skipped > 0 ? `, ${skipped} ${t("bỏ qua")}` : ""
        }.`
      );
    }
  };

  const handleStopExtendBatch = () => {
    extendStopRef.current = true;
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── handleRetryAllFailed: chạy lại các phân cảnh đang hiển thị lỗi ──
  // ═══════════════════════════════════════════════════════════════════
  const handleRetryAllFailed = async () => {
    if (retryRunning || batchRunning || videoBatchRunning || extendBatchRunning) return;
    if (!getSceneErrors) {
      toast.warn(t("Không thể đọc trạng thái lỗi"));
      return;
    }

    const tasks = collectFailedRetryTasks(scenes, getSceneErrors);
    if (tasks.length === 0) {
      toast.warn(t("Không có phân cảnh lỗi nào"));
      return;
    }

    setRetryRunning(true);
    setRetryDone(false);
    retryStopRef.current = false;

    const result = await runBatchRetryWorkerPool({
      tasks,
      concurrency: Math.max(IMAGE_CONCURRENCY, VIDEO_CONCURRENCY),
      stopRef: retryStopRef,
      progress: {
        setTotal: setRetryTotal,
        setCompleted: setRetryCompleted,
        setErrors: setRetryErrors,
        setCurrentLabel: setRetryCurrentLabel,
      },
      getTaskLabel: (task) => {
        const scene = task.scene;
        if (task.kind === "extend" && task.nextScene) {
          return `#${scene.sceneNumber} → #${task.nextScene.sceneNumber} (${task.kind})`;
        }
        return `#${scene.sceneNumber} (${task.kind})`;
      },
      executeTask: async (task) => {
        const scene = task.scene;
        if (task.kind === "image") {
          if (!(scene.imageGenPrompt || scene.visualPrompt)) return false;
          try {
            addBatchGeneratingSceneId(scene.id);
            reportSceneError?.(scene.id, "image", null);
            const selectedUrls = await getSceneProductImageUrls(scene);
            const thumbnailUrl = await getSceneThumbnailUrl(scene.id);
            const imageParams = await buildReviewImageGenerateParams({
              scene,
              scriptData,
              thumbnailOriginImage: thumbnailUrl,
              selectedProductImages: selectedUrls,
              noText: scene.noText,
              objectToPersonifyImage,
            });
            await reviewGenerateImage({
              ...imageParams,
              onProgress: (pct) => reportSceneProgress?.(scene.id, "image", pct),
              onError: (msg) => reportSceneError?.(scene.id, "image", msg),
            });
            return true;
          } catch (err: any) {
            reportSceneError?.(scene.id, "image", err?.message || t("Lỗi tạo ảnh"));
            return false;
          } finally {
            reportSceneProgress?.(scene.id, "image", null);
            removeBatchGeneratingSceneId(scene.id);
          }
        }

        if (task.kind === "video") {
          if (!sceneHasVideoPrompt(scene)) return false;
          const sceneImage = await getGeneratedImage(scene.id);
          if (!sceneImage) return false;
          try {
            addBatchGeneratingVideoSceneId(scene.id);
            reportSceneError?.(scene.id, "video", null);
            const videoParams = await buildReviewVideoGenerateParams({
              scene,
              scriptData,
              generatedImage: sceneImage,
            });
            await generateVideo({
              ...videoParams,
              onProgress: (pct) => reportSceneProgress?.(scene.id, "video", pct),
              onError: (msg) => reportSceneError?.(scene.id, "video", msg),
            });
            return true;
          } catch (err: any) {
            reportSceneError?.(scene.id, "video", err?.message || t("Lỗi tạo video"));
            return false;
          } finally {
            reportSceneProgress?.(scene.id, "video", null);
            removeBatchGeneratingVideoSceneId(scene.id);
          }
        }

        if (task.kind === "extend" && task.nextScene) {
          const nextScene = task.nextScene;
          const startImage = await getGeneratedImage(scene.id);
          const endImage = await getGeneratedImage(nextScene.id);
          if (!startImage || !endImage) return false;
          try {
            addBatchGeneratingVideoSceneId(scene.id + "::stitch");
            reportSceneError?.(scene.id + "::stitch", "extend", null);
            const videoParams = await buildReviewVideoGenerateParams({
              scene,
              scriptData,
              isStitch: true,
              generatedImage: startImage,
              nextGeneratedImage: endImage,
            });
            await generateVideo({
              ...videoParams,
              onProgress: (pct) => reportSceneProgress?.(scene.id + "::stitch", "extend", pct),
              onError: (msg) => reportSceneError?.(scene.id + "::stitch", "extend", msg),
            });
            return true;
          } catch (err: any) {
            reportSceneError?.(
              scene.id + "::stitch",
              "extend",
              err?.message || t("Lỗi tạo video nối")
            );
            return false;
          } finally {
            reportSceneProgress?.(scene.id + "::stitch", "extend", null);
            removeBatchGeneratingVideoSceneId(scene.id + "::stitch");
          }
        }

        return false;
      },
    });

    setRetryRunning(false);
    setRetryDone(true);
    setRetryCurrentLabel("");

    const succeeded = result.completed - result.errors;
    if (result.stopped) {
      toast.info(
        `${t("Đã dừng. Chạy lại thành công")} ${succeeded}/${result.completed}, ${result.errors} ${t("lỗi")}.`
      );
    } else if (result.errors > 0) {
      toast.warn(
        `${t("Hoàn thành! Chạy lại thành công")} ${succeeded}/${result.completed}, ${result.errors} ${t("lỗi")}.`
      );
    } else {
      toast.success(`${t("Đã chạy lại thành công")} ${succeeded} ${t("phân cảnh lỗi")}.`);
    }
  };

  const handleStopRetryBatch = () => {
    retryStopRef.current = true;
  };

  // ── handleExportPromptCSV: xuất danh sách prompt ra file CSV ──
  // ═══════════════════════════════════════════════════════════════════
  const handleExportPromptCSV = useCallback(() => {
    const enabledScenes = scenes.filter((s) => !s.disabled);
    if (enabledScenes.length === 0) {
      toast.warn(t("Không có cảnh nào để xuất"));
      return;
    }

    const headers = [
      t("Cảnh"),
      t("Camera"),
      t("Image Gen Prompt"),
      t("Motion Prompt"),
      t("Dialogue"),
    ];

    const escapeCSV = (val: string) => {
      if (!val) return "";
      // Nếu chứa dấu phẩy, xuống dòng hoặc dấu ngoặc kép → bọc trong ngoặc kép
      if (val.includes(",") || val.includes("\n") || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = enabledScenes.map((s) =>
      [
        String(s.sceneNumber),
        escapeCSV(s.camera || ""),
        escapeCSV(s.imageGenPrompt || ""),
        escapeCSV(s.motionPrompt || ""),
        escapeCSV(s.dialogue || ""),
      ].join(",")
    );

    // BOM UTF-8 để Excel mở đúng tiếng Việt
    const bom = "\uFEFF";
    const csvContent = bom + [headers.map(escapeCSV).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `prompts-${new Date().toISOString().slice(0, 10)}.csv`;
    saveAs(blob, fileName);
    toast.success(t("Đã xuất prompt thành công!"));
  }, [scenes, toast, t]);

  // ═══════════════════════════════════════════════════════════════════
  // ── Return all state & handlers ──
  // ═══════════════════════════════════════════════════════════════════
  return {
    // Voice export dialog
    showVoiceExportDialog,
    setShowVoiceExportDialog,
    dialogueCopied,
    audioCopied,
    dialogueExportText,
    audioExportText,
    handleCopyDialogue,
    handleCopyAudio,

    // TTS
    ttsGenerating,
    ttsAudioUrl,
    ttsVoiceName,
    setTtsVoiceName,
    ttsAudioRef,
    handleGenerateTTS,
    handleDownloadTTSAudio,

    // Batch image generation
    batchRunning,
    batchDone,
    batchCurrentIndex,
    batchCurrentSceneLabel,
    batchTotal,
    batchCompleted,
    batchErrors,
    batchSkipped,
    handleCreateAllImage,
    handleStopBatch,

    // Batch video generation
    videoBatchRunning,
    videoBatchDone,
    videoBatchCurrentIndex,
    videoBatchCurrentSceneLabel,
    videoBatchTotal,
    videoBatchCompleted,
    videoBatchErrors,
    videoBatchSkipped,
    handleCreateAllVideo,
    handleStopVideoBatch,

    // Batch extend video generation
    extendBatchRunning,
    extendBatchDone,
    extendBatchCurrentIndex,
    extendBatchCurrentSceneLabel,
    extendBatchTotal,
    extendBatchCompleted,
    extendBatchErrors,
    extendBatchSkipped,
    handleCreateAllExtendVideo,
    handleStopExtendBatch,

    // Batch retry failed scenes
    retryRunning,
    retryDone,
    retryCurrentLabel,
    retryTotal,
    retryCompleted,
    retryErrors,
    handleRetryAllFailed,
    handleStopRetryBatch,

    // Counts
    pendingImageCount,
    availableImageCount,
    pendingVideoCount,
    availableVideoCount,
    pendingExtendCount,
    availableExtendCount,

    // Downloads
    downloading,
    downloadingVideo,
    downloadLabel,
    downloadVideoLabel,
    downloadingExtended,
    handleDownloadAllImages,
    handleDownloadAllImages2k,
    handleDownloadAllImages4k,
    handleDownloadAllImagesZip,
    handleDownloadAllImages2kZip,
    handleDownloadAllImages4kZip,
    handleDownloadAllVideos,
    handleDownloadAllVideosZip,
    handleDownloadAllVideos1080p,
    handleDownloadAllVideos1080pZip,

    // Export
    handleExportPromptCSV,
  };
}
