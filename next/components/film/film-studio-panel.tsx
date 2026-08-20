/**
 * Tab Studio — trình dựng timeline kiểu CapCut: preview, subtitle inspector, timeline video/voice/subtitle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiEye,
  HiEyeOff,
  HiLockClosed,
  HiLockOpen,
  HiRefresh,
  HiVolumeUp,
} from "react-icons/hi";
import {
  RiDeleteBinLine,
  RiPauseFill,
  RiPlayFill,
  RiScissorsCutLine,
  RiSkipBackLine,
  RiSkipForwardLine,
} from "react-icons/ri";
import {
  buildFilmVoiceListItems,
  syncSceneDialogueLines,
} from "./film-dialogue";
import type { FilmAspectRatio, FilmSceneRecord } from "./film-types";
import { sceneVideoReady } from "./film-video-card";

type Props = {
  scenes: FilmSceneRecord[];
  aspectRatio?: FilmAspectRatio;
};

type VideoClip = {
  id: string;
  sceneId: string;
  index: number;
  startSec: number;
  durationSec: number;
  label: string;
  videoUrl?: string;
  thumbUrl?: string;
  ready: boolean;
};

type VoiceClip = {
  id: string;
  sceneId: string;
  lineId: string;
  startSec: number;
  durationSec: number;
  character: string;
  text: string;
  voiceUrl?: string;
  voiceBlob?: Blob;
};

type SubtitleClip = {
  id: string;
  sceneId: string;
  lineId: string;
  startSec: number;
  durationSec: number;
  character: string;
  text: string;
};

const DEFAULT_SCENE_SEC = 5;
const MIN_CLIP_SEC = 1.5;
const TRACK_LABEL_W = 88;
const PX_PER_SEC = 48;

function formatTimecode(sec: number): string {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
  return `${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

function formatShortTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function estimateLineDuration(text: string, sceneDuration: number, lineCount: number): number {
  const base = Math.max(MIN_CLIP_SEC, sceneDuration / Math.max(1, lineCount));
  const extra = Math.min(4, Math.ceil(text.length / 40));
  return Math.min(sceneDuration, base + extra * 0.3);
}

function buildTimelineClips(scenes: FilmSceneRecord[]): {
  videoClips: VideoClip[];
  voiceClips: VoiceClip[];
  subtitleClips: SubtitleClip[];
  totalSec: number;
} {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const videoClips: VideoClip[] = [];
  const voiceClips: VoiceClip[] = [];
  const subtitleClips: SubtitleClip[] = [];
  let cursor = 0;

  for (const scene of sorted) {
    const durationSec = Math.max(MIN_CLIP_SEC, scene.durationSec ?? DEFAULT_SCENE_SEC);
    const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
    const label =
      scene.title?.trim() || scene.summary?.trim() || `Cảnh ${indexLabel}`;
    videoClips.push({
      id: scene.id,
      sceneId: scene.id,
      index: scene.index,
      startSec: cursor,
      durationSec,
      label,
      videoUrl: scene.videoUrl,
      thumbUrl: scene.frameImageUrl,
      ready: sceneVideoReady(scene),
    });

    const lines = syncSceneDialogueLines(scene);
    const lineCount = Math.max(1, lines.length);
    let lineCursor = cursor;
    const remaining = durationSec;

    lines.forEach((line, i) => {
      const isLast = i === lines.length - 1;
      const lineDur = isLast
        ? Math.max(MIN_CLIP_SEC, cursor + durationSec - lineCursor)
        : estimateLineDuration(line.line, remaining, lineCount);
      voiceClips.push({
        id: `${scene.id}:${line.id}`,
        sceneId: scene.id,
        lineId: line.id,
        startSec: lineCursor,
        durationSec: lineDur,
        character: line.character,
        text: line.line,
        voiceUrl: line.voiceUrl,
        voiceBlob: line.voiceBlob,
      });
      subtitleClips.push({
        id: `${scene.id}:${line.id}:sub`,
        sceneId: scene.id,
        lineId: line.id,
        startSec: lineCursor,
        durationSec: lineDur,
        character: line.character,
        text: line.line,
      });
      lineCursor += lineDur;
    });

    cursor += durationSec;
  }

  return { videoClips, voiceClips, subtitleClips, totalSec: Math.max(cursor, 1) };
}

function findClipAtTime<T extends { startSec: number; durationSec: number }>(
  clips: T[],
  timeSec: number
): T | null {
  return (
    clips.find((c) => timeSec >= c.startSec && timeSec < c.startSec + c.durationSec) ?? null
  );
}

function WaveformBars({ seed }: { seed: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const bars = Array.from({ length: 40 }, (_, i) => {
    const h = 20 + ((hash + i * 17) % 60);
    return h;
  });
  return (
    <div className="flex items-end gap-px h-full px-1 py-1.5 overflow-hidden">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 min-w-0 rounded-sm bg-emerald-400/70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export default function FilmStudioPanel({
  scenes,
  aspectRatio: aspectRatioProp,
}: Props) {
  const { t } = useTranslation();
  const aspectRatio = aspectRatioProp ?? "16:9";
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<Map<string, string>>(new Map());

  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [videoLocked, setVideoLocked] = useState(true);
  const [audioLocked, setAudioLocked] = useState(false);
  const [subtitleLocked, setSubtitleLocked] = useState(false);
  const [showSubtitleOverlay, setShowSubtitleOverlay] = useState(true);

  const { videoClips, voiceClips, subtitleClips, totalSec } = useMemo(
    () => buildTimelineClips(scenes),
    [scenes]
  );

  const voiceItems = useMemo(() => buildFilmVoiceListItems(scenes), [scenes]);

  const activeVideoClip = findClipAtTime(videoClips, currentSec);
  const activeSubtitle =
    subtitleClips.find((s) => s.id === selectedSubtitleId) ??
    findClipAtTime(subtitleClips, currentSec);

  const previewSrc = activeVideoClip?.videoUrl ?? videoClips.find((c) => c.ready)?.videoUrl;

  const timelineWidth = totalSec * PX_PER_SEC;

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(totalSec, sec));
      setCurrentSec(clamped);
      const clip = findClipAtTime(videoClips, clamped);
      if (clip?.videoUrl && videoRef.current) {
        const local = clamped - clip.startSec;
        if (Math.abs(videoRef.current.currentTime - local) > 0.15) {
          videoRef.current.currentTime = local;
        }
      }
    },
    [totalSec, videoClips]
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !previewSrc) return;
    if (v.src !== previewSrc) {
      v.src = previewSrc;
      v.load();
    }
    v.playbackRate = playbackRate;
  }, [previewSrc, playbackRate]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentSec((prev) => {
        const next = prev + dt * playbackRate;
        if (next >= totalSec) {
          setPlaying(false);
          return totalSec;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playbackRate, totalSec]);

  useEffect(() => {
    if (activeSubtitle) {
      setSubtitleDraft(activeSubtitle.text);
      setSelectedSubtitleId(activeSubtitle.id);
    }
  }, [activeSubtitle?.id]);

  useEffect(
    () => () => {
      blobUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlRef.current.clear();
    },
    []
  );

  const togglePlay = () => {
    if (!previewSrc) return;
    if (playing) {
      videoRef.current?.pause();
      setPlaying(false);
    } else {
      void videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left + el.scrollLeft - TRACK_LABEL_W;
    const sec = x / PX_PER_SEC;
    seekTo(sec);
  };

  const handleSelectSubtitle = (clip: SubtitleClip) => {
    setSelectedSubtitleId(clip.id);
    setSubtitleDraft(clip.text);
    seekTo(clip.startSec);
  };

  const playheadLeft = TRACK_LABEL_W + currentSec * PX_PER_SEC;

  const isPortrait = aspectRatio === "9:16";
  const previewAspect = isPortrait ? "9/16" : "16/9";

  if (!scenes.length) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-0 px-6 text-center bg-slate-900 rounded-2xl">
        <p className="m-0 text-base font-semibold text-slate-200">
          {t("Chưa có cảnh quay")}
        </p>
        <p className="mt-2 m-0 text-sm text-slate-400">
          {t("Tạo chuỗi cảnh quay trước khi mở Studio")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0f172a] text-slate-100 shadow-xl">
      {/* Top: Preview + Inspector */}
      <div className="flex flex-col flex-1 min-h-0 lg:flex-row border-b border-slate-700/60">
        {/* Video preview */}
        <div className="flex flex-col flex-[2] min-w-0 min-h-0 p-4 gap-3">
          <div
            className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-black border border-slate-600/50"
            style={{ aspectRatio: previewAspect }}
          >
            {previewSrc ? (
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                playsInline
                muted={false}
                onTimeUpdate={() => {
                  const clip = activeVideoClip;
                  if (!clip || !videoRef.current) return;
                  setCurrentSec(clip.startSec + videoRef.current.currentTime);
                }}
                onEnded={() => {
                  const idx = videoClips.findIndex((c) => c.id === activeVideoClip?.id);
                  const next = videoClips[idx + 1];
                  if (next) seekTo(next.startSec);
                  else setPlaying(false);
                }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 text-slate-400">
                <span className="text-4xl opacity-40">▶</span>
                <p className="m-0 text-sm">{t("Chưa có video — tạo video ở tab Tạo video")}</p>
              </div>
            )}

            {showSubtitleOverlay && activeSubtitle?.text && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[90%] px-4 py-2 rounded-lg bg-black/75 text-sm text-center text-white backdrop-blur-sm">
                {activeSubtitle.character && (
                  <span className="block text-xs text-slate-300 mb-0.5">
                    {activeSubtitle.character}
                  </span>
                )}
                {activeSubtitle.text}
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="flex flex-wrap gap-2 items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!previewSrc}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/50 cursor-pointer disabled:opacity-40"
              >
                {playing ? (
                  <RiPauseFill className="text-lg" />
                ) : (
                  <RiPlayFill className="text-lg" />
                )}
              </button>
              <button
                type="button"
                onClick={() => seekTo(0)}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/50 cursor-pointer"
                title={t("Về đầu")}
              >
                <HiRefresh className="text-base" />
              </button>
              <button
                type="button"
                onClick={() => setShowSubtitleOverlay((v) => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/50 cursor-pointer"
                title={t("Phụ đề")}
              >
                {showSubtitleOverlay ? (
                  <HiEye className="text-base" />
                ) : (
                  <HiEyeOff className="text-base" />
                )}
              </button>
              <div className="hidden sm:flex items-center gap-1 ml-1">
                {["Blur", "Logo", "Mask", "Text"].map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-10 font-medium rounded-full border border-blue-500/40 text-blue-300 bg-blue-500/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 text-slate-400">
                <span>{t("Tốc độ")}</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="px-2 py-1 text-xs rounded-md bg-slate-800 border border-slate-600 text-slate-200 outline-none"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <option key={r} value={r}>
                      {r}x
                    </option>
                  ))}
                </select>
              </label>
              <span className="font-mono text-emerald-400 tabular-nums">
                {formatShortTime(currentSec)} / {formatShortTime(totalSec)}
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle inspector */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 border-t lg:border-t-0 lg:border-l border-slate-700/60 bg-[#131c31]">
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50">
            <h3 className="m-0 text-sm font-bold text-white">{t("Subtitle Inspector")}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Rewrite", "Import SRT", "Regenerate voice"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="px-2.5 py-1 text-10 font-medium rounded-md border border-blue-500/30 text-blue-200 bg-slate-800/80 hover:bg-slate-700 cursor-pointer"
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-10 text-slate-400 uppercase tracking-wide">{t("Start")}</span>
                <input
                  readOnly
                  value={formatTimecode(activeSubtitle?.startSec ?? 0)}
                  className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-slate-800 border border-slate-600 text-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-10 text-slate-400 uppercase tracking-wide">{t("End")}</span>
                <input
                  readOnly
                  value={formatTimecode(
                    (activeSubtitle?.startSec ?? 0) + (activeSubtitle?.durationSec ?? 0)
                  )}
                  className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-slate-800 border border-slate-600 text-slate-200"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-10 text-slate-400 uppercase tracking-wide">{t("Speaker")}</span>
              <select
                value={activeSubtitle?.character ?? ""}
                disabled
                className="mt-1 w-full px-2.5 py-2 text-sm rounded-lg bg-slate-800 border border-slate-600 text-slate-200"
              >
                <option value="">{t("—")}</option>
                {Array.from(new Set(voiceItems.map((v) => v.line.character).filter(Boolean))).map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block flex-1">
              <span className="text-10 text-slate-400 uppercase tracking-wide">{t("Text")}</span>
              <textarea
                value={subtitleDraft}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                rows={5}
                placeholder={t("Chọn block phụ đề trên timeline...")}
                className="mt-1 w-full px-3 py-2.5 text-sm rounded-lg bg-slate-800 border border-slate-600 text-slate-100 outline-none focus:border-blue-500 resize-none"
              />
            </label>
          </div>

          <div className="flex-shrink-0 p-4 border-t border-slate-700/50">
            <button
              type="button"
              disabled={!subtitleDraft.trim()}
              className="w-full py-2.5 text-sm font-semibold rounded-lg border border-blue-500/40 text-blue-200 bg-blue-500/15 hover:bg-blue-500/25 cursor-pointer disabled:opacity-40"
            >
              {t("Add highlight from selection")}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-shrink-0 flex flex-col min-h-[220px] max-h-[42vh] bg-[#0c1222]">
        <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-2 border-b border-slate-700/50">
          <div>
            <h4 className="m-0 text-sm font-bold text-white">{t("Timeline")}</h4>
            <p className="m-0 mt-0.5 text-10 text-slate-500">
              {t("Video, voice và phụ đề — layout kiểu CapCut")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { icon: RiSkipBackLine, title: "Undo" },
              { icon: RiSkipForwardLine, title: "Redo" },
              { icon: RiScissorsCutLine, title: "Split" },
              { icon: RiDeleteBinLine, title: "Delete" },
            ].map(({ icon: Icon, title }) => (
              <button
                key={title}
                type="button"
                title={t(title)}
                className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-800 border border-slate-600/50 hover:bg-slate-700 cursor-pointer text-slate-300"
              >
                <Icon className="text-sm" />
              </button>
            ))}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative select-none"
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div
            className="sticky top-0 z-20 h-7 border-b border-slate-700/50 bg-[#0c1222] flex items-end"
            style={{ width: timelineWidth + TRACK_LABEL_W }}
          >
            <div className="flex-shrink-0" style={{ width: TRACK_LABEL_W }} />
            <div className="relative flex-1 h-full">
              {Array.from({ length: Math.ceil(totalSec) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 text-10 text-slate-500 font-mono"
                  style={{ left: i * PX_PER_SEC }}
                >
                  {formatShortTime(i)}
                </div>
              ))}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
            style={{ left: playheadLeft }}
          >
            <div className="absolute -top-0.5 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
          </div>

          {/* V1 Video */}
          <TimelineTrack
            label="V1"
            subLabel={t("Video")}
            locked={videoLocked}
            onToggleLock={() => setVideoLocked((v) => !v)}
            width={timelineWidth}
          >
            {videoClips.map((clip) => (
              <div
                key={clip.id}
                className={`absolute top-1 bottom-1 rounded-md overflow-hidden border-2 cursor-pointer transition-opacity ${
                  activeVideoClip?.id === clip.id
                    ? "border-blue-400 ring-1 ring-blue-400/50"
                    : "border-blue-600/60"
                } ${clip.ready ? "bg-blue-900/40" : "bg-slate-800/80 opacity-60"}`}
                style={{
                  left: clip.startSec * PX_PER_SEC,
                  width: Math.max(clip.durationSec * PX_PER_SEC - 2, 24),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(clip.startSec);
                }}
              >
                {clip.thumbUrl ? (
                  <img
                    src={clip.thumbUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-10 text-blue-200/70">
                    {clip.label}
                  </div>
                )}
                <span className="absolute bottom-0.5 left-1 text-10 font-medium text-white drop-shadow">
                  {String(clip.index).padStart(2, "0")}
                </span>
              </div>
            ))}
          </TimelineTrack>

          {/* A1 Voice */}
          <TimelineTrack
            label="A1"
            subLabel={t("Voice")}
            locked={audioLocked}
            onToggleLock={() => setAudioLocked((v) => !v)}
            icon={<HiVolumeUp className="text-emerald-400 text-xs" />}
            width={timelineWidth}
          >
            {voiceClips.map((clip) => (
              <div
                key={clip.id}
                className="absolute top-1.5 bottom-1.5 rounded-md overflow-hidden border border-emerald-500/50 bg-emerald-950/50 cursor-pointer hover:border-emerald-400"
                style={{
                  left: clip.startSec * PX_PER_SEC,
                  width: Math.max(clip.durationSec * PX_PER_SEC - 2, 20),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(clip.startSec);
                }}
                title={`${clip.character}: ${clip.text}`}
              >
                <WaveformBars seed={clip.id} />
              </div>
            ))}
          </TimelineTrack>

          {/* T1 Subtitle */}
          <TimelineTrack
            label="T1"
            subLabel={t("Phụ đề")}
            locked={subtitleLocked}
            onToggleLock={() => setSubtitleLocked((v) => !v)}
            width={timelineWidth}
            last
          >
            {subtitleClips.map((clip) => (
              <div
                key={clip.id}
                className={`absolute top-1 bottom-1 rounded px-1.5 py-0.5 overflow-hidden border cursor-pointer text-10 leading-tight truncate ${
                  selectedSubtitleId === clip.id
                    ? "border-orange-400 bg-orange-500/30 text-orange-100"
                    : "border-orange-600/50 bg-orange-950/40 text-orange-200/90 hover:border-orange-400"
                }`}
                style={{
                  left: clip.startSec * PX_PER_SEC,
                  width: Math.max(clip.durationSec * PX_PER_SEC - 2, 32),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSubtitle(clip);
                }}
                title={clip.text}
              >
                {clip.text || clip.character}
              </div>
            ))}
          </TimelineTrack>
        </div>
      </div>
    </div>
  );
}

function TimelineTrack({
  label,
  subLabel,
  locked,
  onToggleLock,
  icon,
  width,
  last,
  children,
}: {
  label: string;
  subLabel: string;
  locked: boolean;
  onToggleLock: () => void;
  icon?: React.ReactNode;
  width: number;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-14 ${last ? "" : "border-b border-slate-700/40"}`}
      style={{ width: width + TRACK_LABEL_W }}
    >
      <div
        className="flex-shrink-0 flex flex-col justify-center gap-0.5 px-2 border-r border-slate-700/50 bg-[#0a101c]"
        style={{ width: TRACK_LABEL_W }}
      >
        <div className="flex items-center gap-1">
          {icon}
          <span className="text-xs font-bold text-slate-300">{label}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            className="ml-auto p-0.5 border-0 bg-transparent cursor-pointer text-slate-500 hover:text-slate-300"
          >
            {locked ? <HiLockClosed className="text-xs" /> : <HiLockOpen className="text-xs" />}
          </button>
        </div>
        <span className="text-10 text-slate-500 truncate">{subLabel}</span>
      </div>
      <div className="relative flex-1 bg-slate-900/30">{children}</div>
    </div>
  );
}
