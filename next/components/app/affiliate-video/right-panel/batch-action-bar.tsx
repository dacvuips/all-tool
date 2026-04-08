/**
 * batch-action-bar.tsx
 * BatchActionBar – thanh action buttons trên cùng của Batch List Panel
 * className only – Tailwind CSS, no inline styles
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  RiCloseLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageFill,
  RiLoader4Line,
  RiRefreshLine,
  RiVideoFill,
} from "react-icons/ri";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { SceneScript } from "../constants";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";

interface BatchActionBarProps {
  scenes: SceneScript[];
}

export function BatchActionBar({ scenes }: BatchActionBarProps) {
  const { t } = useTranslation();
  const { generateImage, getGeneratedImage } = useAffiliateVideoApi();
  const toast = useToast();

  // ── Batch image generation state ──
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(-1);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [batchErrors, setBatchErrors] = useState(0);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const stopRef = useRef(false);

  const sceneCount = scenes.length;

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
    return () => { cancelled = true; };
  }, [scenes, batchRunning, getGeneratedImage]);

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

  // ── handleCreateAllImage: sequential queue ──
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
    stopRef.current = false;

    let completed = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < eligibleScenes.length; i++) {
      // Check if user requested stop
      if (stopRef.current) break;

      const scene = eligibleScenes[i];
      setBatchCurrentIndex(i);

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
        // Continue to next scene
      }
    }

    setBatchRunning(false);
    setBatchDone(true);
    setBatchCurrentIndex(-1);

    // Toast thông báo kết quả
    const generated = completed - skipped - errors;
    if (stopRef.current) {
      toast.info(`Đã dừng. Tạo được ${generated} ảnh, ${skipped} bỏ qua, ${errors} lỗi.`);
    } else if (errors > 0) {
      toast.warn(`Hoàn thành! Tạo được ${generated} ảnh, ${skipped} bỏ qua, ${errors} lỗi.`);
    } else {
      toast.success(`Đã hoàn thành! Tạo được ${generated} ảnh${skipped > 0 ? `, ${skipped} bỏ qua` : ""}.`);
    }
  };

  const handleStopBatch = () => {
    stopRef.current = true;
  };

  const actions = [
    {
      id: "batch-create-img",
      icon: batchRunning ? <RiLoader4Line className="animate-spin" /> : <RiImageFill />,
      label: batchRunning
        ? `${t("Đang tạo")} (${batchCompleted}/${batchTotal})`
        : `${t("Tạo Ảnh")}${pendingImageCount != null && pendingImageCount > 0 ? ` (x${pendingImageCount})` : ""}`,
      color: batchRunning
        ? "bg-pink-400 cursor-wait"
        : "bg-pink-500 hover:bg-pink-600",
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
      color: downloading
        ? "bg-blue-400 cursor-wait"
        : "bg-blue-500 hover:bg-blue-600",
      method: handleDownloadAllImages,
      disabled: downloading || availableImageCount === 0,
    },
    {
      id: "batch-create-video",
      icon: <RiVideoFill />,
      label: `${t("Tạo Video")} (x${sceneCount})`,
      color: "bg-purple-500 hover:bg-purple-600",
    },
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
      color: "bg-orange-500 hover:bg-orange-600",
    },
    {
      id: "batch-export-prompt",
      icon: <RiFileCopyLine />,
      label: t("Xuất Prompt"),
      color: "bg-green-500 hover:bg-green-600",
    },
  ];

  return (
    <div className="flex flex-col border-b border-gray-100 bg-white flex-shrink-0">
      <div className="flex items-center gap-2 p-3 flex-wrap">
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
            <span>
              {batchRunning ? (
                <>
                  🎨 {t("Scene")} #{scenes.filter((s) => !s.disabled)[batchCurrentIndex]?.sceneNumber ?? "?"}{" "}
                  — {batchCompleted}/{batchTotal}
                </>
              ) : (
                <>
                  ✅ {t("Hoàn thành")} — {batchCompleted}/{batchTotal}
                </>
              )}
            </span>
            <span className="flex items-center gap-2">
              {batchSkipped > 0 && (
                <span className="text-blue-500">{batchSkipped} {t("bỏ qua")}</span>
              )}
              {batchErrors > 0 && (
                <span className="text-red-500">{batchErrors} {t("lỗi")}</span>
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
    </div>
  );
}
