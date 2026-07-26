/**
 * batch-action-bar.tsx
 * BatchActionBar – thanh action buttons trên cùng của Batch List Panel
 * className only – Tailwind CSS, no inline styles
 */
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
  RiMagicLine,
  RiRefreshLine,
  RiVideoFill,
  RiVolumeUpLine,
} from "react-icons/ri";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button, Input, Select } from "../../../../shared/utilities/form";
import { CopyVideoScene } from "../../constants";
import { BatchMediaDownloadDropdown } from "../../shared/batch-download-dropdown";
import { BatchMergeVideosDropdown } from "../../shared/batch-merge-videos-dropdown";
import { useCopyVideoBatchActions } from "../hook/useCopyVideoBatchActions";

interface BatchActionBarProps {
  scenes: CopyVideoScene[];
}

export function BatchActionBar({ scenes }: BatchActionBarProps) {
  const { t } = useTranslation();
  const { BUILTIN_VOICES } = useOptionsTranslation();
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
    availableExtendCount,

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

    // Merge videos
    mergingVideos,
    mergeVideosLabel,
    getGeneratedVideo,
    handleMergeNormalVideos,
    handleMergeStitchVideos,

    // Retry failed scenes
    retryRunning,
    retryCompleted,
    retryTotal,
    retryErrors,
    handleRetryAllFailed,
    handleStopRetryBatch,

    // Export
    handleExportPromptCSV,
  } = useCopyVideoBatchActions(scenes);

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
      id: "batch-merge-videos",
      mergeVideosDropdown: true as const,
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
        retryRunning ||
        batchRunning ||
        videoBatchRunning ||
        extendBatchRunning ||
        downloading ||
        downloadingVideo ||
        mergingVideos,
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
      <div id="batch-action-bar" className="flex flex-col flex-shrink-0 bg-white border-b border-gray-100">
        <div className="flex overflow-x-auto flex-nowrap gap-2 items-center p-3">
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

            if ("mergeVideosDropdown" in action && action.mergeVideosDropdown) {
              return (
                <BatchMergeVideosDropdown
                  key={action.id}
                  id={action.id}
                  merging={mergingVideos}
                  mergeLabel={mergeVideosLabel}
                  scenes={scenes}
                  getGeneratedVideo={getGeneratedVideo}
                  availableVideoCount={availableVideoCount}
                  availableExtendCount={availableExtendCount}
                  disabled={
                    batchRunning ||
                    videoBatchRunning ||
                    extendBatchRunning ||
                    downloading ||
                    downloadingVideo
                  }
                  onMergeNormal={handleMergeNormalVideos}
                  onMergeStitch={handleMergeStitchVideos}
                />
              );
            }

            return (
              <button
                key={action.id}
                id={action.id}
                onClick={action.method}
                disabled={action.disabled}
                className={`flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${action.color}`}
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
            <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
              <span className="flex gap-1 items-center min-w-0">
                {batchRunning ? (
                  <>
                    <span className="whitespace-nowrap">
                      🎨 {t("Cảnh")} #
                      {scenes.filter((s) => !s.disabled)[batchCurrentIndex]?.sceneNumber ?? "?"} —{" "}
                      {batchCompleted}/{batchTotal}
                    </span>
                    {batchCurrentSceneLabel && (
                      <span className="ml-1 text-gray-400 truncate" title={batchCurrentSceneLabel}>
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
              <span className="flex gap-2 items-center">
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
            <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
              <span className="flex gap-1 items-center min-w-0">
                {videoBatchRunning ? (
                  <>
                    <span className="whitespace-nowrap">
                      🎬 {t("Video Scene")} #
                      {scenes.filter((s) => !s.disabled && s.motion_description)[
                        videoBatchCurrentIndex
                      ]?.sceneNumber ?? "?"}{" "}
                      — {videoBatchCompleted}/{videoBatchTotal}
                    </span>
                    {videoBatchCurrentSceneLabel && (
                      <span
                        className="ml-1 text-gray-400 truncate"
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
              <span className="flex gap-2 items-center">
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
            <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
              <span className="flex gap-1 items-center min-w-0">
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
              <span className="flex gap-2 items-center">
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
            <div className="flex justify-between items-center">
              <div>
                <div className="flex gap-2 items-center text-base font-bold">
                  <MdRecordVoiceOver className="text-blue-500" />
                  {t("Xuất Voice")}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {t("Tổng hợp Dialogue & Audio từ tất cả Scene")}
                </div>
              </div>
              <button
                onClick={() => setShowVoiceExportDialog(false)}
                className="flex justify-center items-center w-7 h-7 text-gray-500 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer hover:bg-gray-200"
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
              <div className="flex justify-between items-center mb-2">
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
                <pre className="overflow-y-auto px-4 py-3 w-full max-h-48 font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl border border-gray-200 v-scrollbar">
                  {dialogueExportText}
                </pre>
              ) : (
                <div className="py-4 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
                  {t("Không có Dialogue")}
                </div>
              )}
            </div>

            {/* ── AI Text-to-Speech Section ── */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex gap-2 items-center mb-3">
                <RiVolumeUpLine className="text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">{t("Tạo Giọng AI")}</span>
              </div>

              {/* Voice selector + Generate button */}
              <div className="flex gap-2 items-center mb-3">
                <div className="flex-1">
                  <Select
                    value={ttsVoiceName}
                    onChange={(val: string) => setTtsVoiceName(val)}
                    options={BUILTIN_VOICES.map((v) => ({
                      value: v.value,
                      label: v.label,
                    }))}
                    className="text-xs"
                  />
                </div>
                <Button
                  onClick={handleGenerateTTS}
                  disabled={ttsGenerating || !dialogueExportText}
                  className="!h-9 !px-4 text-xs whitespace-nowrap"
                  icon={
                    ttsGenerating ? <RiLoader4Line className="animate-spin" /> : <RiMagicLine />
                  }
                  primary
                >
                  {ttsGenerating ? t("Đang tạo...") : t("Generate AI")}
                </Button>
              </div>

              {/* Audio player */}
              {ttsAudioUrl && (
                <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                  <audio
                    ref={ttsAudioRef}
                    controls
                    src={ttsAudioUrl}
                    className="w-full h-8"
                    style={{ borderRadius: "8px" }}
                  />
                  <div className="flex gap-2 justify-end items-center mt-2">
                    <Button
                      onClick={handleDownloadTTSAudio}
                      className="!h-7 !px-2.5 text-xs"
                      icon={<RiDownloadLine />}
                      outline
                    >
                      {t("Tải Audio")}
                    </Button>
                  </div>
                </div>
              )}

              {!ttsAudioUrl && !ttsGenerating && (
                <div className="py-3 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
                  {t("Chọn giọng đọc và nhấn Generate AI để tạo audio từ Dialogue")}
                </div>
              )}

              {ttsGenerating && (
                <div className="flex gap-2 justify-center items-center py-4">
                  <RiLoader4Line className="text-lg text-purple-500 animate-spin" />
                  <span className="text-xs text-gray-500">
                    {t("Đang tạo giọng nói bằng AI... Vui lòng chờ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <div className="flex gap-2 justify-end items-center px-5 py-4 bg-white rounded-b-2xl border-t border-gray-100">
            <Button onClick={() => setShowVoiceExportDialog(false)} outline>
              {t("Đóng")}
            </Button>
          </div>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}
