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
import { SceneScript } from "../../constants";
import { useBatchActions } from "../../hook/useBatchActions";

interface BatchActionBarProps {
  scenes: SceneScript[];
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

    // Downloads
    downloading,
    downloadingVideo,
    downloadLabel,
    downloadVideoLabel,
    handleDownloadAllImages,
    handleDownloadAllVideos,

    // Export
    handleExportPromptCSV,
  } = useBatchActions(scenes);

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
        ? `${t("Đang tải")} ${downloadLabel}...`
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
      id: "batch-download-video",
      icon: downloadingVideo ? <RiLoader4Line className="animate-spin" /> : <RiDownloadLine />,
      label: downloadingVideo
        ? `${t("Đang tải")} ${downloadVideoLabel}...`
        : `${t("Tải Video")}${availableVideoCount > 0 ? ` (x${availableVideoCount})` : ""}`,
      color: downloadingVideo ? "bg-indigo-400 cursor-wait" : "bg-indigo-500 hover:bg-indigo-600",
      method: handleDownloadAllVideos,
      disabled: downloadingVideo || availableVideoCount === 0,
    },
    {
      id: "batch-retry-video",
      icon: <RiRefreshLine />,
      label: t("Tạo Lại Video Lỗi"),
      color: "bg-red-500 hover:bg-red-600",
    },

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
      <div className="flex flex-col border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 p-3 flex-nowrap overflow-x-auto  ">
          {actions.map((action) => (
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

            {/* ── AI Text-to-Speech Section ── */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <RiVolumeUpLine className="text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">{t("Tạo Giọng AI")}</span>
              </div>

              {/* Voice selector + Generate button */}
              <div className="flex items-center gap-2 mb-3">
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
                <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-3">
                  <audio
                    ref={ttsAudioRef}
                    controls
                    src={ttsAudioUrl}
                    className="w-full h-8"
                    style={{ borderRadius: "8px" }}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
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
                <div className="text-center text-gray-400 text-xs py-3 border border-dashed border-gray-200 rounded-xl">
                  {t("Chọn giọng đọc và nhấn Generate AI để tạo audio từ Dialogue")}
                </div>
              )}

              {ttsGenerating && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <RiLoader4Line className="animate-spin text-purple-500 text-lg" />
                  <span className="text-xs text-gray-500">
                    {t("Đang tạo giọng nói bằng AI... Vui lòng chờ")}
                  </span>
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
