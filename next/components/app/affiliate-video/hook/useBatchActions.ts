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
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import { SceneScript, StoryModeTypeEnum } from "../constants";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { useAffiliateVideoApi } from "./useAffiliateVideoApi";

// ─── Concurrency limits ───
export const IMAGE_CONCURRENCY = 2;
export const VIDEO_CONCURRENCY = 2;

export function useBatchActions(scenes: SceneScript[]) {
  const { t } = useTranslation();
  const { generateImage, generateVideo, getGeneratedImage, getGeneratedVideo, generateAudioTTS } =
    useAffiliateVideoApi();
  const {
    scriptData,
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
    affiliateVideoFormConfig,
  } = useAffiliateVideoContext();
  const isPromptToVideo = scriptData.storyModeType === StoryModeTypeEnum.prompt_to_video;
  const toast = useToast();

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

  /** Aggregate voice profile from scriptData (voiceGender · voiceTone · voiceStyle) */
  const audioExportText = useMemo(() => {
    if (!scriptData) return "";
    return [scriptData.voiceGender, scriptData.voiceTone, scriptData.voiceStyle]
      .filter(Boolean)
      .join(" · ");
  }, [scriptData]);

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
  // ── Count scenes without generated image & scenes with generated image ──
  // ═══════════════════════════════════════════════════════════════════
  const [pendingImageCount, setPendingImageCount] = useState<number | null>(null);
  const [availableImageCount, setAvailableImageCount] = useState<number>(0);

  useEffect(() => {
    if (batchRunning) return;
    let cancelled = false;
    (async () => {
      const eligible = scenes.filter((s) => !s.disabled && s.imageGenPrompt);
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
      const eligible = scenes.filter((s) => !s.disabled && s.motionPrompt);
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
          // image_to_video mode: count as pending if it has a generated image OR an imageGenPrompt
          const img = await getGeneratedImage(scene.id);
          if (img || scene.imageGenPrompt) pending++;
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
      // Find scenes that have a generated video (eligible for chaining)
      const scenesWithVideo: SceneScript[] = [];
      for (const scene of scenes.filter((s) => !s.disabled)) {
        const vid = await getGeneratedVideo(scene.id);
        if (vid) scenesWithVideo.push(scene);
      }

      if (scenesWithVideo.length < 2) {
        if (!cancelled) {
          setPendingExtendCount(0);
          setAvailableExtendCount(0);
        }
        return;
      }

      // Chain is complete if the LAST scene has an extended video
      const lastScene = scenesWithVideo[scenesWithVideo.length - 1];

      if (!cancelled) {
        // Chain chưa hoàn thành → cần N-1 bước nối
        setPendingExtendCount(scenesWithVideo.length - 1);
        setAvailableExtendCount(0);
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

  // ═══════════════════════════════════════════════════════════════════
  // ── handleDownloadAllImages: collect all generated images → ZIP → download ──
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadAllImages = useCallback(async () => {
    if (downloading || batchRunning) return;
    setDownloading(true);

    try {
      const eligibleScenes = scenes.filter((s) => !s.disabled);
      const zip = new JSZip();
      let count = 0;

      for (const scene of eligibleScenes) {
        const img = await getGeneratedImage(scene.id);
        if (!img) continue;

        // Decode base64 → binary
        const byteChars = atob(img.imageBytes);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }

        const ext = img.mimeType.split("/")[1] || "png";
        const fileName = `scene-${scene.sceneNumber}-image.${ext}`;
        zip.file(fileName, byteNumbers);
        count++;
      }

      if (count === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        setDownloading(false);
        return;
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(blob, `batch-images-${timestamp}.zip`);
      toast.success(`${t("Đã tải")} ${count} ${t("ảnh thành công!")}`);
    } catch (err) {
      console.error("[handleDownloadAllImages] Error:", err);
      toast.error(t("Lỗi khi tải ảnh hàng loạt"));
    } finally {
      setDownloading(false);
    }
  }, [downloading, batchRunning, scenes, getGeneratedImage, toast, t]);

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
        if (!scene.imageGenPrompt) {
          skipped++;
          setBatchSkipped(skipped);
          completed++;
          setBatchCompleted(completed);
          continue;
        }

        try {
          addBatchGeneratingSceneId(scene.id);
          await generateImage({
            sceneId: scene.id,
            prompt: scene.imageGenPrompt,
            aspectRatio: affiliateVideoFormConfig?.aspectRatio,
          });
          completed++;
          setBatchCompleted(completed);
        } catch (err) {
          console.error(`[BatchCreateAllImage] Scene #${scene.sceneNumber} error:`, err);
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

    // Filter: not disabled, has motionPrompt
    const eligibleScenes = scenes.filter((s) => !s.disabled && s.motionPrompt);
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

        // ── prompt_to_video mode: generate video directly from prompt (no image needed) ──
        if (isPromptToVideo) {
          try {
            addBatchGeneratingVideoSceneId(scene.id);
            const audioDesc = [
              scriptData?.voiceGender,
              scriptData?.voiceStyle,
              scriptData?.voiceTone,
            ]
              .filter(Boolean)
              .join(", ");
            await generateVideo({
              sceneId: scene.id,
              prompt: scene.voiceDisable
                ? `[MOTION]${scene.motionPrompt}`
                : `[MOTION]${scene.motionPrompt}, [AUDIO]${audioDesc}, [DIALOGUE]${scene.dialogue}`,
              aspectRatio: affiliateVideoFormConfig?.aspectRatio,
            });
            completed++;
            setVideoBatchCompleted(completed);
          } catch (err) {
            console.error(`[BatchCreateAllVideo] Scene #${scene.sceneNumber} error:`, err);
            errors++;
            setVideoBatchErrors(errors);
            completed++;
            setVideoBatchCompleted(completed);
          } finally {
            removeBatchGeneratingVideoSceneId(scene.id);
          }
          continue;
        }

        // ── image_to_video mode: need image first ──
        // If scene has no generated image, try to generate one first
        let existingImage = await getGeneratedImage(scene.id);
        if (!existingImage) {
          if (!scene.imageGenPrompt) {
            // No image and no prompt to generate one – skip
            skipped++;
            setVideoBatchSkipped(skipped);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          }
          // Generate image first
          try {
            addBatchGeneratingSceneId(scene.id);
            existingImage = await generateImage({
              sceneId: scene.id,
              prompt: scene.imageGenPrompt,
              aspectRatio: affiliateVideoFormConfig?.aspectRatio,
            });
          } catch (imgErr) {
            console.error(
              `[BatchCreateAllVideo] Scene #${scene.sceneNumber} image generation error:`,
              imgErr
            );
            errors++;
            setVideoBatchErrors(errors);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          } finally {
            removeBatchGeneratingSceneId(scene.id);
          }
          if (!existingImage) {
            // Image generation returned nothing – skip video
            errors++;
            setVideoBatchErrors(errors);
            completed++;
            setVideoBatchCompleted(completed);
            continue;
          }
        }

        try {
          addBatchGeneratingVideoSceneId(scene.id);
          const audioDesc = [scriptData?.voiceGender, scriptData?.voiceStyle, scriptData?.voiceTone]
            .filter(Boolean)
            .join(", ");
          await generateVideo({
            sceneId: scene.id,
            prompt: scene.voiceDisable
              ? `[MOTION]${scene.motionPrompt}`
              : `[MOTION]${scene.motionPrompt}, [AUDIO]${audioDesc}, [DIALOGUE]${scene.dialogue}`,
            images: [
              {
                imageBytes: existingImage.imageBytes,
                mimeType: existingImage.mimeType,
              },
            ],
            aspectRatio: affiliateVideoFormConfig?.aspectRatio,
          });
          completed++;
          setVideoBatchCompleted(completed);
        } catch (err) {
          console.error(`[BatchCreateAllVideo] Scene #${scene.sceneNumber} error:`, err);
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
        escapeCSV(s.visualPrompt || ""),
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

    // Counts
    pendingImageCount,
    availableImageCount,
    pendingVideoCount,
    availableVideoCount,
    pendingExtendCount,
    availableExtendCount,

    // Downloads
    downloading,
    downloadingExtended,
    handleDownloadAllImages,

    // Export
    handleExportPromptCSV,
  };
}
