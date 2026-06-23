/**
 * batch-action-bar.tsx
 * BatchActionBar – thanh action buttons trên cùng của Batch List Panel
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiCloseLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageFill,
  RiLoader4Line,
  RiRefreshLine,
  RiVideoFill,
} from "react-icons/ri";
import { VoiceExportDialog } from "../../shared/voice-export-dialog";
import { BatchMediaDownloadDropdown } from "../../shared/batch-download-dropdown";
import { SceneScript } from "../../constants";
import { useBatchActions } from "../../hook/useBatchActions";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

interface BatchActionBarProps {
  scenes: SceneScript[];
}

export function BatchActionBar({ scenes }: BatchActionBarProps) {
  const { t } = useTranslation();
  const storyboardContext = useAffiliateVideoContext();
  const {
    // Voice export dialog
    showVoiceExportDialog,
    setShowVoiceExportDialog,
    dialogueCopied,
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

    // Downloads
    downloading,
    downloadingVideo,
    downloadLabel,
    downloadVideoLabel,
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

    // Retry failed scenes
    retryRunning,
    retryCompleted,
    retryTotal,
    retryErrors,
    handleRetryAllFailed,
    handleStopRetryBatch,

    // Export
    handleExportPromptCSV,
  } = useBatchActions(scenes, storyboardContext);

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
      id: "batch-create-extend-video",
      icon: extendBatchRunning ? <RiLoader4Line className="animate-spin" /> : <RiVideoFill />,
      label: extendBatchRunning
        ? `${t("Đang tạo")} (${extendBatchCompleted}/${extendBatchTotal})`
        : `${t("Tạo Video Nối")}${
            pendingExtendCount != null && pendingExtendCount > 0 ? ` (x${pendingExtendCount})` : ""
          }`,
      color: extendBatchRunning ? "bg-yellow-400 cursor-wait" : "bg-yellow-500 hover:bg-yellow-600",
      method: handleCreateAllExtendVideo,
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
      id: "batch-download-media",
      mediaDownloadDropdown: true as const,
    },
    {
      id: "batch-retry-video",
      icon: retryRunning ? <RiLoader4Line className="animate-spin" /> : <RiRefreshLine />,
      label: retryRunning
        ? `${t("Đang chạy lại")} (${retryCompleted}/${retryTotal})`
        : t("Tạo Lại Lỗi"),
      color: retryRunning ? "bg-red-400 cursor-wait" : "bg-red-500 hover:bg-red-600",
      method: handleRetryAllFailed,
      disabled:
        retryRunning || batchRunning || videoBatchRunning || extendBatchRunning || downloading || downloadingVideo,
    },
    ...(retryRunning
      ? [
          {
            id: "batch-stop-retry",
            icon: <RiCloseLine />,
            label: t("Dừng"),
            color: "bg-gray-600 hover:bg-gray-700",
            method: handleStopRetryBatch,
            disabled: false,
          },
        ]
      : []),

    {
      id: "batch-export-prompt",
      icon: <RiFileCopyLine />,
      label: t("Xuất Prompt"),
      color: "bg-green-500 hover:bg-green-600",
      method: handleExportPromptCSV,
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
      <div id="batch-action-bar" className="flex flex-col border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 p-3 flex-nowrap overflow-x-auto  ">
          {actions.map((action) => {
            if ("mediaDownloadDropdown" in action && action.mediaDownloadDropdown) {
              return (
                <BatchMediaDownloadDropdown
                  key={action.id}
                  id={action.id}
                  downloading={downloading}
                  downloadingVideo={downloadingVideo}
                  downloadLabel={downloadLabel}
                  downloadVideoLabel={downloadVideoLabel}
                  availableImageCount={availableImageCount}
                  availableVideoCount={availableVideoCount}
                  onDownloadAllImages={handleDownloadAllImages}
                  onDownloadAllImages2k={handleDownloadAllImages2k}
                  onDownloadAllImages4k={handleDownloadAllImages4k}
                  onDownloadAllVideos={handleDownloadAllVideos}
                  onDownloadAllVideos1080p={handleDownloadAllVideos1080p}
                  onDownloadAllImagesZip={handleDownloadAllImagesZip}
                  onDownloadAllImages2kZip={handleDownloadAllImages2kZip}
                  onDownloadAllImages4kZip={handleDownloadAllImages4kZip}
                  onDownloadAllVideosZip={handleDownloadAllVideosZip}
                  onDownloadAllVideos1080pZip={handleDownloadAllVideos1080pZip}
                />
              );
            }

            return (
              <button
                key={action.id}
                id={action.id}
                onClick={action.method}
                disabled={action.disabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${action.color}`}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}
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
                      🔗 {t("Video Nối")} {extendBatchCurrentSceneLabel || "..."} —{" "}
                      {extendBatchCompleted}/{extendBatchTotal}
                    </span>
                  </>
                ) : (
                  <>
                    ✅ {t("Video nối hoàn thành")} — {extendBatchCompleted}/{extendBatchTotal}
                  </>
                )}
              </span>
              <span className="flex items-center gap-2">
                {extendBatchSkipped > 0 && (
                  <span className="text-blue-500">
                    {extendBatchSkipped} {t("bỏ qua")}
                  </span>
                )}
                {extendBatchErrors > 0 && (
                  <span className="text-red-500">
                    {extendBatchErrors} {t("lỗi")}
                  </span>
                )}
              </span>
            </div>
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
          </div>
        )}
      </div>

      <VoiceExportDialog
        isOpen={showVoiceExportDialog}
        onClose={() => setShowVoiceExportDialog(false)}
        dialogueCopied={dialogueCopied}
        dialogueExportText={dialogueExportText}
        audioExportText={audioExportText}
        handleCopyDialogue={handleCopyDialogue}
        ttsGenerating={ttsGenerating}
        ttsAudioUrl={ttsAudioUrl}
        ttsVoiceName={ttsVoiceName}
        setTtsVoiceName={setTtsVoiceName}
        ttsAudioRef={ttsAudioRef}
        handleGenerateTTS={handleGenerateTTS}
        handleDownloadTTSAudio={handleDownloadTTSAudio}
      />
    </>
  );
}
