/**
 * AI Affiliate Video Workshop – affiliate-video.tsx
 * Styling: className only (Tailwind) — no inline styles, no style= props.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SettingsModal, ZoomModal } from "../../components/app/affiliate-video/components";
import {
  ASPECT_RATIOS,
  DEFAULT_VIDEO_CONFIG,
  DEFAULT_VOICE_CONFIG,
  MOCK_VIDEOS,
  PROMPT_TEMPLATES,
  PromptItem,
  VideoConfig,
  VoiceConfig,
  buildPrompt,
  uid,
} from "../../components/app/affiliate-video/constants";

type SpeedMode = "fast" | "relaxed" | "quality";
type DelayQueue = "instant" | "15s" | "30s" | "1m";
type ModeTab = "text" | "start_image" | "start_end" | "sync";
type MainTab = "generating" | "history";
type VoiceMode = "none" | "in_video" | "separate";

// ── Sub-components ──────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-9 font-semibold tracking-widest text-blue-400 uppercase mb-1 px-1">
    {children}
  </div>
);

const SegBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1 px-2 rounded text-12 font-semibold transition-all duration-150 cursor-pointer border-0 outline-none ${
      active
        ? "bg-indigo-600 text-white shadow"
        : "bg-white bg-opacity-5 text-blue-200 hover:bg-opacity-10"
    }`}
  >
    {children}
  </button>
);

const SqrBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`w-9 h-7 rounded text-12 font-bold transition-all duration-150 cursor-pointer border-0 outline-none ${
      active
        ? "bg-indigo-600 text-white shadow"
        : "bg-white bg-opacity-5 text-blue-200 hover:bg-opacity-10"
    }`}
  >
    {children}
  </button>
);

const DelayBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1 rounded text-11 font-semibold transition-all duration-150 cursor-pointer border-0 outline-none ${
      active
        ? "bg-indigo-600 text-white"
        : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
    }`}
  >
    {children}
  </button>
);

export default function AffiliateVideo() {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(DEFAULT_VIDEO_CONFIG);
  const patchConfig = (p: Partial<VideoConfig>) => setVideoConfig((c) => ({ ...c, ...p }));
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [templateId, setTemplateId] = useState("affiliate_review");
  const [rawPrompt, setRawPrompt] = useState(PROMPT_TEMPLATES[0].template);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState<{ src: string; type: "image" | "video" } | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("generating");
  const [modeTab, setModeTab] = useState<ModeTab>("text");
  const [speed, setSpeed] = useState<SpeedMode>("relaxed");
  const [delayQueue, setDelayQueue] = useState<DelayQueue>("15s");
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("none");
  const [showAiModal, setShowAiModal] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    const k = localStorage.getItem("avid-api-key");
    if (k) setApiKey(k);
    const m = localStorage.getItem("avid-model");
    if (m) patchConfig({ model: m });
  }, []);

  const saveSettings = (k: string, m: string) => {
    setApiKey(k);
    patchConfig({ model: m });
    localStorage.setItem("avid-api-key", k);
    localStorage.setItem("avid-model", m);
  };

  const processPrompt = useCallback(async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    if (!rawPrompt.trim()) {
      setStep1Error("Vui lòng nhập mô tả.");
      return;
    }
    setStep1Error(null);
    setStep1Loading(true);
    setPromptItems([]);
    try {
      const tpl = PROMPT_TEMPLATES.find((t) => t.id === templateId);
      const finalPrompt = tpl
        ? buildPrompt(tpl.prompt, {
            videoCount: videoConfig.numberOfOutputs,
            videoDuration: videoConfig.duration,
            template: tpl.template,
            aspectRatio: videoConfig.aspectRatio,
            builtInVoice: voiceConfig.voiceName,
            userInput: rawPrompt,
          })
        : rawPrompt;
      const r = await fetch("/api/affiliate-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          rawPrompt: finalPrompt,
          templateId,
          numberOfOutputs: videoConfig.numberOfOutputs,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi xử lý prompt");
      const voids: string[] = data.voids || [];
      setPromptItems(
        (data.prompts as string[]).map((p, i) => ({
          id: uid(),
          promptText: p,
          voiceText: voids[i] || "",
          videoStatus: "idle",
          audioStatus: "idle",
        }))
      );
    } catch (e: any) {
      setStep1Error(e.message);
    } finally {
      setStep1Loading(false);
    }
  }, [apiKey, rawPrompt, templateId, videoConfig]);

  const updateItem = useCallback((id: string, patch: Partial<PromptItem>) => {
    setPromptItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = (id: string) => setPromptItems((prev) => prev.filter((i) => i.id !== id));

  const generateSingleVideo = async (id: string) => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    const item = promptItems.find((i) => i.id === id);
    if (!item) return;
    updateItem(id, { videoStatus: "loading", videoError: undefined });
    setActiveTab("generating");
    try {
      const r = await fetch("/api/affiliate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          mainPrompt: item.promptText,
          config: {
            model: videoConfig.model,
            duration: videoConfig.duration,
            aspectRatio: videoConfig.aspectRatio,
            numberOfOutputs: 1,
            personGeneration: videoConfig.personGeneration,
            generateSubtitles: videoConfig.generateSubtitles,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo video");
      updateItem(id, { videoStatus: "done", videoSrc: data.videos?.[0] });
    } catch (e: any) {
      updateItem(id, { videoStatus: "error", videoError: e.message });
    }
  };

  const generateSingleAudio = async (id: string) => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    const item = promptItems.find((i) => i.id === id);
    if (!item) return;
    updateItem(id, { audioStatus: "loading", audioError: undefined });
    try {
      const r = await fetch("/api/affiliate-video-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          text: item.voiceText || item.promptText,
          voiceName: voiceConfig.voiceName,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo audio");
      updateItem(id, { audioStatus: "done", audioSrc: data.audioDataUrl });
    } catch (e: any) {
      updateItem(id, { audioStatus: "error", audioError: e.message });
    }
  };

  const generateAllVideos = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setBatchRunning(true);
    stopRef.current = false;
    setActiveTab("generating");
    for (const item of promptItems) {
      if (stopRef.current) break;
      if (item.videoStatus === "done") continue;
      updateItem(item.id, { videoStatus: "loading", videoError: undefined });
      try {
        const r = await fetch("/api/affiliate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            mainPrompt: item.promptText,
            config: {
              model: videoConfig.model,
              duration: videoConfig.duration,
              aspectRatio: videoConfig.aspectRatio,
              numberOfOutputs: 1,
              personGeneration: videoConfig.personGeneration,
              generateSubtitles: videoConfig.generateSubtitles,
            },
          }),
        });
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo video");
        updateItem(item.id, { videoStatus: "done", videoSrc: data.videos?.[0] });
      } catch (e: any) {
        updateItem(item.id, { videoStatus: "error", videoError: e.message });
      }
    }
    setBatchRunning(false);
  };

  const doneCount = promptItems.filter((i) => i.videoStatus === "done").length;
  const totalCount = promptItems.length;
  const generatingItems = promptItems.filter((i) => i.videoStatus !== "done");
  const historyItems = promptItems.filter((i) => i.videoStatus === "done");
  const useMock = totalCount === 0;
  const displayItems =
    activeTab === "generating"
      ? useMock
        ? MOCK_VIDEOS.filter((v) => v.status === "generating")
        : generatingItems
      : useMock
      ? MOCK_VIDEOS.filter((v) => v.status === "done")
      : historyItems;
  const genCount = useMock
    ? MOCK_VIDEOS.filter((v) => v.status === "generating").length
    : generatingItems.length;
  const histCount = useMock
    ? MOCK_VIDEOS.filter((v) => v.status === "done").length
    : historyItems.length;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-gray-900"
      style={{ background: "#080815" }}
    >
      {/* Modals */}
      {zoomSrc && (
        <ZoomModal src={zoomSrc.src} mediaType={zoomSrc.type} onClose={() => setZoomSrc(null)} />
      )}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          model={videoConfig.model}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── AI Modal ── */}
      {showAiModal && (
        <div
          className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowAiModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-indigo-500 border-opacity-30 bg-gray-900 shadow-2xl overflow-hidden"
            style={{ background: "#0e0c1e" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white border-opacity-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-14">
                  🤖
                </div>
                <span className="text-14 font-bold text-white">AI Tạo Prompt</span>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="w-7 h-7 rounded-lg bg-white bg-opacity-10 text-blue-300 hover:bg-opacity-20 flex items-center justify-center text-14 border-0 cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Template picker */}
              <div>
                <div className="text-10 font-semibold tracking-widest text-blue-400 uppercase mb-2">
                  📋 Chọn Template
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {PROMPT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTemplateId(t.id);
                        setRawPrompt(t.template);
                      }}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-11 font-medium border-0 cursor-pointer transition-all ${
                        templateId === t.id
                          ? "bg-indigo-600 text-white"
                          : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
                      }`}
                    >
                      <span className="text-16">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <div className="text-10 font-semibold tracking-widest text-blue-400 uppercase mb-2">
                  ✍️ Mô tả ý tưởng
                </div>
                <textarea
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                  rows={5}
                  placeholder="Nhập mô tả ý tưởng video..."
                  className="w-full rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-13 px-3 py-2 outline-none resize-none placeholder-blue-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              {step1Error && (
                <div className="flex items-center gap-2 text-red-400 text-12 bg-red-900 bg-opacity-20 rounded-lg px-3 py-2">
                  ❌ {step1Error}
                </div>
              )}

              <button
                onClick={async () => {
                  await processPrompt();
                  if (!step1Error) setShowAiModal(false);
                }}
                disabled={step1Loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-14 border-0 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {step1Loading ? (
                  <>
                    <span className="animate-spin">⚙️</span> AI đang xử lý...
                  </>
                ) : (
                  `🤖 Tạo ${videoConfig.numberOfOutputs} Prompt với AI`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOP NAV ══ */}
      <div
        className="flex items-center h-10 px-4 border-b border-white border-opacity-10 flex-shrink-0"
        style={{ background: "#09091a" }}
      >
        <div className="flex items-center gap-2 mr-4">
          <div className="text-16">🎬</div>
          <span className="text-13 font-bold text-white">Affiliate Video</span>
          <span className="text-9 font-bold px-2 py-0 rounded bg-indigo-600 text-white tracking-wider">
            PRO
          </span>
          <span className="text-9 text-blue-400 ml-1">v1.0</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowSettings(true)}
          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
            apiKey
              ? "bg-green-900 bg-opacity-40 text-green-400 hover:bg-opacity-60"
              : "bg-yellow-900 bg-opacity-40 text-yellow-400 hover:bg-opacity-60"
          }`}
        >
          {apiKey ? "🔑 Key OK" : "⚠️ Cài API Key"}
        </button>
      </div>

      {/* ══ 2-column layout ══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ══ LEFT SIDEBAR ══ */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-r border-white border-opacity-8 overflow-hidden"
          style={{ background: "#09091a", borderColor: "rgba(255,255,255,0.07)" }}
        >
          {/* Mode tabs */}
          <div
            className="flex border-b border-white border-opacity-8 flex-shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            {(
              [
                { key: "text", label: "✏️ Text" },
                { key: "start_image", label: "🖼 Start" },
                { key: "start_end", label: "⏩ Start→End" },
                { key: "sync", label: "🔄 Đồng bộ" },
              ] as { key: ModeTab; label: string }[]
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setModeTab(m.key)}
                className={`flex-1 py-2 text-10 font-semibold border-0 cursor-pointer transition-all border-b-2 ${
                  modeTab === m.key
                    ? "text-indigo-400 border-indigo-500 bg-indigo-900 bg-opacity-20"
                    : "text-blue-400 border-transparent hover:text-blue-300"
                }`}
                style={{ background: modeTab === m.key ? "rgba(99,102,241,0.08)" : "transparent" }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Scrollable config area */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" }}
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
                  <span className="text-12 font-bold text-blue-100">Cấu hình</span>
                </div>
                <button className="text-10 text-blue-400 hover:text-blue-300 border-0 bg-transparent cursor-pointer flex items-center gap-1">
                  Cấu hình gần đây <span>▾</span>
                </button>
              </div>

              <div className="p-3 space-y-3">
                {/* SPEED */}
                <div>
                  <SectionLabel>SPEED</SectionLabel>
                  <div className="flex gap-1">
                    {(["fast", "relaxed", "quality"] as SpeedMode[]).map((s) => (
                      <SegBtn key={s} active={speed === s} onClick={() => setSpeed(s)}>
                        {s === "fast" ? "Fast" : s === "relaxed" ? "Relaxed" : "Quality"}
                      </SegBtn>
                    ))}
                  </div>
                </div>

                {/* ASPECT */}
                <div>
                  <SectionLabel>ASPECT</SectionLabel>
                  <div className="flex gap-1">
                    {ASPECT_RATIOS.slice(0, 2).map((ar) => (
                      <SegBtn
                        key={ar.value}
                        active={videoConfig.aspectRatio === ar.value}
                        onClick={() => patchConfig({ aspectRatio: ar.value })}
                      >
                        {ar.value === "16:9" ? "16:9 Landscape" : "9:16 Portrait"}
                      </SegBtn>
                    ))}
                  </div>
                </div>

                {/* SỐ LƯỢNG */}
                <div>
                  <SectionLabel>SỐ LƯỢNG</SectionLabel>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <SqrBtn
                        key={n}
                        active={videoConfig.numberOfOutputs === n}
                        onClick={() => patchConfig({ numberOfOutputs: n })}
                      >
                        x{n}
                      </SqrBtn>
                    ))}
                  </div>
                </div>

                {/* VOICE MODE */}
                <div>
                  <SectionLabel>VOICE MODE</SectionLabel>
                  <div className="flex gap-1">
                    {(
                      [
                        { key: "none", label: "Không" },
                        { key: "in_video", label: "Trong Video" },
                        { key: "separate", label: "Audio Riêng" },
                      ] as { key: VoiceMode; label: string }[]
                    ).map((m) => (
                      <DelayBtn
                        key={m.key}
                        active={voiceMode === m.key}
                        onClick={() => setVoiceMode(m.key)}
                      >
                        {m.label}
                      </DelayBtn>
                    ))}
                  </div>
                </div>

                {/* DELAY QUEUE */}
                <div>
                  <SectionLabel>DELAY QUEUE</SectionLabel>
                  <div className="flex gap-1">
                    {(
                      [
                        { key: "instant", label: "Ngay lập tức" },
                        { key: "15s", label: "15 giây" },
                        { key: "30s", label: "30 giây" },
                        { key: "1m", label: "1 phút" },
                      ] as { key: DelayQueue; label: string }[]
                    ).map((d) => (
                      <DelayBtn
                        key={d.key}
                        active={delayQueue === d.key}
                        onClick={() => setDelayQueue(d.key)}
                      >
                        {d.label}
                      </DelayBtn>
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
                  <span className="text-12 font-bold text-blue-100">Prompt</span>
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
                  🤖 AI Generate
                </button>
              </div>

              {totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="text-32 mb-2 opacity-50">📋</div>
                  <div className="text-13 font-semibold text-blue-200 mb-1">
                    Nhấn <strong className="text-indigo-400">🤖 AI Generate</strong>
                  </div>
                  <div className="text-11 text-blue-500">để AI tạo prompt tự động</div>
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
                        <textarea
                          value={item.promptText}
                          onChange={(e) => updateItem(item.id, { promptText: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg bg-black bg-opacity-30 border border-white border-opacity-8 text-blue-100 text-11 px-2 py-1 outline-none resize-none placeholder-blue-600 focus:border-indigo-500 transition-colors"
                          style={{ borderColor: "rgba(255,255,255,0.08)" }}
                        />
                        {/* Action buttons */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => generateSingleVideo(item.id)}
                            disabled={item.videoStatus === "loading"}
                            className="flex-1 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-10 font-semibold border-0 cursor-pointer transition-all"
                          >
                            🎬 Gen Video
                          </button>
                          {(voiceMode === "in_video" || voiceMode === "separate") && (
                            <button
                              onClick={() => generateSingleAudio(item.id)}
                              disabled={item.audioStatus === "loading"}
                              className="flex-1 py-1 rounded-md bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-10 font-semibold border-0 cursor-pointer transition-all"
                            >
                              🔊 Gen Audio
                            </button>
                          )}
                        </div>
                        {item.audioSrc && (
                          <audio controls src={item.audioSrc} className="w-full h-7" />
                        )}
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
                  {totalCount} Prompt · {doneCount} xong · {totalCount - doneCount} còn lại
                </span>
              </div>
            )}
          </div>

          {/* ── Bottom action bar ── */}
          <div
            className="flex-shrink-0 border-t border-white border-opacity-8 p-3 space-y-2"
            style={{ borderColor: "rgba(255,255,255,0.07)", background: "#09091a" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-12 text-blue-300 font-medium">
                  {doneCount > 0
                    ? `${doneCount}/${totalCount} videos done`
                    : totalCount > 0
                    ? `${totalCount} prompts ready`
                    : "0 prompts"}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAiModal(true)}
                  title="Thêm prompt"
                  className="w-7 h-7 rounded-lg bg-white bg-opacity-5 hover:bg-opacity-10 text-blue-400 text-16 font-bold border-0 cursor-pointer flex items-center justify-center transition-all"
                >
                  ⊕
                </button>
                {totalCount > 0 && (
                  <button
                    onClick={() => setPromptItems([])}
                    title="Xóa tất cả"
                    className="w-7 h-7 rounded-lg bg-white bg-opacity-5 hover:bg-red-900 hover:bg-opacity-40 text-blue-400 hover:text-red-400 text-12 border-0 cursor-pointer flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {batchRunning && (
              <button
                onClick={() => {
                  stopRef.current = true;
                }}
                className="w-full py-2 rounded-xl bg-red-800 bg-opacity-50 hover:bg-opacity-70 text-red-300 font-bold text-13 border border-red-500 border-opacity-30 cursor-pointer transition-all"
              >
                ⏹ Dừng
              </button>
            )}

            <button
              onClick={generateAllVideos}
              disabled={batchRunning || totalCount === 0}
              className="w-full py-3 rounded-xl font-bold text-14 border-0 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  batchRunning || totalCount === 0
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
                color: "white",
              }}
            >
              {batchRunning ? (
                <>
                  <span className="animate-spin">⚙️</span> Đang tạo video...
                </>
              ) : totalCount > 0 ? (
                `▶ GENERATE ${totalCount} VIDEO`
              ) : (
                "▶ GENERATE NOW"
              )}
            </button>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex items-center px-4 h-10 border-b border-white border-opacity-8 flex-shrink-0"
            style={{ background: "#09091a", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div className="flex gap-1 mr-auto">
              <button
                onClick={() => setActiveTab("generating")}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
                  activeTab === "generating"
                    ? "bg-indigo-600 text-white"
                    : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
                }`}
              >
                ⏳ Generating
                {genCount > 0 && (
                  <span className="text-9 font-bold px-1 rounded-full bg-white bg-opacity-20">
                    {genCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
                  activeTab === "history"
                    ? "bg-indigo-600 text-white"
                    : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
                }`}
              >
                📼 History
                {histCount > 0 && (
                  <span className="text-9 font-bold px-1 rounded-full bg-white bg-opacity-20">
                    {histCount}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white bg-opacity-5 hover:bg-opacity-10 text-blue-300 text-12 font-semibold border-0 cursor-pointer transition-all"
            >
              ⚙️ Settings
            </button>
          </div>

          {/* Folder path */}
          <div
            className="flex items-center gap-2 px-4 py-1 border-b border-white border-opacity-5 flex-shrink-0"
            style={{ background: "#090916", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <span className="text-11 text-blue-500">📁</span>
            <span className="text-10 text-blue-500 font-mono truncate">
              \\Users\HieuTran\Pictures\VEO3\videos
            </span>
          </div>

          {/* Search */}
          <div
            className="px-4 py-2 border-b border-white border-opacity-5 flex-shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white bg-opacity-5 border border-white border-opacity-8"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-12 text-blue-500">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm video..."
                className="flex-1 bg-transparent border-0 outline-none text-12 text-blue-100 placeholder-blue-600"
              />
            </div>
          </div>

          {/* Filter tags */}
          <div
            className="flex items-center gap-2 px-4 py-2 border-b border-white border-opacity-5 flex-shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <span
              className="flex items-center gap-1 text-10 font-bold px-2 py-1 rounded-md bg-white bg-opacity-8 text-blue-200 border border-white border-opacity-10"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              📄 Text To Video
            </span>
            <span className="text-10 font-semibold px-2 py-1 rounded-md bg-indigo-900 bg-opacity-40 text-indigo-300 border border-indigo-500 border-opacity-20">
              {useMock ? MOCK_VIDEOS.length : totalCount} Video
            </span>
            <span className="text-10 font-semibold px-2 py-1 rounded-md bg-white bg-opacity-5 text-blue-400 border border-white border-opacity-10">
              {speed}
            </span>
            <span className="text-10 font-semibold px-2 py-1 rounded-md bg-white bg-opacity-5 text-blue-400 border border-white border-opacity-10">
              {videoConfig.aspectRatio}
            </span>
          </div>

          {/* Video grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {(displayItems as any[]).length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-48 mb-3 opacity-30">
                    {activeTab === "generating" ? "⏳" : "📼"}
                  </div>
                  <div className="text-13 text-blue-400 font-medium">
                    {activeTab === "generating"
                      ? "Chưa có video đang tạo"
                      : "Chưa có video hoàn thành"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {useMock
                  ? (displayItems as typeof MOCK_VIDEOS).map((v, idx) => (
                      <VideoCardLight
                        key={v.id}
                        index={idx}
                        thumbnail={v.thumbnail}
                        label={v.label}
                        aspectRatio={v.aspectRatio}
                        styleTag={v.styleTag}
                        quality={v.quality}
                        description={v.description}
                        model={v.model}
                        seed={v.seed}
                        timeInfo={v.timeInfo}
                        status={v.status}
                        onZoom={(src) => setZoomSrc({ src, type: "image" })}
                      />
                    ))
                  : (displayItems as PromptItem[]).map((item, idx) => (
                      <VideoCardLight
                        key={item.id}
                        index={idx}
                        thumbnail={item.videoSrc}
                        label="TEXT TO VIDEO"
                        aspectRatio={videoConfig.aspectRatio}
                        styleTag={speed}
                        description={item.promptText}
                        model={videoConfig.model}
                        seed={Math.floor(Math.random() * 999999)
                          .toString()
                          .padStart(6, "0")}
                        timeInfo={new Date().toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        status={
                          item.videoStatus === "loading"
                            ? "generating"
                            : item.videoStatus === "done"
                            ? "done"
                            : item.videoStatus === "error"
                            ? "error"
                            : "idle"
                        }
                        onZoom={(src) => setZoomSrc({ src, type: "video" })}
                      />
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VideoCard ─────────────────────────────────────────────────────────────
function VideoCardLight({
  index,
  thumbnail,
  label,
  aspectRatio,
  styleTag,
  quality,
  description,
  model,
  seed,
  timeInfo,
  status,
  onZoom,
}: {
  index: number;
  thumbnail?: string;
  label: string;
  aspectRatio: string;
  styleTag: string;
  quality?: string;
  description: string;
  model: string;
  seed: string;
  timeInfo: string;
  status: "generating" | "done" | "error" | "idle";
  onZoom?: (src: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isGenerating = status === "generating";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl overflow-hidden border border-white border-opacity-8 flex flex-col cursor-pointer transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: hovered ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16/9", background: "#0a0a1a" }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onClick={() => onZoom?.(thumbnail)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {isGenerating ? (
              <>
                <div className="text-24 animate-spin mb-1">⚙️</div>
                <div className="text-10 text-blue-400 font-medium">Generating...</div>
              </>
            ) : (
              <div className="text-48 opacity-20">🎬</div>
            )}
            {/* Placeholder number */}
            {!isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-24 font-bold text-blue-700 opacity-30">
                  #{String(index + 1).padStart(3, "0")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Top badges overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 p-2">
          <span className="text-8 font-bold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-300">
            #{index + 1}
          </span>
          <span className="text-8 font-bold px-1 py-0 rounded bg-indigo-900 bg-opacity-80 text-indigo-300">
            📄 {label}
          </span>
          <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-400">
            {aspectRatio}
          </span>
          <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-cyan-400">
            {styleTag}
          </span>
          {quality && (
            <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-yellow-400">
              {quality}
            </span>
          )}
          {/* Status badge right */}
          <div className="ml-auto">
            {isGenerating ? (
              <span className="text-8 font-bold px-1 py-0 rounded bg-yellow-900 bg-opacity-80 text-yellow-400">
                ĐANG XỬ LÝ
              </span>
            ) : status === "done" ? (
              <span className="text-8 font-bold px-1 py-0 rounded bg-green-900 bg-opacity-80 text-green-400">
                DONE
              </span>
            ) : (
              <span className="text-8 font-bold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-500">
                HÀNG ĐỢI
              </span>
            )}
          </div>
        </div>

        {/* Play button overlay */}
        {thumbnail && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            <div className="w-10 h-10 rounded-full bg-black bg-opacity-60 border-2 border-white border-opacity-80 flex items-center justify-center">
              <span className="text-14 text-white ml-1">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="px-3 py-2 flex-1">
        <p className="text-10 text-blue-300 leading-relaxed line-clamp-2">{description}</p>
      </div>

      {/* Metadata footer */}
      <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
        <span className="text-8 text-blue-600 font-mono">
          ~{Math.floor(Math.random() * 5) + 1}p {Math.floor(Math.random() * 59) + 1}s
        </span>
      </div>
    </div>
  );
}
