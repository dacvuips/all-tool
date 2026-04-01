/**
 * AI Affiliate Video Workshop – affiliate-video.tsx
 * Hybrid: Tailwind v2.2 className cho layout, style= cho màu/opacity/size tuỳ chỉnh
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  BatchActionBar, PromptResultCard, PromptTemplateSelector,
  SettingsModal, VoiceSelector, ZoomModal,
} from "../../components/app/affiliate-video/components";
import {
  ASPECT_RATIOS, btn, card, CSS, DEFAULT_VIDEO_CONFIG, DEFAULT_VOICE_CONFIG,
  DURATION_OPTIONS, PROMPT_TEMPLATES, PromptItem, VideoConfig, VoiceConfig,
  buildPrompt, uid,
} from "../../components/app/affiliate-video/constants";

export default function AffiliateVideo() {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(DEFAULT_VIDEO_CONFIG);
  const patchConfig = (patch: Partial<VideoConfig>) => setVideoConfig((c) => ({ ...c, ...patch }));
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [templateId, setTemplateId] = useState("affiliate_review");
  const [rawPrompt, setRawPrompt] = useState(PROMPT_TEMPLATES[0].template);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState<{ src: string; type: "image" | "video" } | null>(null);

  useEffect(() => {
    const k = localStorage.getItem("avid-api-key"); if (k) setApiKey(k);
    const m = localStorage.getItem("avid-model"); if (m) patchConfig({ model: m });
  }, []);

  const saveSettings = (k: string, m: string) => {
    setApiKey(k); patchConfig({ model: m });
    localStorage.setItem("avid-api-key", k); localStorage.setItem("avid-model", m);
  };

  const processPrompt = useCallback(async () => {
    if (!apiKey) { setShowSettings(true); return; }
    if (!rawPrompt.trim()) { setStep1Error("Vui lòng nhập mô tả sản phẩm / ý tưởng."); return; }
    setStep1Error(null); setStep1Loading(true); setPromptItems([]);
    try {
      const tpl = PROMPT_TEMPLATES.find((t) => t.id === templateId);
      const finalPrompt = tpl ? buildPrompt(tpl.prompt, { videoCount: videoConfig.numberOfOutputs, videoDuration: videoConfig.duration, template: tpl.template, aspectRatio: videoConfig.aspectRatio, builtInVoice: voiceConfig.voiceName, userInput: rawPrompt }) : rawPrompt;
      const r = await fetch("/api/affiliate-video-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, rawPrompt: finalPrompt, templateId, numberOfOutputs: videoConfig.numberOfOutputs }) });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi xử lý prompt");
      const voids: string[] = data.voids || [];
      setPromptItems((data.prompts as string[]).map((p, i) => ({ id: uid(), promptText: p, voiceText: voids[i] || "", videoStatus: "idle", audioStatus: "idle" })));
    } catch (e: any) { setStep1Error(e.message); } finally { setStep1Loading(false); }
  }, [apiKey, rawPrompt, templateId, videoConfig.numberOfOutputs]);

  const updateItem = useCallback((id: string, patch: Partial<PromptItem>) => {
    setPromptItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const currentTemplate = PROMPT_TEMPLATES.find((t) => t.id === templateId);

  return (
    <div style={{ minHeight: "100vh", background: CSS.gradBg, fontFamily: "'Inter', -apple-system, sans-serif", color: CSS.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        textarea, input, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 99px; }
        input[type=range] { accent-color: #6366f1; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease both; }
        .spin { animation: spin 1s linear infinite; display:inline-block; }
      `}</style>

      {zoomSrc && <ZoomModal src={zoomSrc.src} mediaType={zoomSrc.type} onClose={() => setZoomSrc(null)} />}
      {showSettings && <SettingsModal apiKey={apiKey} model={videoConfig.model} onSave={saveSettings} onClose={() => setShowSettings(false)} />}

      {/* ── Header ── */}
      <div style={{ ...card({ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", padding: "12px 24px" }), position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: 16 }}>
        <div className="flex items-center gap-3 flex-1">
          <span style={{ fontSize: 28 }}>🎬</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, background: CSS.gradAccent, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Affiliate Video Workshop
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: CSS.textMuted }}>AI Prompt → Veo 3 · OpenAI / Gemini</p>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} title={apiKey ? "API key đã cài" : "Cần cài API key"}
          style={btn({ padding: "8px 14px", fontSize: 12, background: apiKey ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", border: apiKey ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(239,68,68,0.4)", color: apiKey ? "#10b981" : "#ef4444" })}>
          {apiKey ? "🔑 Key OK" : "⚠️ Cài API Key"}
        </button>
      </div>

      {/* ── Main ── */}
      <div style={{ padding: 14, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* STEP 1 */}
        <div style={card({ padding: 16 })}>
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: "50%", background: CSS.gradAccent, fontSize: 13, fontWeight: 800, color: "#fff" }}>1</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Nhập ý tưởng → AI xử lý prompt</div>
              <div style={{ fontSize: 11, color: CSS.textMuted }}>AI sẽ tạo {videoConfig.numberOfOutputs} prompt chuyên sâu từ mô tả của bạn</div>
            </div>
          </div>

          {/* Two-column */}
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, alignItems: "start" }}>

            {/* LEFT: Config */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", borderRadius: CSS.radiusSm, background: "rgba(255,255,255,0.02)", border: CSS.border }}>

              {/* Video Count */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CSS.textSecondary, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>🎞 Số lượng video</span>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <button key={n} onClick={() => patchConfig({ numberOfOutputs: n })}
                      style={btn({ width: 32, height: 28, padding: 0, fontSize: 11, background: videoConfig.numberOfOutputs === n ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: videoConfig.numberOfOutputs === n ? "#fff" : CSS.textMuted, border: videoConfig.numberOfOutputs === n ? "none" : CSS.border, borderRadius: 6 })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CSS.textSecondary, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>⏱ Thời lượng video</span>
                <div className="flex flex-wrap gap-1">
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d} onClick={() => patchConfig({ duration: d })}
                      style={btn({ padding: "4px 9px", fontSize: 11, background: videoConfig.duration === d ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: videoConfig.duration === d ? "#fff" : CSS.textMuted, border: videoConfig.duration === d ? "none" : CSS.border, borderRadius: 6 })}>
                      {d}s{d === 8 ? " ★" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CSS.textSecondary, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>📐 Tỷ lệ khung hình</span>
                <div className="flex flex-wrap gap-1">
                  {ASPECT_RATIOS.map((ar) => (
                    <button key={ar.value} onClick={() => patchConfig({ aspectRatio: ar.value })}
                      style={btn({ padding: "4px 9px", fontSize: 11, background: videoConfig.aspectRatio === ar.value ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: videoConfig.aspectRatio === ar.value ? "#fff" : CSS.textMuted, border: videoConfig.aspectRatio === ar.value ? "none" : CSS.border, borderRadius: 6 })}>
                      {ar.icon} {ar.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality + Person */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CSS.textSecondary, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>⚙️ Chất lượng &amp; Người</span>
                <div className="flex gap-1" style={{ marginBottom: 5 }}>
                  {(["standard", "high"] as const).map((q) => (
                    <button key={q} onClick={() => patchConfig({ quality: q })}
                      style={btn({ flex: 1, padding: "4px 0", fontSize: 11, background: videoConfig.quality === q ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: videoConfig.quality === q ? "#fff" : CSS.textMuted, border: videoConfig.quality === q ? "none" : CSS.border, borderRadius: 6 })}>
                      {q === "standard" ? "Standard" : "✨ High"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {([["allow_adult", "✅ Người thật"], ["dont_allow", "🚫 Không"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => patchConfig({ personGeneration: v })}
                      style={btn({ flex: 1, padding: "4px 0", fontSize: 11, background: videoConfig.personGeneration === v ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)", color: videoConfig.personGeneration === v ? CSS.accent : CSS.textMuted, border: videoConfig.personGeneration === v ? CSS.borderAccent : CSS.border, borderRadius: 6 })}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitles + Voice */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CSS.textSecondary, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>💬 Phụ đề &amp; 🎙 Giọng</span>
                <div className="flex items-center gap-1" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: CSS.textMuted, flexShrink: 0 }}>Phụ đề:</span>
                  <button onClick={() => patchConfig({ generateSubtitles: !videoConfig.generateSubtitles })}
                    style={btn({ padding: "4px 10px", fontSize: 11, background: videoConfig.generateSubtitles ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)", color: videoConfig.generateSubtitles ? CSS.accent : CSS.textMuted, border: videoConfig.generateSubtitles ? CSS.borderAccent : CSS.border, borderRadius: 6 })}>
                    {videoConfig.generateSubtitles ? "✅ Bật" : "○ Tắt"}
                  </button>
                </div>
                <VoiceSelector value={voiceConfig} onChange={setVoiceConfig} />
              </div>
            </div>

            {/* RIGHT: Prompt + Action */}
            <div className="flex flex-col gap-3">
              <PromptTemplateSelector value={templateId} onChange={(id) => { setTemplateId(id); const tpl = PROMPT_TEMPLATES.find((t) => t.id === id); if (tpl) setRawPrompt(tpl.template); }} />

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: CSS.textSecondary, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>✍️ Mô tả sản phẩm / ý tưởng</span>
                <textarea value={rawPrompt} onChange={(e) => setRawPrompt(e.target.value)} rows={4} placeholder={currentTemplate?.placeholder || "Nhập mô tả ý tưởng video..."}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: CSS.radiusSm, border: CSS.border, background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", minHeight: 160, lineHeight: 1.6, transition: "border 0.2s" }}
                  onFocus={(e) => (e.currentTarget.style.border = CSS.borderAccent)}
                  onBlur={(e) => (e.currentTarget.style.border = CSS.border)} />
              </div>

              <button onClick={processPrompt} disabled={step1Loading}
                style={btn({ width: "100%", padding: "14px 0", fontSize: 14, background: step1Loading ? "rgba(99,102,241,0.3)" : CSS.gradAccent, color: "#fff", opacity: step1Loading ? 0.8 : 1, boxShadow: step1Loading ? "none" : CSS.shadowAccent, borderRadius: CSS.radiusSm, letterSpacing: "0.02em" })}>
                {step1Loading ? <><span className="spin">⚙️</span> AI đang xử lý prompt...</> : `🤖 Xử lý với AI → Tạo ${videoConfig.numberOfOutputs} Prompt`}
              </button>

              {step1Error && (
                <div style={{ padding: "10px 14px", borderRadius: CSS.radiusSm, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
                  ❌ {step1Error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        {promptItems.length > 0 && (
          <div className="fade-in flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#06b6d4,#6366f1)", fontSize: 13, fontWeight: 800, color: "#fff" }}>2</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Tạo Video &amp; Audio cho từng prompt</div>
                <div style={{ fontSize: 11, color: CSS.textMuted }}>{promptItems.length} prompt · Click vào text để chỉnh sửa</div>
              </div>
            </div>
            <BatchActionBar items={promptItems} videoConfig={videoConfig} apiKey={apiKey} voiceName={voiceConfig.voiceName || "Aoede"} onUpdateItem={updateItem} />
            {promptItems.map((item, idx) => (
              <div key={item.id} className="fade-in" style={{ animationDelay: `${idx * 0.06}s` }}>
                <PromptResultCard item={item} index={idx} videoConfig={videoConfig} apiKey={apiKey} voiceName={voiceConfig.voiceName || "Aoede"} onUpdate={(patch) => updateItem(item.id, patch)} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {promptItems.length === 0 && !step1Loading && (
          <div style={{ ...card({ padding: 16 }), minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: CSS.textMuted }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CSS.textSecondary, marginBottom: 8 }}>Bắt đầu tạo nội dung AI</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 360 }}>
                Chọn template → Nhập ý tưởng → Nhấn <strong style={{ color: CSS.accent }}>Xử lý với AI</strong> để tạo {videoConfig.numberOfOutputs} prompt chuyên nghiệp
              </div>
              <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 20 }}>
                {PROMPT_TEMPLATES.slice(0, 4).map((t) => (
                  <span key={t.id} onClick={() => setTemplateId(t.id)}
                    style={{ padding: "6px 14px", borderRadius: 99, background: templateId === t.id ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)", border: templateId === t.id ? CSS.borderAccent : CSS.border, color: templateId === t.id ? CSS.accent : CSS.textSecondary, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    {t.icon} {t.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {step1Loading && (
          <div style={{ ...card({ padding: 16 }), minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: CSS.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}><span className="spin">🤖</span></div>
              <div style={{ fontSize: 15, color: CSS.textSecondary, fontWeight: 600 }}>AI đang phân tích và tạo prompt...</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Thường mất 5–15 giây</div>
              <div className="flex justify-center gap-1" style={{ marginTop: 16 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: CSS.accent, opacity: 0.4, animation: `spin 1.2s ease ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
