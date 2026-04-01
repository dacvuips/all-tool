/**
 * affiliate-video/components.tsx
 * Hybrid: Tailwind v2.2 className cho layout, style= cho màu/opacity/size tuỳ chỉnh
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  btn, BUILTIN_VOICES, card, CSS,
  DialogueLine, ItemRole, makeDialogueLine, makeMediaItem,
  MediaItem, MediaType, OpStatus, PROMPT_TEMPLATES, PromptItem,
  STYLE_GALLERY, uid, VIDEO_MODELS, VideoConfig, VoiceConfig,
} from "./constants";

/* ═══════════════════════════════════════════════════════════ ZoomModal */
interface ZoomModalProps { src: string; mediaType?: MediaType; onClose: () => void; }

export function ZoomModal({ src, mediaType = "image", onClose }: ZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(8, Math.max(0.3, s - e.deltaY * 0.002)));
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.95)", cursor: "grab" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onMouseDown={(e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        setOffset((o) => ({ x: o.x + e.clientX - lastPos.current.x, y: o.y + e.clientY - lastPos.current.y }));
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={() => { dragging.current = false; }}
      onWheel={onWheel}
    >
      {mediaType === "video" ? (
        <video src={src} controls autoPlay style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16, transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})` }} />
      ) : (
        <img src={src} draggable={false} style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16, transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`, userSelect: "none", pointerEvents: "none" }} alt="" />
      )}
      <div className="fixed bottom-6 flex gap-2" style={{ left: "50%", transform: "translateX(-50%)" }}>
        {[
          { l: "🔍+", fn: () => setScale((s) => Math.min(8, s + 0.4)) },
          { l: "🔍−", fn: () => setScale((s) => Math.max(0.3, s - 0.4)) },
          { l: "↺", fn: () => { setScale(1); setOffset({ x: 0, y: 0 }); } },
          { l: "✕", fn: onClose },
        ].map((b) => (
          <button key={b.l} onClick={b.fn} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 10, padding: "8px 18px", cursor: "pointer", fontSize: 14, backdropFilter: "blur(12px)", fontWeight: 600 }}>
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ SettingsModal */
export function SettingsModal({ apiKey, model, onSave, onClose }: { apiKey: string; model: string; onSave: (k: string, m: string) => void; onClose: () => void; }) {
  const [keyVal, setKeyVal] = useState(apiKey);
  const [modelVal, setModelVal] = useState(model || VIDEO_MODELS[0].value);
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 8888, background: "rgba(0,0,0,0.75)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "linear-gradient(135deg,#0e0e1f,#141430)", border: CSS.borderAccent, borderRadius: 20, padding: 32, width: 520, boxShadow: CSS.shadowAccent }}>
        <h2 style={{ color: "#fff", margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>⚙️ Cài đặt API</h2>
        <p style={{ color: CSS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>Cài đặt lưu trong trình duyệt, không gửi lên server.</p>
        <label style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>API Key (OpenAI hoặc Gemini)</label>
        <input type="password" value={keyVal} onChange={(e) => setKeyVal(e.target.value)} placeholder="sk-... hoặc AIza..." onKeyDown={(e) => e.key === "Enter" && (onSave(keyVal, modelVal), onClose())} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: CSS.borderAccent, borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }} />
        <p style={{ color: CSS.textMuted, fontSize: 11, marginTop: 6 }}>
          🔹 OpenAI <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: CSS.accent }}>platform.openai.com</a>
          {" · "}🔹 Gemini <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: CSS.accent }}>aistudio.google.com</a>
        </p>
        <label style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600, display: "block", marginTop: 18 }}>Model Video</label>
        <select value={modelVal} onChange={(e) => setModelVal(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: CSS.borderAccent, borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", cursor: "pointer" }}>
          {VIDEO_MODELS.map((m) => <option key={m.value} value={m.value} style={{ background: "#0e0e1f" }}>{m.label}</option>)}
        </select>
        <div className="flex gap-3 mt-6">
          <button onClick={() => { onSave(keyVal, modelVal); onClose(); }} style={btn({ flex: 1, padding: "12px 0", background: CSS.gradAccent, color: "#fff", fontSize: 14, borderRadius: 10 })}>💾 Lưu</button>
          <button onClick={onClose} style={btn({ padding: "12px 24px", border: CSS.border, background: "transparent", color: CSS.textSecondary, fontSize: 14, borderRadius: 10 })}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ PromptTemplateSelector */
interface PromptTemplateSelectorProps { value: string; onChange: (id: string) => void; }
export function PromptTemplateSelector({ value, onChange }: PromptTemplateSelectorProps) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: CSS.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>📋 Chọn Template</div>
      <div className="grid grid-cols-4 gap-1">
        {PROMPT_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.placeholder}
            style={btn({ padding: "10px 8px", background: value === t.id ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)", border: value === t.id ? CSS.borderAccent : CSS.border, color: value === t.id ? "#fff" : CSS.textSecondary, borderRadius: CSS.radiusSm, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, lineHeight: 1.2, transition: "all 0.2s", boxShadow: value === t.id ? CSS.shadowAccent : "none" })}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VideoPlayer */
export function VideoPlayer({ src, style }: { src: string; style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  return (
    <div style={{ borderRadius: CSS.radius, overflow: "hidden", background: "#000", ...style }}>
      <video ref={videoRef} src={src} className="w-full block" style={{ maxHeight: "40vh" }}
        onTimeUpdate={() => { const v = videoRef.current; if (v) setProgress((v.currentTime / v.duration) * 100); }}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
        onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-2" style={{ padding: "8px 10px", background: "rgba(0,0,0,0.8)" }}>
        <button onClick={toggle} style={btn({ padding: "4px 10px", background: CSS.gradAccent, color: "#fff", fontSize: 14 })}>{playing ? "⏸" : "▶"}</button>
        <input type="range" value={progress} min={0} max={100} step={0.1} className="flex-1"
          onChange={(e) => { const v = videoRef.current; if (v) { v.currentTime = (parseFloat(e.target.value) / 100) * v.duration; setProgress(parseFloat(e.target.value)); } }}
          style={{ accentColor: CSS.accent } as React.CSSProperties} />
        <span style={{ fontSize: 11, color: CSS.textMuted, whiteSpace: "nowrap" }}>{fmt((progress / 100) * duration)} / {fmt(duration)}</span>
        <a href={src} download="generated-video.mp4" style={{ textDecoration: "none", color: CSS.accent, fontSize: 13 }} title="Tải video">💾</a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ StatusBadge */
function StatusBadge({ status, label }: { status: OpStatus; label: string }) {
  const cfg: Record<OpStatus, { color: string; bg: string; icon: string }> = {
    idle:    { color: CSS.textMuted, bg: "rgba(255,255,255,0.06)", icon: "○" },
    loading: { color: CSS.accentTeal, bg: "rgba(6,182,212,0.12)", icon: "⏳" },
    done:    { color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: "✅" },
    error:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "❌" },
  };
  const s = cfg[status];
  return (
    <span className="inline-flex items-center gap-1" style={{ padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700 }}>
      {s.icon} {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════ PromptResultCard */
interface PromptResultCardProps { item: PromptItem; index: number; videoConfig: VideoConfig; apiKey: string; voiceName: string; onUpdate: (patch: Partial<PromptItem>) => void; }
export function PromptResultCard({ item, index, videoConfig: defaultVideoConfig, apiKey, voiceName: defaultVoiceName, onUpdate }: PromptResultCardProps) {
  const [editing, setEditing] = useState(false);
  const [zoomVideo, setZoomVideo] = useState(false);

  const generateVideo = async () => {
    onUpdate({ videoStatus: "loading", videoError: undefined });
    try {
      const r = await fetch("/api/affiliate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, mainPrompt: item.promptText, config: { model: defaultVideoConfig.model, duration: defaultVideoConfig.duration, aspectRatio: defaultVideoConfig.aspectRatio, numberOfOutputs: 1, personGeneration: defaultVideoConfig.personGeneration, generateSubtitles: defaultVideoConfig.generateSubtitles } }) });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo video");
      onUpdate({ videoStatus: "done", videoSrc: data.videos?.[0] });
    } catch (e: any) { onUpdate({ videoStatus: "error", videoError: e.message }); }
  };

  const generateAudio = async () => {
    onUpdate({ audioStatus: "loading", audioError: undefined });
    try {
      const r = await fetch("/api/affiliate-video-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, text: item.voiceText || item.promptText, voiceName: defaultVoiceName }) });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo audio");
      onUpdate({ audioStatus: "done", audioSrc: data.audioDataUrl });
    } catch (e: any) { onUpdate({ audioStatus: "error", audioError: e.message }); }
  };

  const downloadVideo = () => { if (!item.videoSrc) return; const a = document.createElement("a"); a.href = item.videoSrc; a.download = `video-${index + 1}.mp4`; a.click(); };
  const downloadAudio = () => { if (!item.audioSrc) return; const a = document.createElement("a"); a.href = item.audioSrc; a.download = `audio-${index + 1}.wav`; a.click(); };

  return (
    <>
      {zoomVideo && item.videoSrc && <ZoomModal src={item.videoSrc} mediaType="video" onClose={() => setZoomVideo(false)} />}
      <div style={{ ...card({ padding: 16 }), display: "flex", flexDirection: "column", gap: 12, transition: "box-shadow 0.2s" }}>
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: "50%", background: CSS.gradAccent, fontSize: 12, fontWeight: 800, color: "#fff" }}>{index + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1 items-center" style={{ marginBottom: 8 }}>
              <StatusBadge status={item.videoStatus} label="Video" />
              <StatusBadge status={item.audioStatus} label="Audio" />
            </div>
            {editing ? (
              <textarea value={item.promptText} onChange={(e) => onUpdate({ promptText: e.target.value })} onBlur={() => setEditing(false)} autoFocus rows={4}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: CSS.radiusSm, border: CSS.borderAccent, background: "rgba(99,102,241,0.08)", color: "#fff", fontSize: 12, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
            ) : (
              <p onClick={() => setEditing(true)} title="Click để chỉnh sửa"
                style={{ margin: 0, fontSize: 12, color: CSS.textPrimary, lineHeight: 1.6, cursor: "text", padding: "6px 8px", borderRadius: CSS.radiusSm, border: "1px solid transparent", transition: "border 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = CSS.border)}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}>
                {item.promptText}
              </p>
            )}
          </div>
        </div>

        {/* Voice text */}
        {item.voiceText && (
          <div style={{ padding: "8px 10px", borderRadius: CSS.radiusSm, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: CSS.accentTeal, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>🗣️ Lời thoại / Voice-over</div>
            <p style={{ margin: 0, fontSize: 12, color: CSS.textSecondary, lineHeight: 1.5, fontStyle: "italic" }}>{item.voiceText}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1">
          <button onClick={generateVideo} disabled={item.videoStatus === "loading"} style={btn({ padding: "7px 12px", fontSize: 11, background: item.videoStatus === "loading" ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.2)", border: CSS.borderAccent, color: item.videoStatus === "loading" ? CSS.textMuted : CSS.accent, opacity: item.videoStatus === "loading" ? 0.7 : 1 })}>
            {item.videoStatus === "loading" ? "⏳ Đang tạo..." : "🎬 Tạo Video"}
          </button>
          <button onClick={generateAudio} disabled={item.audioStatus === "loading"} style={btn({ padding: "7px 12px", fontSize: 11, background: item.audioStatus === "loading" ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)", color: item.audioStatus === "loading" ? CSS.textMuted : CSS.accentTeal, opacity: item.audioStatus === "loading" ? 0.7 : 1 })}>
            {item.audioStatus === "loading" ? "⏳ Đang tạo..." : "🎙 Tạo Audio (Gemini)"}
          </button>
          {item.videoSrc && <button onClick={downloadVideo} style={btn({ padding: "7px 12px", fontSize: 11, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981" })}>💾 Video</button>}
          {item.audioSrc && <button onClick={downloadAudio} style={btn({ padding: "7px 12px", fontSize: 11, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981" })}>💾 Audio</button>}
        </div>

        {/* Errors */}
        {item.videoError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>❌ Video: {item.videoError}</p>}
        {item.audioError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>❌ Audio: {item.audioError}</p>}

        {/* Video preview */}
        {item.videoSrc && (
          <div>
            <VideoPlayer src={item.videoSrc} />
            <button onClick={() => setZoomVideo(true)} style={btn({ marginTop: 6, width: "100%", padding: "5px 0", fontSize: 11, border: CSS.border, background: "transparent", color: CSS.textSecondary })}>🔍 Xem toàn màn hình</button>
          </div>
        )}

        {/* Audio preview */}
        {item.audioSrc && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: CSS.textMuted, marginBottom: 4, textTransform: "uppercase" }}>🔊 Audio Preview</div>
            <audio controls src={item.audioSrc} className="w-full" style={{ height: 36 }} />
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ BatchActionBar */
interface BatchActionBarProps { items: PromptItem[]; videoConfig: VideoConfig; apiKey: string; voiceName: string; onUpdateItem: (id: string, patch: Partial<PromptItem>) => void; }
export function BatchActionBar({ items, videoConfig, apiKey, voiceName, onUpdateItem }: BatchActionBarProps) {
  const [batchVideoRunning, setBatchVideoRunning] = useState(false);
  const [batchAudioRunning, setBatchAudioRunning] = useState(false);
  const [zipBuilding, setZipBuilding] = useState(false);
  const stopRef = useRef(false);

  const generateVideoQueue = async () => {
    setBatchVideoRunning(true); stopRef.current = false;
    for (const item of items) {
      if (stopRef.current) break;
      if (item.videoStatus === "done") continue;
      onUpdateItem(item.id, { videoStatus: "loading", videoError: undefined });
      try {
        const r = await fetch("/api/affiliate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, mainPrompt: item.promptText, config: { model: videoConfig.model, duration: videoConfig.duration, aspectRatio: videoConfig.aspectRatio, numberOfOutputs: 1, personGeneration: videoConfig.personGeneration, generateSubtitles: videoConfig.generateSubtitles } }) });
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo video");
        onUpdateItem(item.id, { videoStatus: "done", videoSrc: data.videos?.[0] });
      } catch (e: any) { onUpdateItem(item.id, { videoStatus: "error", videoError: e.message }); }
    }
    setBatchVideoRunning(false);
  };

  const generateAudioQueue = async () => {
    setBatchAudioRunning(true); stopRef.current = false;
    for (const item of items) {
      if (stopRef.current) break;
      if (item.audioStatus === "done") continue;
      onUpdateItem(item.id, { audioStatus: "loading", audioError: undefined });
      try {
        const r = await fetch("/api/affiliate-video-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, text: item.promptText, voiceName }) });
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo audio");
        onUpdateItem(item.id, { audioStatus: "done", audioSrc: data.audioDataUrl });
      } catch (e: any) { onUpdateItem(item.id, { audioStatus: "error", audioError: e.message }); }
    }
    setBatchAudioRunning(false);
  };

  const downloadZip = async () => {
    setZipBuilding(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip(); let hasFile = false;
      items.forEach((item, i) => {
        if (item.videoSrc) { const b64 = item.videoSrc.includes(",") ? item.videoSrc.split(",")[1] : item.videoSrc; if (b64 && !item.videoSrc.startsWith("http")) { zip.file(`video-${i + 1}.mp4`, b64, { base64: true }); hasFile = true; } }
        if (item.audioSrc) { const b64 = item.audioSrc.split(",")[1] || ""; if (b64) { zip.file(`audio-${i + 1}.wav`, b64, { base64: true }); hasFile = true; } }
      });
      if (!hasFile) { alert("Chưa có file nào để tải xuống!"); return; }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `affiliate-video-bundle-${Date.now()}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert("Lỗi tạo ZIP: " + e.message); } finally { setZipBuilding(false); }
  };

  const doneVideos = items.filter((i) => i.videoStatus === "done").length;
  const doneAudios = items.filter((i) => i.audioStatus === "done").length;

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ ...card({ padding: "12px 16px" }), background: "rgba(99,102,241,0.06)", border: CSS.borderAccent }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: CSS.accent, marginRight: 4 }}>⚡ Hàng loạt</span>
      <button onClick={generateVideoQueue} disabled={batchVideoRunning} style={btn({ padding: "8px 16px", fontSize: 12, background: batchVideoRunning ? "rgba(99,102,241,0.15)" : CSS.gradAccent, color: "#fff", opacity: batchVideoRunning ? 0.7 : 1 })}>{batchVideoRunning ? "⏳ Đang tạo Video..." : "🎬 Tạo Video hàng loạt"}</button>
      <button onClick={generateAudioQueue} disabled={batchAudioRunning} style={btn({ padding: "8px 16px", fontSize: 12, background: batchAudioRunning ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.2)", border: "1px solid rgba(6,182,212,0.4)", color: CSS.accentTeal, opacity: batchAudioRunning ? 0.7 : 1 })}>{batchAudioRunning ? "⏳ Đang tạo Audio..." : "🎙 Tạo Audio hàng loạt"}</button>
      {(batchVideoRunning || batchAudioRunning) && <button onClick={() => { stopRef.current = true; }} style={btn({ padding: "8px 12px", fontSize: 12, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444" })}>⏹ Dừng</button>}
      <div className="flex-1" />
      <span style={{ fontSize: 11, color: CSS.textMuted }}>🎬 {doneVideos}/{items.length} · 🎙 {doneAudios}/{items.length}</span>
      <button onClick={downloadZip} disabled={zipBuilding || (doneVideos === 0 && doneAudios === 0)} style={btn({ padding: "8px 16px", fontSize: 12, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: CSS.accentAmber, opacity: doneVideos === 0 && doneAudios === 0 ? 0.4 : 1 })}>{zipBuilding ? "⏳ Đang nén..." : "📦 Tải tất cả (ZIP)"}</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VoiceSelector */
export function VoiceSelector({ value, onChange }: { value: VoiceConfig; onChange: (v: VoiceConfig) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const readAudio = (f: File) => {
    const r = new FileReader();
    r.onload = (e) => onChange({ ...value, type: "custom", customAudioSrc: e.target?.result as string, customAudioName: f.name });
    r.readAsDataURL(f);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["builtin", "custom"] as const).map((t) => (
          <button key={t} onClick={() => onChange({ ...value, type: t })}
            style={btn({ flex: 1, padding: "6px 0", fontSize: 11, background: value.type === t ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: value.type === t ? "#fff" : CSS.textMuted, border: value.type === t ? "none" : CSS.border })}>
            {t === "builtin" ? "🎙 Có sẵn" : "📤 Upload"}
          </button>
        ))}
      </div>
      {value.type === "builtin" ? (
        <select value={value.voiceName} onChange={(e) => onChange({ ...value, voiceName: e.target.value })}
          style={{ padding: "8px 10px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 12, outline: "none", cursor: "pointer" }}>
          {BUILTIN_VOICES.map((v) => <option key={v.value} value={v.value} style={{ background: "#0e0e1f" }}>{v.label}</option>)}
        </select>
      ) : (
        <div className="flex flex-col gap-1">
          <div onClick={() => fileRef.current?.click()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("audio/")) readAudio(f); }} onDragOver={(e) => e.preventDefault()}
            style={{ padding: 16, borderRadius: CSS.radiusSm, border: "2px dashed rgba(99,102,241,0.3)", background: CSS.bgCard, cursor: "pointer", textAlign: "center", fontSize: 12, color: CSS.textMuted }}>
            {value.customAudioName ? `🎵 ${value.customAudioName}` : "Kéo thả file âm thanh vào đây"}
          </div>
          {value.customAudioSrc && <audio controls src={value.customAudioSrc} className="w-full" style={{ height: 36 }} />}
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readAudio(f); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ MediaCard */
export function MediaCard({ item, onChange, onRemove, onZoom, onDragStart, onDropItem, compact, height = 140 }: { item: MediaItem; onChange: (p: Partial<MediaItem>) => void; onRemove: () => void; onZoom: (src: string, type: MediaType) => void; onDragStart?: (i: MediaItem) => void; onDropItem?: (i: MediaItem) => void; compact?: boolean; height?: number; }) {
  const [draggingOver, setDraggingOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readFile = (f: File) => { const type: MediaType = f.type.startsWith("video/") ? "video" : "image"; const r = new FileReader(); r.onload = (e) => onChange({ src: e.target?.result as string, mediaType: type, name: f.name }); r.readAsDataURL(f); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    if (e.dataTransfer.files.length > 0) { readFile(e.dataTransfer.files[0]); return; }
    const raw = e.dataTransfer.getData("application/x-media-item");
    if (raw && onDropItem) { try { onDropItem(JSON.parse(raw)); } catch {} }
  };
  const hasMedia = !!item.src;
  return (
    <div className="flex flex-col gap-1">
      <div draggable={hasMedia}
        onDragStart={(e) => { if (onDragStart && item.src) { onDragStart(item); e.dataTransfer.setData("application/x-media-item", JSON.stringify(item)); } }}
        onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }} onDragLeave={() => setDraggingOver(false)}
        onClick={() => !hasMedia && fileRef.current?.click()}
        style={{ height, borderRadius: CSS.radius, border: draggingOver ? `2px dashed ${CSS.accent}` : hasMedia ? "1px solid rgba(255,255,255,0.12)" : "2px dashed rgba(255,255,255,0.15)", background: draggingOver ? "rgba(99,102,241,0.1)" : CSS.bgCard, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: hasMedia ? "grab" : "pointer", transition: "all 0.2s" }}>
        {hasMedia ? (item.mediaType === "video" ? <video src={item.src!} className="w-full h-full object-cover" muted /> : <img src={item.src!} className="w-full h-full object-cover" alt="" />) : (
          <div className="text-center" style={{ color: CSS.textMuted, padding: 12 }}>
            <div style={{ fontSize: compact ? 24 : 32, marginBottom: 6 }}>{item.mediaType === "video" ? "🎬" : "🖼️"}</div>
            <div style={{ fontSize: 11 }}>Kéo thả hoặc nhấp để tải</div>
          </div>
        )}
        {hasMedia && (
          <div className="absolute inset-0 flex items-center justify-center gap-1"
            style={{ background: "rgba(0,0,0,0)", opacity: 0, transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0)"; e.currentTarget.style.opacity = "0"; }}>
            <button onClick={(e) => { e.stopPropagation(); item.src && onZoom(item.src, item.mediaType); }} style={btn({ padding: "5px 10px", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11 })}>🔍</button>
            <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={btn({ padding: "5px 10px", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11 })}>📁</button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={btn({ padding: "5px 10px", background: "rgba(239,68,68,0.5)", color: "#fff", fontSize: 11 })}>✕</button>
          </div>
        )}
      </div>
      {!compact && (
        <>
          <div className="flex gap-1">
            {(["image", "video"] as MediaType[]).map((t) => (
              <button key={t} onClick={() => onChange({ mediaType: t, src: null })}
                style={btn({ flex: 1, padding: "4px 0", fontSize: 11, background: item.mediaType === t ? CSS.gradAccent : "rgba(255,255,255,0.06)", color: item.mediaType === t ? "#fff" : CSS.textMuted, border: item.mediaType === t ? "none" : CSS.border })}>
                {t === "image" ? "🖼 Ảnh" : "🎬 Video"}
              </button>
            ))}
          </div>
          <textarea value={item.prompt} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} placeholder="Prompt cho item này..."
            style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 11, resize: "none", outline: "none", fontFamily: "inherit" }} />
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ StyleGallery */
export function StyleGallery({ selected, onSelect }: { selected: string | null; onSelect: (p: string) => void; }) {
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: CSS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>🎨 Phong cách tham khảo</p>
      <div className="grid grid-cols-3 gap-1">
        {STYLE_GALLERY.map((item) => (
          <div key={item.url} onClick={() => onSelect(selected === item.prompt ? "" : item.prompt)} title={item.label}
            style={{ borderRadius: CSS.radiusSm, overflow: "hidden", cursor: "pointer", position: "relative", border: selected === item.prompt ? `2px solid ${CSS.accent}` : "2px solid transparent", boxShadow: selected === item.prompt ? CSS.shadowAccent : "none", transition: "all 0.15s" }}>
            <img src={item.url} alt={item.label} className="w-full block object-cover" style={{ height: 68 }} />
            <div style={{ position: "absolute", bottom: 0, insetInline: 0, background: "rgba(0,0,0,0.65)", padding: "3px 0", textAlign: "center" }}>
              <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>{item.label}</span>
            </div>
            {selected === item.prompt && (
              <div className="absolute flex items-center justify-center" style={{ top: 3, right: 3, background: CSS.accent, borderRadius: "50%", width: 16, height: 16, fontSize: 10, color: "#fff" }}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ KeyframeTimeline */
export function KeyframeTimeline({ keyframes, onChange, onZoom, onDropExternal }: { keyframes: MediaItem[]; onChange: (i: MediaItem[]) => void; onZoom: (src: string, type: MediaType) => void; onDropExternal?: (item: MediaItem) => void; }) {
  const dragIndex = useRef<number | null>(null);
  const [draggingOver, setDraggingOver] = useState<number | null>(null);
  const [zoneOver, setZoneOver] = useState(false);

  const handleDrop = (targetIdx: number) => {
    if (dragIndex.current === null || dragIndex.current === targetIdx) return;
    const next = [...keyframes]; const [moved] = next.splice(dragIndex.current, 1); next.splice(targetIdx, 0, moved);
    onChange(next); dragIndex.current = null; setDraggingOver(null);
  };

  const handleExternalFileDrop = (e: React.DragEvent, idx?: number) => {
    e.preventDefault(); setZoneOver(false);
    if (e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0]; const mediaType: MediaType = f.type.startsWith("video/") ? "video" : "image";
      const r = new FileReader();
      r.onload = (ev) => {
        const ni: MediaItem = { id: uid(), role: "keyframe", mediaType, src: ev.target?.result as string, name: f.name, prompt: "" };
        if (idx !== undefined) { const next = [...keyframes]; next.splice(idx, 0, ni); onChange(next); } else onChange([...keyframes, ni]);
      };
      r.readAsDataURL(f); return;
    }
    const raw = e.dataTransfer.getData("application/x-media-item");
    if (raw) { try { const src: MediaItem = JSON.parse(raw); const ni = { ...src, id: uid(), role: "keyframe" as ItemRole }; onChange([...keyframes, ni]); onDropExternal?.(ni); } catch {} }
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: CSS.accentTeal }}>🎞 Keyframes ({keyframes.length})</span>
        <button onClick={() => onChange([...keyframes, makeMediaItem("keyframe")])} style={btn({ padding: "4px 12px", fontSize: 11, background: "rgba(6,182,212,0.15)", color: CSS.accentTeal, border: "1px solid rgba(6,182,212,0.4)" })}>+ Thêm</button>
      </div>
      <div onDrop={(e) => handleExternalFileDrop(e)} onDragOver={(e) => { e.preventDefault(); setZoneOver(true); }} onDragLeave={() => setZoneOver(false)}
        style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 8px", borderRadius: CSS.radius, minHeight: 120, border: zoneOver ? `2px dashed ${CSS.accentTeal}` : CSS.border, background: zoneOver ? "rgba(6,182,212,0.05)" : "rgba(0,0,0,0.2)", scrollbarWidth: "thin", transition: "all 0.2s" }}>
        {keyframes.length === 0 && (
          <div className="flex-1 flex items-center justify-center" style={{ color: CSS.textMuted, fontSize: 12 }}>Kéo ảnh/video vào đây hoặc nhấn "Thêm"</div>
        )}
        {keyframes.map((kf, idx) => (
          <div key={kf.id} draggable onDragStart={() => { dragIndex.current = idx; }} onDragOver={(e) => { e.preventDefault(); setDraggingOver(idx); }} onDragLeave={() => setDraggingOver(null)}
            onDrop={(e) => { e.stopPropagation(); if (dragIndex.current !== null) handleDrop(idx); else handleExternalFileDrop(e, idx); }}
            style={{ flex: "0 0 110px", position: "relative", borderRadius: CSS.radiusSm, border: draggingOver === idx ? `2px solid ${CSS.accent}` : "1px solid rgba(255,255,255,0.1)", background: CSS.bgCard, overflow: "hidden", transition: "border 0.15s" }}>
            <div style={{ position: "absolute", top: 4, left: 4, zIndex: 2, background: CSS.accent, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99 }}>K{idx + 1}</div>
            <div style={{ height: 80, cursor: "pointer" }} onClick={() => kf.src && onZoom(kf.src, kf.mediaType)}>
              {kf.src ? (kf.mediaType === "video" ? <video src={kf.src} className="w-full h-full object-cover" muted /> : <img src={kf.src} className="w-full h-full object-cover" alt="" />) : (
                <div className="h-full flex items-center justify-center" style={{ color: CSS.textMuted, fontSize: 20 }}>{kf.mediaType === "video" ? "🎬" : "🖼️"}</div>
              )}
            </div>
            <div className="flex gap-1" style={{ padding: 4 }}>
              <label style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 10, color: CSS.textSecondary, padding: "2px 0", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                📁
                <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const mt: MediaType = f.type.startsWith("video/") ? "video" : "image";
                  const r = new FileReader();
                  r.onload = (ev) => { const next = [...keyframes]; next[idx] = { ...kf, src: ev.target?.result as string, mediaType: mt, name: f.name }; onChange(next); };
                  r.readAsDataURL(f); e.target.value = "";
                }} />
              </label>
              <button onClick={() => onChange(keyframes.filter((_, i) => i !== idx))} style={btn({ flex: 1, padding: "2px 0", fontSize: 10, background: "rgba(239,68,68,0.15)", color: "#ef4444" })}>✕</button>
            </div>
          </div>
        ))}
        <div onClick={() => onChange([...keyframes, makeMediaItem("keyframe")])}
          style={{ flex: "0 0 60px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: CSS.radiusSm, border: "2px dashed rgba(99,102,241,0.3)", color: CSS.accent, fontSize: 22, background: "rgba(99,102,241,0.04)" }}>+</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ DialogueEditor */
export function DialogueEditor({ lines, onChange }: { lines: DialogueLine[]; onChange: (l: DialogueLine[]) => void; }) {
  const update = (id: string, patch: Partial<DialogueLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, idx) => (
        <div key={line.id} style={{ ...card({ padding: 10 }), display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 11, color: CSS.accent, fontWeight: 700, whiteSpace: "nowrap" }}>#{idx + 1}</span>
            <input type="number" value={line.start} min={0} step={0.5} onChange={(e) => update(line.id, { start: parseFloat(e.target.value) || 0 })} style={{ width: 52, padding: "4px 6px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 11, outline: "none" }} title="Start (s)" />
            <span style={{ color: CSS.textMuted, fontSize: 11 }}>→</span>
            <input type="number" value={line.end} min={0} step={0.5} onChange={(e) => update(line.id, { end: parseFloat(e.target.value) || 0 })} style={{ width: 52, padding: "4px 6px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 11, outline: "none" }} title="End (s)" />
            <select value={line.voice} onChange={(e) => update(line.id, { voice: e.target.value })} style={{ flex: 1, padding: "4px 6px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 10, outline: "none" }}>
              {BUILTIN_VOICES.map((v) => <option key={v.value} value={v.value}>{v.value}</option>)}
            </select>
            <button onClick={() => onChange(lines.filter((l) => l.id !== line.id))} style={btn({ padding: "4px 8px", fontSize: 11, background: "rgba(239,68,68,0.15)", color: "#ef4444" })}>✕</button>
          </div>
          <textarea value={line.text} onChange={(e) => update(line.id, { text: e.target.value })} rows={2} placeholder={`Lời thoại đoạn ${idx + 1}...`}
            style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit" }} />
        </div>
      ))}
      <button onClick={() => { const lastEnd = lines[lines.length - 1]?.end ?? 0; onChange([...lines, makeDialogueLine(lastEnd, lastEnd + 3)]); }}
        style={btn({ padding: "8px 0", fontSize: 12, border: "2px dashed rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.04)", color: CSS.accent, borderRadius: CSS.radiusSm })}>
        + Thêm lời thoại
      </button>
    </div>
  );
}
