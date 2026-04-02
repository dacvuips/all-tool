/**
 * affiliate-video/components.tsx
 * className only — no inline styles, no style= props.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BUILTIN_VOICES,
  DialogueLine,
  ItemRole,
  makeDialogueLine,
  makeMediaItem,
  MediaItem,
  MediaType,
  OpStatus,
  PROMPT_TEMPLATES,
  PromptItem,
  STYLE_GALLERY,
  uid,
  VIDEO_MODELS,
  VideoConfig,
  VoiceConfig,
} from "./constants";

/* ═══════════════════════════════════════════════════════════ ZoomModal */
interface ZoomModalProps {
  src: string;
  mediaType?: MediaType;
  onClose: () => void;
}

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
      className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-80 backdrop-filter backdrop-blur-sm cursor-zoom-out"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onMouseDown={(e) => {
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        setOffset((o) => ({
          x: o.x + e.clientX - lastPos.current.x,
          y: o.y + e.clientY - lastPos.current.y,
        }));
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={() => { dragging.current = false; }}
      onWheel={onWheel}
    >
      {mediaType === "video" ? (
        <video
          src={src}
          controls
          autoPlay
          className="rounded-2xl"
          style={{ maxWidth: "88vw", maxHeight: "88vh", transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})` }}
        />
      ) : (
        <img
          src={src}
          draggable={false}
          alt=""
          className="rounded-2xl select-none"
          style={{ maxWidth: "88vw", maxHeight: "88vh", transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})` }}
        />
      )}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {[
          { l: "🔍+", fn: () => setScale((s) => Math.min(8, s + 0.4)) },
          { l: "🔍−", fn: () => setScale((s) => Math.max(0.3, s - 0.4)) },
          { l: "↺", fn: () => { setScale(1); setOffset({ x: 0, y: 0 }); } },
          { l: "✕", fn: onClose },
        ].map((b) => (
          <button
            key={b.l}
            onClick={b.fn}
            className="w-9 h-9 rounded-xl bg-black bg-opacity-60 text-white border border-white border-opacity-20 hover:bg-opacity-80 cursor-pointer text-14 font-bold transition-all flex items-center justify-center"
          >
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ SettingsModal */
export function SettingsModal({
  apiKey,
  model,
  onSave,
  onClose,
}: {
  apiKey: string;
  model: string;
  onSave: (k: string, m: string) => void;
  onClose: () => void;
}) {
  const [keyVal, setKeyVal] = useState(apiKey);
  const [modelVal, setModelVal] = useState(model || VIDEO_MODELS[0].value);
  return (
    <div
      className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-indigo-500 border-opacity-30 shadow-2xl overflow-hidden" style={{ background: "#0e0c1e" }}>
        <div className="px-6 py-5 border-b border-white border-opacity-10">
          <h2 className="text-16 font-bold text-white mb-1">⚙️ Cài đặt API</h2>
          <p className="text-12 text-blue-400">Cài đặt lưu trong trình duyệt, không gửi lên server.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-11 font-semibold text-blue-400 uppercase tracking-wider mb-2">API Key (OpenAI hoặc Gemini)</label>
            <input
              type="password"
              value={keyVal}
              onChange={(e) => setKeyVal(e.target.value)}
              placeholder="sk-... hoặc AIza..."
              onKeyDown={(e) => e.key === "Enter" && (onSave(keyVal, modelVal), onClose())}
              className="w-full rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-13 px-4 py-2 outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-10 text-blue-500 mt-2">
              🔹 OpenAI{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">
                platform.openai.com
              </a>
              {" · "}🔹 Gemini{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">
                aistudio.google.com
              </a>
            </p>
          </div>
          <div>
            <label className="block text-11 font-semibold text-blue-400 uppercase tracking-wider mb-2">Model Video</label>
            <select
              value={modelVal}
              onChange={(e) => setModelVal(e.target.value)}
              className="w-full rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-13 px-4 py-2 outline-none focus:border-indigo-500 transition-colors"
            >
              {VIDEO_MODELS.map((m) => (
                <option key={m.value} value={m.value} style={{ background: "#1a1a2e" }}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { onSave(keyVal, modelVal); onClose(); }}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-14 border-0 cursor-pointer transition-all"
            >
              💾 Lưu
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 text-blue-300 font-semibold text-13 border-0 cursor-pointer transition-all"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ PromptTemplateSelector */
interface PromptTemplateSelectorProps {
  value: string;
  onChange: (id: string) => void;
}
export function PromptTemplateSelector({ value, onChange }: PromptTemplateSelectorProps) {
  return (
    <div>
      <div>📋 Chọn Template</div>
      <div>
        {PROMPT_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.placeholder}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VideoPlayer */
export function VideoPlayer({ src }: { src: string; style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  return (
    <div>
      <video
        ref={videoRef}
        src={src}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) setProgress((v.currentTime / v.duration) * 100);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onEnded={() => setPlaying(false)}
      />
      <div>
        <button onClick={toggle}>{playing ? "⏸" : "▶"}</button>
        <input
          type="range"
          value={progress}
          min={0}
          max={100}
          step={0.1}
          onChange={(e) => {
            const v = videoRef.current;
            if (v) {
              v.currentTime = (parseFloat(e.target.value) / 100) * v.duration;
              setProgress(parseFloat(e.target.value));
            }
          }}
        />
        <span>
          {fmt((progress / 100) * duration)} / {fmt(duration)}
        </span>
        <a href={src} download="generated-video.mp4" title="Tải video">
          💾
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ StatusBadge */
function StatusBadge({ status, label }: { status: OpStatus; label: string }) {
  const cls: Record<OpStatus, string> = {
    idle: "av-status-badge av-status-idle",
    loading: "av-status-badge av-status-loading",
    done: "av-status-badge av-status-done",
    error: "av-status-badge av-status-error",
  };
  const icon: Record<OpStatus, string> = { idle: "○", loading: "⏳", done: "✅", error: "❌" };
  return (
    <span className={cls[status]}>
      {icon[status]} {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════ PromptResultCard */
interface PromptResultCardProps {
  item: PromptItem;
  index: number;
  videoConfig: VideoConfig;
  apiKey: string;
  voiceName: string;
  onUpdate: (patch: Partial<PromptItem>) => void;
}
export function PromptResultCard({
  item,
  index,
  videoConfig: defaultVideoConfig,
  apiKey,
  voiceName: defaultVoiceName,
  onUpdate,
}: PromptResultCardProps) {
  const [editing, setEditing] = useState(false);
  const [zoomVideo, setZoomVideo] = useState(false);

  const generateVideo = async () => {
    onUpdate({ videoStatus: "loading", videoError: undefined });
    try {
      const r = await fetch("/api/affiliate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          mainPrompt: item.promptText,
          config: {
            model: defaultVideoConfig.model,
            duration: defaultVideoConfig.duration,
            aspectRatio: defaultVideoConfig.aspectRatio,
            numberOfOutputs: 1,
            personGeneration: defaultVideoConfig.personGeneration,
            generateSubtitles: defaultVideoConfig.generateSubtitles,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo video");
      onUpdate({ videoStatus: "done", videoSrc: data.videos?.[0] });
    } catch (e: any) {
      onUpdate({ videoStatus: "error", videoError: e.message });
    }
  };

  const generateAudio = async () => {
    onUpdate({ audioStatus: "loading", audioError: undefined });
    try {
      const r = await fetch("/api/affiliate-video-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          text: item.voiceText || item.promptText,
          voiceName: defaultVoiceName,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo audio");
      onUpdate({ audioStatus: "done", audioSrc: data.audioDataUrl });
    } catch (e: any) {
      onUpdate({ audioStatus: "error", audioError: e.message });
    }
  };

  const downloadVideo = () => {
    if (!item.videoSrc) return;
    const a = document.createElement("a");
    a.href = item.videoSrc;
    a.download = `video-${index + 1}.mp4`;
    a.click();
  };
  const downloadAudio = () => {
    if (!item.audioSrc) return;
    const a = document.createElement("a");
    a.href = item.audioSrc;
    a.download = `audio-${index + 1}.wav`;
    a.click();
  };

  return (
    <>
      {zoomVideo && item.videoSrc && (
        <ZoomModal src={item.videoSrc} mediaType="video" onClose={() => setZoomVideo(false)} />
      )}
      <div>
        {/* Header */}
        <div>
          <div>{index + 1}</div>
          <div>
            <div>
              <StatusBadge status={item.videoStatus} label="Video" />
              <StatusBadge status={item.audioStatus} label="Audio" />
            </div>
            {editing ? (
              <textarea
                value={item.promptText}
                onChange={(e) => onUpdate({ promptText: e.target.value })}
                onBlur={() => setEditing(false)}
                autoFocus
                rows={4}
              />
            ) : (
              <p onClick={() => setEditing(true)} title="Click để chỉnh sửa">
                {item.promptText}
              </p>
            )}
          </div>
        </div>

        {/* Voice text */}
        {item.voiceText && (
          <div>
            <div>🗣️ Lời thoại / Voice-over</div>
            <p>{item.voiceText}</p>
          </div>
        )}

        {/* Action buttons */}
        <div>
          <button onClick={generateVideo} disabled={item.videoStatus === "loading"}>
            {item.videoStatus === "loading" ? "⏳ Đang tạo..." : "🎬 Tạo Video"}
          </button>
          <button onClick={generateAudio} disabled={item.audioStatus === "loading"}>
            {item.audioStatus === "loading" ? "⏳ Đang tạo..." : "🎙 Tạo Audio (Gemini)"}
          </button>
          {item.videoSrc && <button onClick={downloadVideo}>💾 Video</button>}
          {item.audioSrc && <button onClick={downloadAudio}>💾 Audio</button>}
        </div>

        {/* Errors */}
        {item.videoError && <p>❌ Video: {item.videoError}</p>}
        {item.audioError && <p>❌ Audio: {item.audioError}</p>}

        {/* Video preview */}
        {item.videoSrc && (
          <div>
            <VideoPlayer src={item.videoSrc} />
            <button onClick={() => setZoomVideo(true)}>🔍 Xem toàn màn hình</button>
          </div>
        )}

        {/* Audio preview */}
        {item.audioSrc && (
          <div>
            <div>🔊 Audio Preview</div>
            <audio controls src={item.audioSrc} />
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ BatchActionBar */
interface BatchActionBarProps {
  items: PromptItem[];
  videoConfig: VideoConfig;
  apiKey: string;
  voiceName: string;
  onUpdateItem: (id: string, patch: Partial<PromptItem>) => void;
}
export function BatchActionBar({
  items,
  videoConfig,
  apiKey,
  voiceName,
  onUpdateItem,
}: BatchActionBarProps) {
  const [batchVideoRunning, setBatchVideoRunning] = useState(false);
  const [batchAudioRunning, setBatchAudioRunning] = useState(false);
  const [zipBuilding, setZipBuilding] = useState(false);
  const stopRef = useRef(false);

  const generateVideoQueue = async () => {
    setBatchVideoRunning(true);
    stopRef.current = false;
    for (const item of items) {
      if (stopRef.current) break;
      if (item.videoStatus === "done") continue;
      onUpdateItem(item.id, { videoStatus: "loading", videoError: undefined });
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
        onUpdateItem(item.id, { videoStatus: "done", videoSrc: data.videos?.[0] });
      } catch (e: any) {
        onUpdateItem(item.id, { videoStatus: "error", videoError: e.message });
      }
    }
    setBatchVideoRunning(false);
  };

  const generateAudioQueue = async () => {
    setBatchAudioRunning(true);
    stopRef.current = false;
    for (const item of items) {
      if (stopRef.current) break;
      if (item.audioStatus === "done") continue;
      onUpdateItem(item.id, { audioStatus: "loading", audioError: undefined });
      try {
        const r = await fetch("/api/affiliate-video-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, text: item.promptText, voiceName }),
        });
        const data = await r.json();
        if (!r.ok || !data.success) throw new Error(data.error || "Lỗi tạo audio");
        onUpdateItem(item.id, { audioStatus: "done", audioSrc: data.audioDataUrl });
      } catch (e: any) {
        onUpdateItem(item.id, { audioStatus: "error", audioError: e.message });
      }
    }
    setBatchAudioRunning(false);
  };

  const downloadZip = async () => {
    setZipBuilding(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let hasFile = false;
      items.forEach((item, i) => {
        if (item.videoSrc) {
          const b64 = item.videoSrc.includes(",") ? item.videoSrc.split(",")[1] : item.videoSrc;
          if (b64 && !item.videoSrc.startsWith("http")) {
            zip.file(`video-${i + 1}.mp4`, b64, { base64: true });
            hasFile = true;
          }
        }
        if (item.audioSrc) {
          const b64 = item.audioSrc.split(",")[1] || "";
          if (b64) {
            zip.file(`audio-${i + 1}.wav`, b64, { base64: true });
            hasFile = true;
          }
        }
      });
      if (!hasFile) {
        alert("Chưa có file nào để tải xuống!");
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `affiliate-video-bundle-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Lỗi tạo ZIP: " + e.message);
    } finally {
      setZipBuilding(false);
    }
  };

  const doneVideos = items.filter((i) => i.videoStatus === "done").length;
  const doneAudios = items.filter((i) => i.audioStatus === "done").length;

  return (
    <div>
      <span>⚡ Hàng loạt</span>
      <button onClick={generateVideoQueue} disabled={batchVideoRunning}>
        {batchVideoRunning ? "⏳ Đang tạo Video..." : "🎬 Tạo Video hàng loạt"}
      </button>
      <button onClick={generateAudioQueue} disabled={batchAudioRunning}>
        {batchAudioRunning ? "⏳ Đang tạo Audio..." : "🎙 Tạo Audio hàng loạt"}
      </button>
      {(batchVideoRunning || batchAudioRunning) && (
        <button
          onClick={() => {
            stopRef.current = true;
          }}
        >
          ⏹ Dừng
        </button>
      )}
      <div />
      <span>
        🎬 {doneVideos}/{items.length} · 🎙 {doneAudios}/{items.length}
      </span>
      <button
        onClick={downloadZip}
        disabled={zipBuilding || (doneVideos === 0 && doneAudios === 0)}
      >
        {zipBuilding ? "⏳ Đang nén..." : "📦 Tải tất cả (ZIP)"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VoiceSelector */
export function VoiceSelector({
  value,
  onChange,
}: {
  value: VoiceConfig;
  onChange: (v: VoiceConfig) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const readAudio = (f: File) => {
    const r = new FileReader();
    r.onload = (e) =>
      onChange({
        ...value,
        type: "custom",
        customAudioSrc: e.target?.result as string,
        customAudioName: f.name,
      });
    r.readAsDataURL(f);
  };
  return (
    <div>
      <div>
        {(["builtin", "custom"] as const).map((t) => (
          <button key={t} onClick={() => onChange({ ...value, type: t })}>
            {t === "builtin" ? "🎙 Có sẵn" : "📤 Upload"}
          </button>
        ))}
      </div>
      {value.type === "builtin" ? (
        <select
          value={value.voiceName}
          onChange={(e) => onChange({ ...value, voiceName: e.target.value })}
        >
          {BUILTIN_VOICES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      ) : (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f?.type.startsWith("audio/")) readAudio(f);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {value.customAudioName
              ? `🎵 ${value.customAudioName}`
              : "Kéo thả file âm thanh vào đây"}
          </div>
          {value.customAudioSrc && <audio controls src={value.customAudioSrc} />}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readAudio(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ MediaCard */
export function MediaCard({
  item,
  onChange,
  onRemove,
  onZoom,
  onDragStart,
  onDropItem,
  compact,
  height = 140,
}: {
  item: MediaItem;
  onChange: (p: Partial<MediaItem>) => void;
  onRemove: () => void;
  onZoom: (src: string, type: MediaType) => void;
  onDragStart?: (i: MediaItem) => void;
  onDropItem?: (i: MediaItem) => void;
  compact?: boolean;
  height?: number;
}) {
  const [draggingOver, setDraggingOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readFile = (f: File) => {
    const type: MediaType = f.type.startsWith("video/") ? "video" : "image";
    const r = new FileReader();
    r.onload = (e) => onChange({ src: e.target?.result as string, mediaType: type, name: f.name });
    r.readAsDataURL(f);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0]);
      return;
    }
    const raw = e.dataTransfer.getData("application/x-media-item");
    if (raw && onDropItem) {
      try {
        onDropItem(JSON.parse(raw));
      } catch {}
    }
  };
  const hasMedia = !!item.src;

  return (
    <div className="space-y-2">
      <div
        draggable={hasMedia}
        onDragStart={(e) => {
          if (onDragStart && item.src) {
            onDragStart(item);
            e.dataTransfer.setData("application/x-media-item", JSON.stringify(item));
          }
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onClick={() => !hasMedia && fileRef.current?.click()}
        className={`relative flex items-center justify-center rounded-xl overflow-hidden transition-all ${
          hasMedia ? "cursor-grab" : "cursor-pointer"
        } ${
          draggingOver
            ? "border-2 border-dashed border-indigo-500 bg-indigo-900 bg-opacity-10"
            : hasMedia
            ? "border border-white border-opacity-10"
            : "border-2 border-dashed border-white border-opacity-15 bg-white bg-opacity-5 hover:bg-opacity-8"
        }`}
        style={{ height }}
      >
        {hasMedia ? (
          item.mediaType === "video" ? (
            <video src={item.src!} muted className="w-full h-full object-cover" />
          ) : (
            <img src={item.src!} alt="" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1 text-blue-500">
            <div className={compact ? "text-24" : "text-32"}>
              {item.mediaType === "video" ? "🎬" : "🖼️"}
            </div>
            <div className="text-10 text-blue-500">Kéo thả hoặc nhấp để tải</div>
          </div>
        )}
        {hasMedia && (
          <div className="absolute top-1 right-1 flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); item.src && onZoom(item.src, item.mediaType); }}
              className="w-6 h-6 rounded-lg bg-black bg-opacity-60 text-white text-10 flex items-center justify-center border-0 cursor-pointer hover:bg-opacity-80 transition-all"
            >
              🔍
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              className="w-6 h-6 rounded-lg bg-black bg-opacity-60 text-white text-10 flex items-center justify-center border-0 cursor-pointer hover:bg-opacity-80 transition-all"
            >
              📁
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 rounded-lg bg-black bg-opacity-60 text-red-400 text-10 flex items-center justify-center border-0 cursor-pointer hover:bg-red-900 hover:bg-opacity-80 transition-all"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {!compact && (
        <>
          <div className="flex gap-1">
            {(["image", "video"] as MediaType[]).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ mediaType: t, src: null })}
                className={`flex-1 py-1 rounded-lg text-11 font-semibold border-0 cursor-pointer transition-all ${
                  item.mediaType === t
                    ? "bg-indigo-600 text-white"
                    : "bg-white bg-opacity-5 text-blue-400 hover:bg-opacity-10"
                }`}
              >
                {t === "image" ? "🖼 Ảnh" : "🎬 Video"}
              </button>
            ))}
          </div>
          <textarea
            value={item.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={2}
            placeholder="Prompt cho item này..."
            className="w-full rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-11 px-2 py-1 outline-none resize-none focus:border-indigo-500 transition-colors placeholder-blue-600"
          />
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ StyleGallery */
export function StyleGallery({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (p: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-11 font-semibold text-blue-400 uppercase tracking-wider">🎨 Phong cách tham khảo</p>
      <div className="flex gap-2 flex-wrap">
        {STYLE_GALLERY.map((item) => (
          <div
            key={item.url}
            onClick={() => onSelect(selected === item.prompt ? "" : item.prompt)}
            title={item.label}
            className={`relative rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
              selected === item.prompt
                ? "border-indigo-500 shadow-lg"
                : "border-transparent hover:border-indigo-400 hover:border-opacity-50"
            }`}
          >
            <img src={item.url} alt={item.label} className="object-cover" style={{ height: 68 }} />
            <div className="absolute bottom-0 left-0 right-0 px-1 py-0 bg-black bg-opacity-60">
              <span className="text-9 text-white font-semibold">{item.label}</span>
            </div>
            {selected === item.prompt && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-8 text-white font-bold">
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ KeyframeTimeline */
export function KeyframeTimeline({
  keyframes,
  onChange,
  onZoom,
  onDropExternal,
}: {
  keyframes: MediaItem[];
  onChange: (i: MediaItem[]) => void;
  onZoom: (src: string, type: MediaType) => void;
  onDropExternal?: (item: MediaItem) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [draggingOver, setDraggingOver] = useState<number | null>(null);
  const [zoneOver, setZoneOver] = useState(false);

  const handleDrop = (targetIdx: number) => {
    if (dragIndex.current === null || dragIndex.current === targetIdx) return;
    const next = [...keyframes];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
    dragIndex.current = null;
    setDraggingOver(null);
  };

  const handleExternalFileDrop = (e: React.DragEvent, idx?: number) => {
    e.preventDefault();
    setZoneOver(false);
    if (e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      const mediaType: MediaType = f.type.startsWith("video/") ? "video" : "image";
      const r = new FileReader();
      r.onload = (ev) => {
        const ni: MediaItem = {
          id: uid(),
          role: "keyframe",
          mediaType,
          src: ev.target?.result as string,
          name: f.name,
          prompt: "",
        };
        if (idx !== undefined) {
          const next = [...keyframes];
          next.splice(idx, 0, ni);
          onChange(next);
        } else onChange([...keyframes, ni]);
      };
      r.readAsDataURL(f);
      return;
    }
    const raw = e.dataTransfer.getData("application/x-media-item");
    if (raw) {
      try {
        const src: MediaItem = JSON.parse(raw);
        const ni = { ...src, id: uid(), role: "keyframe" as ItemRole };
        onChange([...keyframes, ni]);
        onDropExternal?.(ni);
      } catch {}
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-11 font-semibold text-blue-300">🎞 Keyframes ({keyframes.length})</span>
        <button
          onClick={() => onChange([...keyframes, makeMediaItem("keyframe")])}
          className="text-10 font-semibold px-2 py-1 rounded-lg bg-white bg-opacity-5 hover:bg-opacity-10 text-blue-400 border-0 cursor-pointer transition-all"
        >
          + Thêm
        </button>
      </div>
      <div
        onDrop={(e) => handleExternalFileDrop(e)}
        onDragOver={(e) => { e.preventDefault(); setZoneOver(true); }}
        onDragLeave={() => setZoneOver(false)}
        className={`flex gap-2 flex-wrap p-2 rounded-xl min-h-12 transition-all border ${
          zoneOver
            ? "border-2 border-dashed border-cyan-500 bg-cyan-900 bg-opacity-5"
            : "border border-white border-opacity-10 bg-black bg-opacity-20"
        }`}
      >
        {keyframes.length === 0 && (
          <div className="flex items-center justify-center w-full py-3 text-10 text-blue-600">
            Kéo ảnh/video vào đây hoặc nhấn "Thêm"
          </div>
        )}
        {keyframes.map((kf, idx) => (
          <div
            key={kf.id}
            draggable
            onDragStart={() => { dragIndex.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); setDraggingOver(idx); }}
            onDragLeave={() => setDraggingOver(null)}
            onDrop={(e) => {
              e.stopPropagation();
              if (dragIndex.current !== null) handleDrop(idx);
              else handleExternalFileDrop(e, idx);
            }}
            className={`relative rounded-xl overflow-hidden transition-all border ${
              draggingOver === idx
                ? "border-2 border-indigo-500"
                : "border border-white border-opacity-10"
            } bg-white bg-opacity-5`}
            style={{ width: 80, height: 56 }}
          >
            <div className="absolute top-0 left-0 text-8 font-bold text-blue-500 bg-black bg-opacity-50 px-1 rounded-br">K{idx + 1}</div>
            <div
              className="w-full h-full flex items-center justify-center cursor-pointer"
              onClick={() => kf.src && onZoom(kf.src, kf.mediaType)}
            >
              {kf.src ? (
                kf.mediaType === "video" ? (
                  <video src={kf.src} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={kf.src} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="text-16 opacity-40">{kf.mediaType === "video" ? "🎬" : "🖼️"}</div>
              )}
            </div>
            <div className="absolute top-0 right-0 flex gap-0">
              <label className="w-5 h-5 flex items-center justify-center bg-black bg-opacity-60 text-blue-400 text-8 cursor-pointer hover:bg-opacity-80 transition-all">
                📁
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const mt: MediaType = f.type.startsWith("video/") ? "video" : "image";
                    const r = new FileReader();
                    r.onload = (ev) => {
                      const next = [...keyframes];
                      next[idx] = { ...kf, src: ev.target?.result as string, mediaType: mt, name: f.name };
                      onChange(next);
                    };
                    r.readAsDataURL(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={() => onChange(keyframes.filter((_, i) => i !== idx))}
                className="w-5 h-5 flex items-center justify-center bg-black bg-opacity-60 text-red-400 text-8 border-0 cursor-pointer hover:bg-opacity-80 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <div
          onClick={() => onChange([...keyframes, makeMediaItem("keyframe")])}
          className="w-20 h-14 flex items-center justify-center rounded-xl border-2 border-dashed border-white border-opacity-10 text-blue-600 text-20 cursor-pointer hover:border-indigo-500 hover:text-indigo-500 transition-all"
        >
          +
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ DialogueEditor */
export function DialogueEditor({
  lines,
  onChange,
}: {
  lines: DialogueLine[];
  onChange: (l: DialogueLine[]) => void;
}) {
  const update = (id: string, patch: Partial<DialogueLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div>
      {lines.map((line, idx) => (
        <div key={line.id}>
          <div>
            <span>#{idx + 1}</span>
            <input
              type="number"
              value={line.start}
              min={0}
              step={0.5}
              onChange={(e) => update(line.id, { start: parseFloat(e.target.value) || 0 })}
              title="Start (s)"
            />
            <span>→</span>
            <input
              type="number"
              value={line.end}
              min={0}
              step={0.5}
              onChange={(e) => update(line.id, { end: parseFloat(e.target.value) || 0 })}
              title="End (s)"
            />
            <select value={line.voice} onChange={(e) => update(line.id, { voice: e.target.value })}>
              {BUILTIN_VOICES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value}
                </option>
              ))}
            </select>
            <button onClick={() => onChange(lines.filter((l) => l.id !== line.id))}>✕</button>
          </div>
          <textarea
            value={line.text}
            onChange={(e) => update(line.id, { text: e.target.value })}
            rows={2}
            placeholder={`Lời thoại đoạn ${idx + 1}...`}
          />
        </div>
      ))}
      <button
        onClick={() => {
          const lastEnd = lines[lines.length - 1]?.end ?? 0;
          onChange([...lines, makeDialogueLine(lastEnd, lastEnd + 3)]);
        }}
      >
        + Thêm lời thoại
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VideoCard */
interface VideoCardProps {
  id: string;
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
}

export function VideoCard({
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
}: VideoCardProps) {
  const [hovered, setHovered] = useState(false);
  const isGenerating = status === "generating";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl overflow-hidden flex flex-col cursor-pointer transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: hovered ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
        border: hovered ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* Thumbnail area */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9", background: "#0a0a1a" }}>
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" onClick={() => onZoom?.(thumbnail)} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {isGenerating ? (
              <>
                <div className="text-24 animate-spin mb-1">⚙️</div>
                <div className="text-10 text-blue-400 font-medium">Generating...</div>
              </>
            ) : (
              <span className="text-40 opacity-20">🎬</span>
            )}
          </div>
        )}

        {/* Top badges overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 p-2 flex-wrap">
          <span className="text-8 font-bold px-1 rounded bg-indigo-900 bg-opacity-80 text-indigo-300">📄 {label}</span>
          <span className="text-8 font-semibold px-1 rounded bg-black bg-opacity-60 text-blue-400">{aspectRatio}</span>
          <span className="text-8 font-semibold px-1 rounded bg-black bg-opacity-60 text-cyan-400">{styleTag}</span>
          {quality && <span className="text-8 font-semibold px-1 rounded bg-black bg-opacity-60 text-yellow-400">{quality}</span>}
          <div className="ml-auto">
            {isGenerating ? (
              <span className="text-8 font-bold px-1 rounded bg-yellow-900 bg-opacity-80 text-yellow-400">ĐANG XỬ LÝ</span>
            ) : status === "done" ? (
              <span className="text-8 font-bold px-1 rounded bg-green-900 bg-opacity-80 text-green-400">DONE</span>
            ) : (
              <span className="text-8 font-bold px-1 rounded bg-black bg-opacity-60 text-blue-500">HÀNG ĐỢI</span>
            )}
          </div>
        </div>

        {/* Play button */}
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
          MODEL <span className="text-blue-400">{model}</span>
        </span>
        <span className="text-8 text-blue-700">·</span>
        <span className="text-8 text-blue-600 font-mono">
          SEED <span className="text-blue-400">{seed}</span>
        </span>
        <span className="text-8 text-blue-700">·</span>
        <span className="text-8 text-blue-600 font-mono">
          {timeInfo}
        </span>
      </div>
    </div>
  );
}
