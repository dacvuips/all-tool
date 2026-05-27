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
import { CopyVideoScene, DB_NAME } from "../../constants";
import { resolveObjectToPersonifyImageForApi } from "../../elements/utils/elementFormImageUtils";
import { THUMBNAIL_KEY_PREFIX } from "../../hook/useVideoThumbnail";
import {
  buildCopyVideoImageGenerateParams,
  buildCopyVideoVideoGenerateParams,
} from "../utils/copyVideoSceneGenerationParams";

import { useIndexedDB } from "../../hook/useIndexedDB";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { useCopyVideoApi } from "./useCopyVideoApi";

// ─── Concurrency limits (fallback defaults) ───
export const DEFAULT_IMAGE_CONCURRENCY = 2;
export const DEFAULT_VIDEO_CONCURRENCY = 2;

export function useCopyVideoBatchActions(scenes: CopyVideoScene[]) {
  const { t } = useTranslation();
  const {
    copyVideoGenerateImage,
    generateVideo,
    getGeneratedImage,
    getGeneratedVideo,
    generateAudioTTS,
  } = useCopyVideoApi();
  const {
    copyVideoFormConfig,
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
    scriptData,
    reportSceneError,
  } = useCopyVideoContext();
  const objectToPersonifyImage = resolveObjectToPersonifyImageForApi({
    objectToPersonify: copyVideoFormConfig?.objectToPersonify,
    objectToPersonifyCode: copyVideoFormConfig?.objectToPersonifyCode,
    fallbackImage:
      scriptData?.objectToPersonifyImage ?? copyVideoFormConfig?.objectToPersonifyImage,
  });
  // Copy-video mode is always image_to_video (no prompt_to_video)
  const isPromptToVideo = false;
  const toast = useToast();

  // ─── Lấy concurrency limits từ plan của user ───
  const { customer } = useAuth();
  const IMAGE_CONCURRENCY = customer?.googlePackage?.imageStreamCount || DEFAULT_IMAGE_CONCURRENCY;
  const VIDEO_CONCURRENCY = customer?.googlePackage?.videoStreamCount || DEFAULT_VIDEO_CONCURRENCY;

  // ── IndexedDB for selected product images per scene ──
  const selectedProductImagesDB = useIndexedDB<string[]>(
    "selected-product-images",
    DB_NAME.copyVideo
  );
  const thumbnailDB = useIndexedDB<string>("scene-thumbnails", DB_NAME.copyVideo);

  const getSceneProductImageUrls = useCallback(
    async (scene: CopyVideoScene) =>
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
      .filter((s) => s.original_content)
      .map((s) => `"${s.original_content}"`)
      .join("\n");
  }, [scenes]);

  /** Aggregate voice profile – copy-video analysis doesn't have global voice config */
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
  // ── Count scenes without generated image & scenes with generated image ──
  // ═══════════════════════════════════════════════════════════════════
  const [pendingImageCount, setPendingImageCount] = useState<number | null>(null);
  const [availableImageCount, setAvailableImageCount] = useState<number>(0);

  useEffect(() => {
    if (batchRunning) return;
    let cancelled = false;
    (async () => {
      const eligible = scenes.filter((s) => !s.disabled && s.visual_prompt);
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
      const eligible = scenes.filter((s) => !s.disabled && s.motion_description);
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
          if (img || scene.visual_prompt) pending++;
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

  /** Helper: base64 string → Blob */
  const base64ToBlob = useCallback((base64: string, mimeType: string): Blob => {
    const byteChars = atob(base64);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
  }, []);

  /** Helper: download a blob and wait for browser to process it */
  const downloadBlobSequentially = useCallback(
    async (blob: Blob, fileName: string, waitMs: number) => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Wait for browser to fully process this download before continuing
      await new Promise((r) => setTimeout(r, waitMs));

      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    },
    []
  );

  // ═══════════════════════════════════════════════════════════════════
  // ── handleDownloadAllImages: download images sequentially one by one ──
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadAllImages = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);

    try {
      const eligibleScenes = scenes.filter((s) => !s.disabled);

      // Pre-collect scenes that have images
      const scenesWithImages: { scene: typeof eligibleScenes[0]; img: any }[] = [];
      for (const scene of eligibleScenes) {
        const img = await getGeneratedImage(scene.id);
        if (img) scenesWithImages.push({ scene, img });
      }

      if (scenesWithImages.length === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        setDownloading(false);
        setDownloadLabel("");
        return;
      }

      const total = scenesWithImages.length;
      for (let i = 0; i < total; i++) {
        const { scene, img } = scenesWithImages[i];
        setDownloadLabel(`${i + 1}/${total}`);

        const ext = img.mimeType.split("/")[1] || "png";
        const fileName = `scene-${scene.sceneNumber}-image.${ext}`;

        // Convert base64 → Blob → download, then wait 2s before next
        const blob = base64ToBlob(img.imageBytes, img.mimeType);
        await downloadBlobSequentially(blob, fileName, 2000);
      }

      toast.success(`${t("Đã tải")} ${total} ${t("ảnh thành công!")}`);
    } catch (err) {
      console.error("[handleDownloadAllImages] Error:", err);
      toast.error(t("Lỗi khi tải ảnh hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [
    downloading,
    batchRunning,
    scenes,
    getGeneratedImage,
    toast,
    t,
    base64ToBlob,
    downloadBlobSequentially,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // ── handleDownloadAllVideos: download videos sequentially one by one ──
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadAllVideos = useCallback(async () => {
    if (downloadingVideo || videoBatchRunning) return;
    setDownloadingVideo(true);

    try {
      const eligibleScenes = scenes.filter((s) => !s.disabled);

      // Pre-collect scenes that have videos
      const scenesWithVideos: { scene: typeof eligibleScenes[0]; vid: any }[] = [];
      for (const scene of eligibleScenes) {
        const vid = await getGeneratedVideo(scene.id);
        if (vid && (vid.videoUri || vid.videoBytes)) scenesWithVideos.push({ scene, vid });
      }

      if (scenesWithVideos.length === 0) {
        toast.warn(t("Chưa có video nào được tạo để tải"));
        setDownloadingVideo(false);
        setDownloadVideoLabel("");
        return;
      }

      const total = scenesWithVideos.length;
      let downloaded = 0;

      for (let i = 0; i < total; i++) {
        const { scene, vid } = scenesWithVideos[i];
        setDownloadVideoLabel(`${i + 1}/${total}`);

        const ext = vid.mimeType?.split("/")[1] || "mp4";
        const fileName = `scene-${scene.sceneNumber}-video.${ext}`;

        let blob: Blob | null = null;

        if (vid.videoUri) {
          // Fetch entire video content first, then download
          try {
            const res = await fetch(vid.videoUri);
            blob = await res.blob();
          } catch (fetchErr) {
            console.error(
              `[handleDownloadAllVideos] Fetch error scene #${scene.sceneNumber}:`,
              fetchErr
            );
            continue;
          }
        } else if (vid.videoBytes) {
          blob = base64ToBlob(vid.videoBytes, vid.mimeType);
        }

        if (!blob) continue;

        // Download blob and wait 3s before next (videos are larger)
        await downloadBlobSequentially(blob, fileName, 3000);
        downloaded++;
      }

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
  }, [
    downloadingVideo,
    videoBatchRunning,
    scenes,
    getGeneratedVideo,
    toast,
    t,
    base64ToBlob,
    downloadBlobSequentially,
  ]);

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
        if (!scene.visual_prompt) {
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
          const imageParams = await buildCopyVideoImageGenerateParams({
            scene,
            scriptData,
            thumbnailOriginImage: thumbnailUrl,
            selectedProductImages: selectedUrls,
            noText: scene.noText,
            objectToPersonifyImage,
          });
          await copyVideoGenerateImage({
            ...imageParams,
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

    // Filter: not disabled, has motion_description
    const eligibleScenes = scenes.filter((s) => !s.disabled && s.motion_description);
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

        let existingImage = await getGeneratedImage(scene.id);
        if (!existingImage) {
          if (!scene.visual_prompt) {
            skipped++;
            setVideoBatchSkipped(skipped);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          }
          try {
            addBatchGeneratingSceneId(scene.id);
            reportSceneError?.(scene.id, "image", null);
            const selectedUrls = await getSceneProductImageUrls(scene);
            const thumbnailUrl = await getSceneThumbnailUrl(scene.id);
            const imageParams = await buildCopyVideoImageGenerateParams({
              scene,
              scriptData,
              thumbnailOriginImage: thumbnailUrl,
              selectedProductImages: selectedUrls,
              noText: scene.noText,
              objectToPersonifyImage,
            });
            existingImage = await copyVideoGenerateImage({
              ...imageParams,
              onError: (msg) => reportSceneError?.(scene.id, "image", msg),
            });
          } catch (imgErr: any) {
            console.error(
              `[BatchCreateAllVideo] Scene #${scene.sceneNumber} image generation error:`,
              imgErr
            );
            reportSceneError?.(scene.id, "image", imgErr?.message || t("Lỗi tạo ảnh"));
            errors++;
            setVideoBatchErrors(errors);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          } finally {
            removeBatchGeneratingSceneId(scene.id);
          }
          if (!existingImage) {
            errors++;
            setVideoBatchErrors(errors);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          }
        }

        try {
          addBatchGeneratingVideoSceneId(scene.id);
          reportSceneError?.(scene.id, "video", null);
          const videoParams = buildCopyVideoVideoGenerateParams({
            scene,
            scriptData,
            generatedImage: existingImage,
          });
          await generateVideo({
            ...videoParams,
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
    const pairs: { scene: CopyVideoScene; nextScene: CopyVideoScene }[] = [];
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
          const motion_description = scene.motion_description || "smooth transition between scenes";
          const videoParams = buildCopyVideoVideoGenerateParams({
            scene,
            scriptData,
            isStitch: true,
            generatedImage: startImage,
            nextGeneratedImage: endImage,
          });
          await generateVideo({
            ...videoParams,
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
        escapeCSV(s.visual_prompt || ""),
        escapeCSV(s.visual_prompt || ""),
        escapeCSV(s.motion_description || ""),
        escapeCSV(s.original_content || ""),
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
    handleDownloadAllVideos,

    // Export
    handleExportPromptCSV,
  };
}
