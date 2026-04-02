import { useTranslation } from "react-i18next";
import { Button, Label, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS } from "../../constants";
import { useAffiliateVideoContext } from "../../providers/affiliate-video-provider";

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const {
    videoConfig,
    patchConfig,
    SpeedModeOptions,
    VideoCountOptions,
    VoiceModeOptions,
    DelayQueueOptions,
    setVoiceMode,
    voiceMode,
    setDelayQueue,
    delayQueue,
    totalCount,
    promptItems,
    setShowAiModal,
    removeItem,
    updateItem,
    doneCount,
  } = useAffiliateVideoContext();

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(99,102,241,0.3) transparent",
      }}
    >
      {/* Config card */}
      <div
        className="m-3 rounded-xl border border-white border-opacity-8 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-white border-opacity-8"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-14">⚙️</span>
            <span className="text-12 font-bold text-blue-100">{t("Cấu hình")}</span>
          </div>
          <button className="text-10 text-blue-400 hover:text-blue-300 border-0 bg-transparent cursor-pointer flex items-center gap-1">
            {t("Cấu hình gần đây")} <span>▾</span>
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* SPEED */}
          <div>
            <Label text={t("Tốc độ")} />
            <div className="flex gap-1">
              {SpeedModeOptions.map((s) => (
                <Button
                  key={s.value}
                  onClick={() => patchConfig({ speed: s.value })}
                  text={s.label}
                  primary={videoConfig.speed === s.value}
                ></Button>
              ))}
            </div>
          </div>

          {/* ASPECT */}
          <div>
            <Label text={t("Tỷ lệ")} />
            <div className="flex gap-1">
              {ASPECT_RATIOS.slice(0, 2).map((ar) => (
                <Button
                  key={ar.value}
                  onClick={() => patchConfig({ aspectRatio: ar.value })}
                  text={ar.label}
                  primary={videoConfig.aspectRatio === ar.value}
                ></Button>
              ))}
            </div>
          </div>

          {/* SỐ LƯỢNG */}
          <div>
            <Label text={t("Số lượng")} />
            <div className="flex gap-1">
              {VideoCountOptions.map((n) => (
                <Button
                  key={n.value}
                  onClick={() => patchConfig({ numberOfOutputs: n.value })}
                  primary={videoConfig.numberOfOutputs === n.value}
                  text={`x${n.label}`}
                ></Button>
              ))}
            </div>
          </div>

          {/* VOICE MODE */}
          <div>
            <Label text={t("Giọng nói")} />
            <div className="flex gap-1">
              {(VoiceModeOptions as { value: VoiceMode; label: string }[]).map((m) => (
                <Button
                  key={m.value}
                  onClick={() => setVoiceMode(m.value)}
                  text={m.label}
                  primary={voiceMode === m.value}
                ></Button>
              ))}
            </div>
          </div>

          {/* DELAY QUEUE */}
          <div>
            <Label text={t("Delay Queue")} />
            <div className="flex gap-1">
              {DelayQueueOptions.map((d) => (
                <Button
                  onClick={() => setDelayQueue(d.value as DelayQueue)}
                  primary={delayQueue === d.value}
                  text={d.label}
                ></Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt card */}
      <div
        className="mx-3 mb-3 rounded-xl border border-white border-opacity-8 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-white border-opacity-8"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-14">📝</span>
            <span className="text-12 font-bold text-blue-100">{t("Prompt")}</span>
            {totalCount > 0 && (
              <span className="text-10 font-bold px-2 py-0 rounded-full bg-indigo-600 text-white">
                {totalCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-1 text-10 font-semibold px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white border-0 cursor-pointer transition-all"
          >
            🤖 {t("AI Generate")}
          </button>
        </div>

        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="text-32 mb-2 opacity-50">📋</div>
            <div className="text-13 font-semibold text-blue-200 mb-1">
              {t("Nhấn")}
              <strong className="text-indigo-400">🤖 {t("AI Generate")}</strong>
            </div>
            <div className="text-11 text-blue-500">{t("để AI tạo prompt tự động")}</div>
          </div>
        ) : (
          <div className="divide-y divide-white divide-opacity-5">
            {promptItems.map((item, idx) => {
              const statusColor =
                item.videoStatus === "done"
                  ? "text-green-400"
                  : item.videoStatus === "loading"
                  ? "text-yellow-400"
                  : item.videoStatus === "error"
                  ? "text-red-400"
                  : "text-blue-400";
              return (
                <div key={item.id} className="p-3 space-y-2">
                  {/* Status row */}
                  <div
                    className={`flex items-center justify-between text-10 font-semibold ${statusColor}`}
                  >
                    <span>
                      #{idx + 1} ·{" "}
                      {item.videoStatus === "done"
                        ? "✅ Done"
                        : item.videoStatus === "loading"
                        ? "⏳ Gen Video..."
                        : item.videoStatus === "error"
                        ? "❌ Video Err"
                        : "○ Ready"}
                      {item.audioStatus === "done"
                        ? " | ✅ Audio"
                        : item.audioStatus === "loading"
                        ? " | ⏳ Gen Audio"
                        : item.audioStatus === "error"
                        ? " | ❌ Audio Err"
                        : ""}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-5 h-5 rounded flex items-center justify-center bg-white bg-opacity-5 hover:bg-red-900 hover:bg-opacity-40 text-blue-400 hover:text-red-400 border-0 cursor-pointer text-10 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Textarea */}
                  <Textarea
                    value={item.promptText}
                    onChange={(e) => updateItem(item.id, { promptText: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg bg-black bg-opacity-30 border border-white border-opacity-8 text-blue-100 text-11 px-2 py-1 outline-none resize-none placeholder-blue-600 focus:border-indigo-500 transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  />
                  {/* Action buttons */}
                  <div className="flex gap-1">
                    <Button
                      // onClick={() => generateSingleVideo(item.id)}
                      disabled={item.videoStatus === "loading"}
                      className="flex-1 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-10 font-semibold border-0 cursor-pointer transition-all"
                    >
                      🎬 {t("Gen Video")}
                    </Button>
                    {(voiceMode === "in_video" || voiceMode === "separate") && (
                      <Button
                        // onClick={() => generateSingleAudio(item.id)}
                        disabled={item.audioStatus === "loading"}
                        className="flex-1 py-1 rounded-md bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-10 font-semibold border-0 cursor-pointer transition-all"
                      >
                        🔊 {t("Gen Audio")}
                      </Button>
                    )}
                  </div>
                  {item.audioSrc && <audio controls src={item.audioSrc} className="w-full h-7" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info bar */}
      {totalCount > 0 && (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-900 bg-opacity-20 border border-indigo-500 border-opacity-20">
          <span className="text-12">ℹ️</span>
          <span className="text-11 text-blue-300">
            {totalCount} {t("Prompt")} · {doneCount} {t("xong")} · {totalCount - doneCount}{" "}
            {t("còn lại")}
          </span>
        </div>
      )}
    </div>
  );
};
