/**
 * batch-action-bar.tsx
 * BatchActionBar – thanh action buttons trên cùng của Batch List Panel
 * className only – Tailwind CSS, no inline styles
 */
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiCheckLine,
  RiClipboardLine,
  RiCloseLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageFill,
  RiLoader4Line,
  RiRefreshLine,
  RiVideoAddLine,
  RiVideoFill,
} from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button, Input } from "../../../shared/utilities/form";
import { SceneScript } from "../constants";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

interface BatchActionBarProps {
  scenes: SceneScript[];
}

export function BatchActionBar({ scenes }: BatchActionBarProps) {
  const { t } = useTranslation();
  const {
    generateImage,
    generateVideo,
    extendVideo,
    getGeneratedImage,
    getGeneratedVideo,
    getExtendedVideo,
  } = useAffiliateVideoApi();
  const {
    scriptData,
    addBatchGeneratingSceneId,
    removeBatchGeneratingSceneId,
    addBatchGeneratingVideoSceneId,
    removeBatchGeneratingVideoSceneId,
  } = useAffiliateVideoContext();
  const toast = useToast();

  // ── Voice Export Dialog state ──
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

  // ── Batch image generation state ──
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(-1);
  const [batchCurrentSceneLabel, setBatchCurrentSceneLabel] = useState("");
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [batchErrors, setBatchErrors] = useState(0);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const stopRef = useRef(false);

  // ── Batch video generation state ──
  const [videoBatchRunning, setVideoBatchRunning] = useState(false);
  const [videoBatchDone, setVideoBatchDone] = useState(false);
  const [videoBatchCurrentIndex, setVideoBatchCurrentIndex] = useState(-1);
  const [videoBatchCurrentSceneLabel, setVideoBatchCurrentSceneLabel] = useState("");
  const [videoBatchTotal, setVideoBatchTotal] = useState(0);
  const [videoBatchCompleted, setVideoBatchCompleted] = useState(0);
  const [videoBatchErrors, setVideoBatchErrors] = useState(0);
  const [videoBatchSkipped, setVideoBatchSkipped] = useState(0);
  const videoStopRef = useRef(false);

  // ── Batch extend video state ──
  const [extendBatchRunning, setExtendBatchRunning] = useState(false);
  const [extendBatchDone, setExtendBatchDone] = useState(false);
  const [extendBatchCurrentIndex, setExtendBatchCurrentIndex] = useState(-1);
  const [extendBatchCurrentSceneLabel, setExtendBatchCurrentSceneLabel] = useState("");
  const [extendBatchTotal, setExtendBatchTotal] = useState(0);
  const [extendBatchCompleted, setExtendBatchCompleted] = useState(0);
  const [extendBatchErrors, setExtendBatchErrors] = useState(0);
  const [extendBatchSkipped, setExtendBatchSkipped] = useState(0);
  const extendStopRef = useRef(false);
  const extendEligibleScenesRef = useRef<SceneScript[]>([]);
  // SSE progress cho bước hiện tại
  const [extendStepProgress, setExtendStepProgress] = useState(0);
  const [extendStepMessage, setExtendStepMessage] = useState("");

  const sceneCount = scenes.length;

  // ── Concurrency limits ──
  const IMAGE_CONCURRENCY = 2;
  const VIDEO_CONCURRENCY = 2;

  // ── Count scenes without generated image & scenes with generated image ──
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
        } else {
          // Count as pending if it has a generated image OR an imageGenPrompt (image will be auto-generated)
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
  }, [scenes, videoBatchRunning, getGeneratedVideo, getGeneratedImage]);

  // ── Count extend chain status ──
  const [pendingExtendCount, setPendingExtendCount] = useState<number | null>(null);
  const [availableExtendCount, setAvailableExtendCount] = useState<number>(0);

  useEffect(() => {
    if (extendBatchRunning) return;
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
      const lastExt = await getExtendedVideo(lastScene.id);

      if (!cancelled) {
        if (lastExt) {
          // Chain complete → 1 video sẵn sàng tải
          setPendingExtendCount(0);
          setAvailableExtendCount(1);
        } else {
          // Chain chưa hoàn thành → cần N-1 bước nối
          setPendingExtendCount(scenesWithVideo.length - 1);
          setAvailableExtendCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenes, extendBatchRunning, getGeneratedVideo, getExtendedVideo]);

  // ── Batch download extended video state ──
  const [downloadingExtended, setDownloadingExtended] = useState(false);

  // ── Batch download image state ──
  const [downloading, setDownloading] = useState(false);

  // ── handleDownloadAllImages: collect all generated images → ZIP → download ──
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

  // ── handleCreateAllImage: worker pool (always keep IMAGE_CONCURRENCY slots busy) ──
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

  // ── handleCreateAllVideo: worker pool (always keep VIDEO_CONCURRENCY slots busy) ──
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
            image: {
              imageBytes: existingImage.imageBytes,
              mimeType: existingImage.mimeType,
            },
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

  // ── handleExtendAllVideo: chain mode – nối tuần tự video cảnh 1→2→3→... ──
  const handleExtendAllVideo = async () => {
    if (extendBatchRunning || videoBatchRunning || batchRunning) return;

    // Lấy tất cả scene có video, giữ đúng thứ tự
    const eligibleScenes: SceneScript[] = [];
    for (const s of scenes) {
      if (s.disabled) continue;
      const vid = await getGeneratedVideo(s.id);
      if (vid) eligibleScenes.push(s);
    }
    if (eligibleScenes.length < 2) {
      toast.warn(t("Cần ít nhất 2 cảnh có video để nối"));
      return;
    }

    extendEligibleScenesRef.current = eligibleScenes;
    setExtendBatchRunning(true);
    // Tổng số bước nối = N-1 (N scenes → N-1 lần extend)
    setExtendBatchTotal(eligibleScenes.length - 1);
    setExtendBatchCompleted(0);
    setExtendBatchErrors(0);
    setExtendBatchSkipped(0);
    setExtendBatchCurrentIndex(0);
    setExtendBatchCurrentSceneLabel("");
    setExtendStepProgress(0);
    setExtendStepMessage("");
    extendStopRef.current = false;

    let completed = 0;
    let errors = 0;

    // Base: lấy video cảnh đầu tiên làm gốc
    let chainVideo = await getGeneratedVideo(eligibleScenes[0].id);
    if (!chainVideo) {
      toast.error(t("Không tìm thấy video cảnh đầu tiên"));
      setExtendBatchRunning(false);
      return;
    }

    // Nối chuỗi: video cảnh 1 → extend với cảnh 2 → kết quả → extend với cảnh 3 → ...
    for (let i = 1; i < eligibleScenes.length; i++) {
      if (extendStopRef.current) break;

      const prevScene = eligibleScenes[i - 1];
      const scene = eligibleScenes[i];

      // Cập nhật tiến trình
      setExtendBatchCurrentIndex(i);
      setExtendBatchCurrentSceneLabel(`#${prevScene.sceneNumber} → #${scene.sceneNumber}`);
      setExtendStepProgress(0);
      setExtendStepMessage("");

      try {
        addBatchGeneratingVideoSceneId(scene.id);

        // Lấy ảnh tham chiếu của scene kế tiếp (hướng dẫn nối)
        const sceneImage = await getGeneratedImage(scene.id);

        const result = await extendVideo({
          sceneId: scene.id,
          prompt: scene.motionPrompt || "Continue the scene naturally",
          video: {
            uri: chainVideo!.videoUri,
            videoBytes: chainVideo!.videoBytes,
            mimeType: chainVideo!.mimeType,
          },
          // Ảnh tham chiếu của scene kế tiếp
          ...(sceneImage
            ? {
                image: {
                  imageBytes: sceneImage.imageBytes,
                  mimeType: sceneImage.mimeType,
                },
              }
            : {}),
          onProgress: (pct) => setExtendStepProgress(pct),
          onStatusMessage: (msg) => setExtendStepMessage(msg),
        });

        if (result) {
          chainVideo = result; // Dùng kết quả này cho bước tiếp theo
        } else {
          // Không có kết quả → chuỗi bị đứt
          errors++;
          setExtendBatchErrors(errors);
          completed++;
          setExtendBatchCompleted(completed);
          break;
        }
        completed++;
        setExtendBatchCompleted(completed);
      } catch (err) {
        console.error(
          `[BatchExtendVideo] Chain #${prevScene.sceneNumber}→#${scene.sceneNumber} error:`,
          err
        );
        errors++;
        setExtendBatchErrors(errors);
        completed++;
        setExtendBatchCompleted(completed);
        // Chuỗi bị đứt → không thể tiếp tục
        break;
      } finally {
        removeBatchGeneratingVideoSceneId(scene.id);
      }
    }

    setExtendBatchRunning(false);
    setExtendBatchDone(true);
    setExtendBatchCurrentIndex(-1);
    setExtendBatchCurrentSceneLabel("");

    const generated = completed - errors;
    const totalSteps = eligibleScenes.length - 1;
    if (extendStopRef.current) {
      toast.info(`${t("Đã dừng. Nối được")} ${generated}/${totalSteps} ${t("bước")}.`);
    } else if (errors > 0) {
      toast.warn(`${t("Lỗi khi nối. Đã nối được")} ${generated}/${totalSteps} ${t("bước")}.`);
    } else {
      toast.success(
        `${t("Đã hoàn thành nối")} ${eligibleScenes.length} ${t("cảnh thành một video liên tục!")}`
      );
    }
  };

  const handleStopExtendBatch = () => {
    extendStopRef.current = true;
  };

  // ── handleDownloadExtendedVideos: tải video nối cuối cùng (kết quả chain) ──
  const handleDownloadExtendedVideos = useCallback(async () => {
    if (downloadingExtended) return;
    setDownloadingExtended(true);

    try {
      // Tìm video nối cuối cùng (scene cuối trong chuỗi)
      const eligibleScenes = scenes.filter((s) => !s.disabled);
      let lastExtended:
        | { videoUri: string | null; videoBytes: string | null; mimeType: string }
        | undefined;
      let firstSceneNumber = 0;
      let lastSceneNumber = 0;

      // Tìm ngược từ cuối để lấy video chain cuối cùng
      for (let i = eligibleScenes.length - 1; i >= 0; i--) {
        const ext = await getExtendedVideo(eligibleScenes[i].id);
        if (ext) {
          lastExtended = ext;
          lastSceneNumber = eligibleScenes[i].sceneNumber;
          // Tìm scene đầu tiên có video (gốc chain)
          for (const s of eligibleScenes) {
            const vid = await getGeneratedVideo(s.id);
            if (vid) {
              firstSceneNumber = s.sceneNumber;
              break;
            }
          }
          break;
        }
      }

      if (!lastExtended) {
        toast.warn(t("Chưa có video nối nào để tải"));
        setDownloadingExtended(false);
        return;
      }

      const fileName = `video-noi-canh-${firstSceneNumber}-den-${lastSceneNumber}`;

      if (lastExtended.videoBytes) {
        const byteChars = atob(lastExtended.videoBytes);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const ext = lastExtended.mimeType?.split("/")[1] || "mp4";
        const blob = new Blob([byteNumbers], { type: lastExtended.mimeType || "video/mp4" });
        saveAs(blob, `${fileName}.${ext}`);
      } else if (lastExtended.videoUri) {
        const response = await fetch(lastExtended.videoUri);
        const blob = await response.blob();
        saveAs(blob, `${fileName}.mp4`);
      }

      toast.success(t("Đã tải video nối thành công!"));
    } catch (err) {
      console.error("[handleDownloadExtendedVideos] Error:", err);
      toast.error(t("Lỗi khi tải video nối"));
    } finally {
      setDownloadingExtended(false);
    }
  }, [downloadingExtended, scenes, getExtendedVideo, getGeneratedVideo, toast, t]);

  const actions = [
    {
      id: "batch-create-img",
      icon: batchRunning ? <RiLoader4Line className="animate-spin" /> : <RiImageFill />,
      label: batchRunning
        ? `${t("Đang tạo")} (${batchCompleted}/${batchTotal})`
        : `${t("Tạo Ảnh")}${
            pendingImageCount != null && pendingImageCount > 0 ? ` (x${pendingImageCount})` : ""
          }`,
      color: batchRunning ? "bg-pink-400 cursor-wait" : "bg-pink-500 hover:bg-pink-600",
      method: handleCreateAllImage,
      disabled: batchRunning,
    },
    ...(batchRunning
      ? [
          {
            id: "batch-stop",
            icon: <RiCloseLine />,
            label: t("Dừng"),
            color: "bg-red-500 hover:bg-red-600",
            method: handleStopBatch,
            disabled: false,
          },
        ]
      : []),
    {
      id: "batch-download-img",
      icon: downloading ? <RiLoader4Line className="animate-spin" /> : <RiDownloadLine />,
      label: downloading
        ? t("Đang tải...")
        : `${t("Tải Ảnh")}${availableImageCount > 0 ? ` (x${availableImageCount})` : ""}`,
      color: downloading ? "bg-blue-400 cursor-wait" : "bg-blue-500 hover:bg-blue-600",
      method: handleDownloadAllImages,
      disabled: downloading || availableImageCount === 0,
    },
    {
      id: "batch-create-video",
      icon: videoBatchRunning ? <RiLoader4Line className="animate-spin" /> : <RiVideoFill />,
      label: videoBatchRunning
        ? `${t("Đang tạo")} (${videoBatchCompleted}/${videoBatchTotal})`
        : `${t("Tạo Video")}${
            pendingVideoCount != null && pendingVideoCount > 0 ? ` (x${pendingVideoCount})` : ""
          }`,
      color: videoBatchRunning ? "bg-purple-400 cursor-wait" : "bg-purple-500 hover:bg-purple-600",
      method: handleCreateAllVideo,
      disabled: videoBatchRunning || batchRunning,
    },
    ...(videoBatchRunning
      ? [
          {
            id: "batch-stop-video",
            icon: <RiCloseLine />,
            label: t("Dừng"),
            color: "bg-red-500 hover:bg-red-600",
            method: handleStopVideoBatch,
            disabled: false,
          },
        ]
      : []),
    {
      id: "batch-download-video",
      icon: <RiDownloadLine />,
      label: `${t("Tải Video")} (0)`,
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
    {
      id: "batch-retry-video",
      icon: <RiRefreshLine />,
      label: t("Tạo Lại Video Lỗi"),
      color: "bg-red-500 hover:bg-red-600",
    },
    {
      id: "batch-extend-video",
      icon: extendBatchRunning ? <RiLoader4Line className="animate-spin" /> : <RiVideoAddLine />,
      label: extendBatchRunning
        ? `${t("Đang nối")} (${extendBatchCompleted}/${extendBatchTotal})`
        : `${t("Tạo Video Nối")}${
            pendingExtendCount != null && pendingExtendCount > 0 ? ` (x${pendingExtendCount})` : ""
          }`,
      color: extendBatchRunning ? "bg-primary/70 cursor-wait" : "bg-primary hover:bg-primary-dark",
      method: handleExtendAllVideo,
      disabled: extendBatchRunning || videoBatchRunning || batchRunning,
    },
    ...(extendBatchRunning
      ? [
          {
            id: "batch-stop-extend",
            icon: <RiCloseLine />,
            label: t("Dừng"),
            color: "bg-red-500 hover:bg-red-600",
            method: handleStopExtendBatch,
            disabled: false,
          },
        ]
      : []),
    {
      id: "batch-download-extended",
      icon: downloadingExtended ? <RiLoader4Line className="animate-spin" /> : <RiDownloadLine />,
      label: downloadingExtended
        ? t("Đang tải...")
        : `${t("Tải Video Nối")}${availableExtendCount > 0 ? ` (x${availableExtendCount})` : ""}`,
      color: downloadingExtended
        ? "bg-purple-400 cursor-wait"
        : "bg-purple-500 hover:bg-purple-600",
      method: handleDownloadExtendedVideos,
      disabled: downloadingExtended || availableExtendCount === 0,
    },
    {
      id: "batch-export-prompt",
      icon: <RiFileCopyLine />,
      label: t("Xuất Prompt"),
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      id: "batch-export-voice",
      icon: <MdRecordVoiceOver />,
      label: t("Xuất Voice"),
      color: "bg-blue-500 hover:bg-blue-600",
      method: () => setShowVoiceExportDialog(true),
    },
  ];

  return (
    <>
      <div className="flex flex-col border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 p-3 flex-wrap ">
          {actions.map((action) => (
            <button
              key={action.id}
              id={action.id}
              onClick={action.method}
              disabled={action.disabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${action.color}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        {/* Progress bar – hiển thị khi đang chạy hoặc đã hoàn thành */}
        {(batchRunning || batchDone) && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1 min-w-0">
                {batchRunning ? (
                  <>
                    <span className="whitespace-nowrap">
                      🎨 {t("Cảnh")} #
                      {scenes.filter((s) => !s.disabled)[batchCurrentIndex]?.sceneNumber ?? "?"} —{" "}
                      {batchCompleted}/{batchTotal}
                    </span>
                    {batchCurrentSceneLabel && (
                      <span className="text-gray-400 truncate ml-1" title={batchCurrentSceneLabel}>
                        · {batchCurrentSceneLabel}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    ✅ {t("Hoàn thành")} — {batchCompleted}/{batchTotal}
                  </>
                )}
              </span>
              <span className="flex items-center gap-2">
                {batchSkipped > 0 && (
                  <span className="text-blue-500">
                    {batchSkipped} {t("bỏ qua")}
                  </span>
                )}
                {batchErrors > 0 && (
                  <span className="text-red-500">
                    {batchErrors} {t("lỗi")}
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  batchDone && !batchRunning
                    ? "bg-gradient-to-r from-green-400 to-emerald-500"
                    : "bg-gradient-to-r from-pink-500 to-purple-500"
                }`}
                style={{ width: `${batchTotal > 0 ? (batchCompleted / batchTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Video Progress bar – hiển thị khi đang chạy hoặc đã hoàn thành */}
        {(videoBatchRunning || videoBatchDone) && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1 min-w-0">
                {videoBatchRunning ? (
                  <>
                    <span className="whitespace-nowrap">
                      🎬 {t("Video Scene")} #
                      {scenes.filter((s) => !s.disabled && s.motionPrompt)[videoBatchCurrentIndex]
                        ?.sceneNumber ?? "?"}{" "}
                      — {videoBatchCompleted}/{videoBatchTotal}
                    </span>
                    {videoBatchCurrentSceneLabel && (
                      <span
                        className="text-gray-400 truncate ml-1"
                        title={videoBatchCurrentSceneLabel}
                      >
                        · {videoBatchCurrentSceneLabel}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    ✅ {t("Video hoàn thành")} — {videoBatchCompleted}/{videoBatchTotal}
                  </>
                )}
              </span>
              <span className="flex items-center gap-2">
                {videoBatchSkipped > 0 && (
                  <span className="text-blue-500">
                    {videoBatchSkipped} {t("bỏ qua")}
                  </span>
                )}
                {videoBatchErrors > 0 && (
                  <span className="text-red-500">
                    {videoBatchErrors} {t("lỗi")}
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  videoBatchDone && !videoBatchRunning
                    ? "bg-gradient-to-r from-green-400 to-emerald-500"
                    : "bg-gradient-to-r from-purple-500 to-indigo-500"
                }`}
                style={{
                  width: `${
                    videoBatchTotal > 0 ? (videoBatchCompleted / videoBatchTotal) * 100 : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Extend Video Progress bar – hiển thị khi đang chạy hoặc đã hoàn thành */}
        {(extendBatchRunning || extendBatchDone) && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1 min-w-0">
                {extendBatchRunning ? (
                  <>
                    <span className="whitespace-nowrap">
                      🔗 {t("Nối chuỗi")}: {extendBatchCurrentSceneLabel || "..."} —{" "}
                      {extendBatchCompleted}/{extendBatchTotal}
                    </span>
                    {extendStepMessage && (
                      <span className="text-gray-400 truncate ml-1" title={extendStepMessage}>
                        · {extendStepMessage}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    ✅ {t("Nối video hoàn thành")} — {extendBatchCompleted}/{extendBatchTotal}
                  </>
                )}
              </span>
              <span className="flex items-center gap-2">
                {extendBatchRunning && extendStepProgress > 0 && (
                  <span className="text-teal-500 font-medium">{extendStepProgress}%</span>
                )}
                {extendBatchErrors > 0 && (
                  <span className="text-red-500">
                    {extendBatchErrors} {t("lỗi")}
                  </span>
                )}
              </span>
            </div>
            {/* Thanh tổng: hiển thị tiến trình theo bước */}
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  extendBatchDone && !extendBatchRunning
                    ? "bg-gradient-to-r from-green-400 to-emerald-500"
                    : "bg-gradient-to-r from-teal-500 to-cyan-500"
                }`}
                style={{
                  width: `${
                    extendBatchTotal > 0 ? (extendBatchCompleted / extendBatchTotal) * 100 : 0
                  }%`,
                }}
              />
            </div>
            {/* Thanh con: tiến trình SSE của bước hiện tại */}
            {extendBatchRunning && (
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-400 to-teal-400"
                  style={{ width: `${extendStepProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Voice Export Dialog ── */}
      <Dialog
        isOpen={showVoiceExportDialog}
        onClose={() => setShowVoiceExportDialog(false)}
        width={600}
        slideFromBottom="none"
        hasCloseIcon={false}
        dialogClass="relative bg-white shadow-2xl rounded-2xl overflow-hidden"
        headerClass=""
        bodyClass=""
        footerClass=""
      >
        <Dialog.Header>
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-base flex items-center gap-2">
                  <MdRecordVoiceOver className="text-blue-500" />
                  {t("Xuất Voice")}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {t("Tổng hợp Dialogue & Audio từ tất cả Scene")}
                </div>
              </div>
              <button
                onClick={() => setShowVoiceExportDialog(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer border-0 transition-colors"
              >
                <RiCloseLine className="text-sm" />
              </button>
            </div>
          </div>
        </Dialog.Header>

        <Dialog.Body>
          <div className="px-5 py-3 space-y-4 max-h-[70vh] overflow-y-auto v-scrollbar">
            {/* ── Audio Section ── */}

            <Input
              prefix={t("Giọng đọc")}
              value={audioExportText}
              prefixClassName="border-r border-gray-200 bg-gray-50"
              placeholder={t("Không có Audio")}
            />
            {/* ── Dialogue Section ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Dialogue</span>
                <Button
                  onClick={handleCopyDialogue}
                  disabled={!dialogueExportText}
                  className="!h-7 !px-2.5 text-xs"
                  icon={dialogueCopied ? <RiCheckLine /> : <RiClipboardLine />}
                  outline
                >
                  {dialogueCopied ? t("Đã chép") : t("Copy")}
                </Button>
              </div>
              {dialogueExportText ? (
                <pre className="w-full rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-700 px-4 py-3 whitespace-pre-wrap leading-relaxed font-mono">
                  {dialogueExportText}
                </pre>
              ) : (
                <div className="text-center text-gray-400 text-xs py-4 border border-dashed border-gray-200 rounded-xl">
                  {t("Không có Dialogue")}
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
            <Button onClick={() => setShowVoiceExportDialog(false)} outline>
              {t("Đóng")}
            </Button>
          </div>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}
