/**
 * Tab Studio — timeline CapCut: cắt video (kéo mép / Split), audio kẻ sọc + tên, phát đồng bộ.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiChevronDoubleLeft,
  HiChevronDown,
  HiEye,
  HiEyeOff,
  HiLockClosed,
  HiLockOpen,
  HiRefresh,
  HiStop,
  HiVolumeOff,
  HiVolumeUp,
} from "react-icons/hi";
import {
  RiDeleteBinLine,
  RiFullscreenLine,
  RiPauseFill,
  RiPlayFill,
  RiScissorsCutLine,
  RiSkipBackLine,
  RiSkipForwardLine,
} from "react-icons/ri";
import { toDownloadProxyUrl } from "../app/affiliate-video/shared/videoDownloadUtils";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import { Dropdown } from "../shared/utilities/popover/dropdown";
import { abortFfmpegBrowser } from "../video-affiliate-plus/ffmpeg-browser";
import {
  getFilmEntityVideoSrc,
  normalizeFilmImageSrc,
  rematerializeFilmSceneVideos,
} from "./api/generate-film-media";
import { formatFilmDialogueText } from "./film-dialogue";
import {
  downloadFilmStudioExport,
  exportFilmStudioTimeline,
  isFilmStudioExportAbortError,
  type FilmStudioExportResolution,
} from "./film-studio-export";
import {
  buildFilmStudioTimeline,
  buildVideoDragLayout,
  captureVideoFrameDataUrl,
  createFilmSceneFromVideoFile,
  cutFilmSceneVideoAfterLocal,
  cutFilmSceneVideoBeforeLocal,
  cutFilmSubtitleAfterPlayhead,
  cutFilmSubtitleBeforePlayhead,
  cutFilmVoiceAfterPlayhead,
  cutFilmVoiceBeforePlayhead,
  deleteFilmSceneFromTimeline,
  FILM_STUDIO_DEFAULT_SCENE_SEC,
  FILM_STUDIO_MIN_CLIP_SEC,
  FILM_STUDIO_PX_PER_SEC,
  FILM_STUDIO_TRACK_LABEL_W,
  findFilmStudioClipAtTime,
  insertFilmIndependentLine,
  insertFilmSceneAfter,
  moveFilmSceneByDropSec,
  patchFilmDialogueLineTiming,
  patchFilmDialogueLineVolume,
  readAudioUrlDurationSec,
  readVideoUrlDurationSec,
  refreshFilmStudioSceneDurations,
  resetFilmStudioTimelineFromScratch,
  resolveInsertStartAfterClip,
  splitFilmSceneAtLocalTime,
  splitFilmSubtitleAtPlayhead,
  trimFilmSceneVideoLeft,
  trimFilmSceneVideoRight,
  updateFilmSubtitleText,
  type FilmStudioSubtitleClip,
  type FilmStudioVideoClip,
  type FilmStudioVoiceClip
} from "./film-studio-timeline";
import type {
  FilmAspectRatio,
  FilmSceneRecord,
  FilmStudioSubtitleConfig,
  FilmStudioSubtitleStyle,
} from "./film-types";
import {
  normalizeFilmAudioVolume,
  normalizeFilmStudioSubtitleConfig,
} from "./film-types";

type Props = {
  /** Timeline Studio (bản edit riêng — không phải scenes gốc của tập) */
  scenes: FilmSceneRecord[];
  aspectRatio?: FilmAspectRatio;
  /** Cấu hình phụ đề đã lưu (project) */
  subtitleConfig?: FilmStudioSubtitleConfig | null;
  /** Lưu cấu hình phụ đề (debounce ở panel) */
  onSubtitleConfigChange?: (config: FilmStudioSubtitleConfig) => void;
  /** Âm lượng tiếng gốc track Video 0–100 (đã lưu theo project) */
  videoAudioVolume?: number;
  /** Lưu âm lượng tiếng gốc video */
  onVideoAudioVolumeChange?: (volume: number) => void;
  /** @deprecated Dùng videoAudioVolume */
  muteVideoAudio?: boolean;
  /** @deprecated Dùng onVideoAudioVolumeChange */
  onMuteVideoAudioChange?: (muted: boolean) => void;
  /** Lưu thay đổi timeline Studio (chỉ store studioTimelines) */
  onScenesChange?: (scenes: FilmSceneRecord[]) => void;
  /** Load scenes gốc từ Tạo video (read-only) — Làm lại Studio */
  onReloadScenes?: () => Promise<FilmSceneRecord[]>;
  /** Ghi đè timeline Studio (không đụng scenes gốc) */
  onReplaceScenes?: (scenes: FilmSceneRecord[]) => Promise<FilmSceneRecord[] | void>;
};

const TRACK_LABEL_W = FILM_STUDIO_TRACK_LABEL_W;
/** Bước scrub playhead khi kéo timeline */
const SCRUB_STEP_SEC = 0.2;
/** Mốc thời gian trên ruler timeline (0, 2, 4, 6, 8 …) */
const TIMELINE_RULER_STEP_SEC = 2;
const TIMELINE_ZOOM_MIN = 8;
const TIMELINE_ZOOM_MAX = 240;

const AUDIO_STRIPE_BG =
  "repeating-linear-gradient(-45deg, rgba(242,137,13,0.14) 0px, rgba(242,137,13,0.14) 6px, rgba(254,241,231,0.75) 6px, rgba(254,241,231,0.75) 12px)";

function snapScrubSec(sec: number): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.round(sec / SCRUB_STEP_SEC) * SCRUB_STEP_SEC;
}

function resolveFilmStudioVideoSrc(url?: string | null): string {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return toDownloadProxyUrl(s, true);
  return s;
}

function resolveFilmStudioAudioSrc(clip: FilmStudioVoiceClip, blobUrls: Map<string, string>): string {
  if (clip.voiceBlob) {
    const key = clip.id;
    let url = blobUrls.get(key);
    if (!url) {
      url = URL.createObjectURL(clip.voiceBlob);
      blobUrls.set(key, url);
    }
    return url;
  }
  const s = String(clip.voiceUrl || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return toDownloadProxyUrl(s, true);
  return s;
}

function normalizeHexColor(input: string | undefined, fallback: string): string {
  const s = String(input || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHexColor(hex, "#000000").slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

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

/** Đồng hồ trên preview — hiện rõ số giây (kèm 1 số thập phân). */
function formatReviewClock(sec: number): string {
  const total = Math.max(0, Number(sec) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const whole = Math.floor(s);
  const tenths = Math.min(9, Math.floor((s - whole) * 10));
  return `${m}:${String(whole).padStart(2, "0")}.${tenths}`;
}

/** Thanh dọc cao thấp ngẫu nhiên (ổn định theo clipId + index). */
const AUDIO_BAR_W = 1;
const AUDIO_BAR_GAP = 2;
const AUDIO_BAR_STEP = AUDIO_BAR_W + AUDIO_BAR_GAP;

function clipBarSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomAudioBarHeight(clipSeed: number, barIndex: number): number {
  let h = (clipSeed ^ Math.imul(barIndex + 1, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  const n = (h >>> 0) / 4294967296;
  return Math.max(3, Math.round(3 + n * 15));
}

function FilmVolumeSlider({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: number;
  onChange: (volume: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const vol = normalizeFilmAudioVolume(value);
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={vol}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 h-1.5 accent-orange-500 cursor-pointer disabled:opacity-40"
      />
      <span className="flex-shrink-0 w-9 text-right text-xs font-mono tabular-nums text-gray-600">
        {vol}%
      </span>
    </div>
  );
}

/** Thanh audio sát đáy — cao thấp ngẫu nhiên, không gợn sóng. */
function AudioSourceVisual({
  clipId,
  startPx,
  widthPx,
  hasAudio,
}: {
  clipId: string;
  startPx: number;
  widthPx: number;
  hasAudio: boolean;
}) {
  const clipSeed = useMemo(() => clipBarSeed(clipId || "audio"), [clipId]);
  const step = AUDIO_BAR_STEP;
  const firstIdx = Math.floor(Math.max(0, startPx) / step);
  const offsetX = -(Math.max(0, startPx) % step);
  const count = Math.max(1, Math.ceil((widthPx - offsetX) / step) + 1);
  const bars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: firstIdx + i,
        h: randomAudioBarHeight(clipSeed, firstIdx + i),
      })),
    [clipSeed, count, firstIdx]
  );
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${
        hasAudio ? "opacity-100" : "opacity-40"
      }`}
    >
      <div
        className="absolute left-0 right-0 bottom-0 top-0 flex items-end overflow-hidden pb-px"
        style={{ left: offsetX, gap: AUDIO_BAR_GAP }}
      >
        {bars.map((bar) => (
          <span
            key={bar.key}
            className="flex-shrink-0 rounded-sm bg-primary"
            style={{
              width: AUDIO_BAR_W,
              height: bar.h,
              opacity: hasAudio ? 0.75 : 0.35,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineEdgeHandle({
  side,
  visible,
  color,
  onPointerDown,
  title,
}: {
  side: "left" | "right";
  visible: boolean;
  /** primary = audio, sky = video, violet = phụ đề */
  color: "primary" | "sky" | "violet";
  onPointerDown: (e: React.PointerEvent) => void;
  title: string;
}) {
  const barColor =
    color === "sky" ? "#38bdf8" : color === "violet" ? "#a78bfa" : "#F2890D";
  return (
    <div
      data-handle={side}
      className="absolute top-0 bottom-0 z-30 cursor-ew-resize"
      style={{
        // Hit hẹp sát mép — để thân clip còn chỗ kéo đổi vị trí
        [side]: -4,
        width: 14,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        onPointerDown(e);
      }}
      title={title}
    >
      <div
        className={`absolute top-0 bottom-0 rounded-sm ${
          visible ? "opacity-100" : "opacity-0 group-hover:opacity-95"
        }`}
        style={{
          [side === "left" ? "left" : "right"]: 4,
          width: 4,
          backgroundColor: barColor,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.35)",
        }}
      />
    </div>
  );
}

type DragMode =
  | {
      kind: "video-left" | "video-right" | "video-move";
      sceneId: string;
      startX: number;
      origin: FilmSceneRecord;
      /** Bỏ seek playhead nếu đã kéo đủ xa */
      moved?: boolean;
      /** video-move: mốc startSec lúc bắt đầu kéo */
      originStartSec?: number;
      originDurationSec?: number;
    }
  | {
      kind: "line-left" | "line-right" | "line-move";
      sceneId: string;
      lineId: string;
      startX: number;
      originStartSec: number;
      originDuration: number;
      originTrimIn: number;
      /** voice: kéo mép cũng trim nguồn audio; subtitle: chỉ đổi timing hiện thị */
      track: "voice" | "subtitle";
      moved?: boolean;
    };

export default function FilmStudioPanel({
  scenes,
  aspectRatio: aspectRatioProp,
  subtitleConfig,
  onSubtitleConfigChange,
  videoAudioVolume: videoAudioVolumeProp,
  onVideoAudioVolumeChange,
  muteVideoAudio: muteVideoAudioProp,
  onMuteVideoAudioChange,
  onScenesChange,
  onReloadScenes,
  onReplaceScenes,
}: Props) {
  const { t } = useTranslation();
  const aspectRatio = aspectRatioProp ?? "16:9";
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogVideoRef = useRef<HTMLVideoElement>(null);
  const previewFullscreenRef = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<Map<string, string>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const dragRef = useRef<DragMode | null>(null);
  const scrubRef = useRef<{
    wasPlaying: boolean;
    scrollLeft: number;
  } | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const subtitleConfigTimerRef = useRef<number | null>(null);
  const historyRef = useRef<FilmSceneRecord[][]>([]);
  const futureRef = useRef<FilmSceneRecord[][]>([]);
  const videoInsertInputRef = useRef<HTMLInputElement>(null);
  const audioInsertInputRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const [localScenes, setLocalScenes] = useState(scenes);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [videoLocked, setVideoLocked] = useState(false);
  const [audioLocked, setAudioLocked] = useState(false);
  const [subtitleLocked, setSubtitleLocked] = useState(false);
  const resolvedVideoAudioVolumeProp =
    videoAudioVolumeProp != null
      ? normalizeFilmAudioVolume(videoAudioVolumeProp)
      : muteVideoAudioProp
        ? 0
        : 100;
  const [videoAudioVolume, setVideoAudioVolume] = useState(resolvedVideoAudioVolumeProp);
  const videoAudioVolumeRef = useRef(videoAudioVolume);
  videoAudioVolumeRef.current = videoAudioVolume;
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [timelineDrop, setTimelineDrop] = useState<{
    track: "video" | "audio";
    /** Vị trí con trỏ */
    sec: number;
    /** Mốc chèn thật (sau clip dưới con trỏ) — tránh ghost đè lên clip */
    insertSec: number;
  } | null>(null);
  const initialSubCfg = normalizeFilmStudioSubtitleConfig(subtitleConfig);
  const [showSubtitleOverlay, setShowSubtitleOverlay] = useState(initialSubCfg.showOverlay);
  const [subtitleStyle, setSubtitleStyle] = useState<FilmStudioSubtitleStyle>(initialSubCfg.style);
  /** Draft khi đang gõ — tránh clamp giữa chừng (gõ "4" của "40" bị nhảy max). */
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);
  const [widthPercentDraft, setWidthPercentDraft] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const dialogFrameRef = useRef<HTMLDivElement>(null);
  const subtitleOverlayDragRef = useRef<{
    kind: "move" | "resize-left" | "resize-right";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
  } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"subtitle" | "video" | "audio">("subtitle");
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [mediaEpoch, setMediaEpoch] = useState(0);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  /** Preview vị trí khi kéo video (clip đi theo chuột). */
  const [videoDragLeftSec, setVideoDragLeftSec] = useState<number | null>(null);
  const videoDragLeftSecRef = useRef<number | null>(null);
  /** Mốc thời gian dưới con trỏ khi kéo video — dùng cho slot thả. */
  const [videoDragPointerSec, setVideoDragPointerSec] = useState<number | null>(null);
  const videoDragPointerSecRef = useRef<number | null>(null);
  /** Preview vị trí khi kéo audio (clip đi theo chuột — tự do trên timeline). */
  const [audioDragLeftSec, setAudioDragLeftSec] = useState<number | null>(null);
  const audioDragLeftSecRef = useRef<number | null>(null);
  const localScenesRef = useRef(localScenes);
  localScenesRef.current = localScenes;
  const lastDragMovedRef = useRef(false);

  useEffect(() => {
    // Đang kéo clip — không ghi đè local bằng props (tránh snap về chỗ cũ)
    if (dragRef.current) return;
    setLocalScenes(scenes);
  }, [scenes]);

  useEffect(() => {
    setVideoAudioVolume(resolvedVideoAudioVolumeProp);
  }, [resolvedVideoAudioVolumeProp]);

  useEffect(() => {
    const vol = videoAudioVolumeRef.current / 100;
    const muted = videoAudioVolumeRef.current <= 0;
    const v = videoRef.current;
    if (v) {
      v.volume = vol;
      v.muted = muted;
    }
    const d = dialogVideoRef.current;
    if (d) {
      d.volume = vol;
      d.muted = muted;
    }
  }, [videoAudioVolume]);

  /** Hydrate cấu hình phụ đề từ project khi mở / reload */
  const lastHydratedSubtitleCfgRef = useRef("");
  useEffect(() => {
    const next = normalizeFilmStudioSubtitleConfig(subtitleConfig);
    const json = JSON.stringify(next);
    if (json === lastHydratedSubtitleCfgRef.current) return;
    lastHydratedSubtitleCfgRef.current = json;
    setShowSubtitleOverlay(next.showOverlay);
    setSubtitleStyle(next.style);
  }, [subtitleConfig]);

  const subtitleConfigRef = useRef({ showOverlay: showSubtitleOverlay, style: subtitleStyle });
  subtitleConfigRef.current = { showOverlay: showSubtitleOverlay, style: subtitleStyle };

  /** Debounce lưu cấu hình phụ đề */
  useEffect(() => {
    if (!onSubtitleConfigChange) return;
    const payload: FilmStudioSubtitleConfig = {
      showOverlay: showSubtitleOverlay,
      style: subtitleStyle,
    };
    const json = JSON.stringify(payload);
    if (json === lastHydratedSubtitleCfgRef.current) return;
    if (subtitleConfigTimerRef.current) window.clearTimeout(subtitleConfigTimerRef.current);
    subtitleConfigTimerRef.current = window.setTimeout(() => {
      lastHydratedSubtitleCfgRef.current = json;
      onSubtitleConfigChange(payload);
    }, 350);
    return () => {
      if (subtitleConfigTimerRef.current) window.clearTimeout(subtitleConfigTimerRef.current);
    };
  }, [showSubtitleOverlay, subtitleStyle, onSubtitleConfigChange]);

  const commitScenes = useCallback(
    (next: FilmSceneRecord[], opts?: { pushHistory?: boolean }) => {
      if (opts?.pushHistory !== false) {
        historyRef.current = [...historyRef.current.slice(-29), localScenesRef.current];
        futureRef.current = [];
      }
      setLocalScenes(next);
      localScenesRef.current = next;
      if (!onScenesChange) return;
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => {
        onScenesChange(next);
      }, 400);
    },
    [onScenesChange]
  );

  const handleVideoAudioVolumeChange = useCallback(
    (volume: number) => {
      const next = normalizeFilmAudioVolume(volume);
      setVideoAudioVolume(next);
      onVideoAudioVolumeChange?.(next);
      onMuteVideoAudioChange?.(next <= 0);
    },
    [onVideoAudioVolumeChange, onMuteVideoAudioChange]
  );

  const handleVoiceVolumeChange = useCallback(
    (clip: FilmStudioVoiceClip, volume: number) => {
      const vol = normalizeFilmAudioVolume(volume);
      const next = localScenesRef.current.map((s) => {
        if (s.id !== clip.sceneId) return s;
        if (clip.lineId) return patchFilmDialogueLineVolume(s, clip.lineId, vol);
        return { ...s, voiceVolume: vol, updatedAt: new Date().toISOString() };
      });
      commitScenes(next);
    },
    [commitScenes]
  );

  const timeline = useMemo(() => buildFilmStudioTimeline(localScenes), [localScenes]);
  const videoClips: FilmStudioVideoClip[] = useMemo(
    () =>
      timeline.videoClips.map((c) => {
        const scene = localScenes.find((s) => s.id === c.sceneId);
        const cached = scene ? blobUrlRef.current.get(scene.id) : "";
        const fromBlob = scene?.videoBlob ? getFilmEntityVideoSrc(scene) : "";
        const urlFromScene = resolveFilmStudioVideoSrc(scene?.videoUrl || c.videoUrl);
        const videoUrl = (cached || fromBlob || urlFromScene || "").trim();
        return {
          ...c,
          videoUrl,
          ready: c.ready || !!videoUrl,
          thumbUrl: normalizeFilmImageSrc(scene?.frameImageUrl) || undefined,
        };
      }),
    [timeline.videoClips, localScenes]
  );
  const voiceClips = timeline.voiceClips;
  const subtitleClips = timeline.subtitleClips;
  const totalSec = timeline.totalSec;

  const activeVideoClip = findFilmStudioClipAtTime(videoClips, currentSec);
  const selectedVideoClip =
    videoClips.find((c) => c.id === selectedVideoId) || activeVideoClip;
  /** Phụ đề đúng vùng thời gian playhead — dùng cho overlay preview. */
  const timedSubtitle = findFilmStudioClipAtTime(subtitleClips, currentSec);
  /** Clip phụ đề đang chọn / đang sửa trong inspector (có thể ngoài playhead). */
  const activeSubtitle =
    subtitleClips.find((s) => s.id === selectedSubtitleId) ?? timedSubtitle ?? null;
  const selectedVoiceClip =
    voiceClips.find((c) => c.id === selectedVoiceId) ||
    findFilmStudioClipAtTime(voiceClips, currentSec);

  const previewSrc = (activeVideoClip?.videoUrl || "").trim();
  const hasAnyPlayableVideo = videoClips.some((c) => c.ready && (c.videoUrl || "").trim());
  const hasAnyFrameThumb = videoClips.some((c) => !!(c.thumbUrl || "").trim());

  const [timelineViewportW, setTimelineViewportW] = useState(800);
  const [zoomPxPerSec, setZoomPxPerSec] = useState(FILM_STUDIO_PX_PER_SEC);

  const measureTimelineViewport = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    setTimelineViewportW((prev) => {
      const next = Math.max(200, w);
      return prev === next ? prev : next;
    });
  }, []);

  useLayoutEffect(() => {
    measureTimelineViewport();
  }, [localScenes.length, measureTimelineViewport]);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    measureTimelineViewport();
    const ro = new ResizeObserver(() => {
      measureTimelineViewport();
    });
    ro.observe(el);
    // Layout cha (flex) đôi khi chỉ ổn định sau 1–2 frame
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measureTimelineViewport();
      raf2 = requestAnimationFrame(measureTimelineViewport);
    });
    window.addEventListener("resize", measureTimelineViewport);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener("resize", measureTimelineViewport);
    };
  }, [localScenes.length, measureTimelineViewport]);

  /** Zoom timeline (px/giây); bề ngang tối thiểu = viewport để vẫn scroll được khi zoom out */
  const pxPerSec = Math.max(
    TIMELINE_ZOOM_MIN,
    Math.min(TIMELINE_ZOOM_MAX, zoomPxPerSec)
  );
  const audioDragExtentSec =
    audioDragLeftSec != null
      ? audioDragLeftSec +
        (voiceClips.find(
          (c) => draggingClipId === `${c.sceneId}:${c.lineId}:voice`
        )?.durationSec ?? 0)
      : 0;
  const timelineWidth = Math.max(
    totalSec * pxPerSec,
    timelineViewportW,
    audioDragExtentSec * pxPerSec
  );
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;

  const loadedClipIdRef = useRef<string | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const currentSecRef = useRef(currentSec);
  currentSecRef.current = currentSec;
  /** Phát riêng 1 clip video/audio — dừng đúng cuối clip */
  const soloRef = useRef<{
    kind: "video" | "audio";
    clipId: string;
    endSec: number;
  } | null>(null);
  const [soloPlayingId, setSoloPlayingId] = useState<string | null>(null);

  const findNextPlayableClip = useCallback(
    (fromIndex: number) => {
      for (let i = Math.max(0, fromIndex); i < videoClips.length; i++) {
        const c = videoClips[i];
        if (c.ready && (c.videoUrl || "").trim()) return c;
      }
      return null;
    },
    [videoClips]
  );

  const syncVideoToClip = useCallback(
    async (clip: FilmStudioVideoClip | null, timelineSec: number, shouldPlay: boolean) => {
      const dialogOpen = previewFullscreenRef.current;
      const v = dialogOpen ? dialogVideoRef.current : videoRef.current;
      const other = dialogOpen ? videoRef.current : dialogVideoRef.current;
      other?.pause();
      if (!v || !clip) return;
      const src = (clip.videoUrl || "").trim();
      if (!src) {
        v.pause();
        return;
      }

      const needReload = loadedClipIdRef.current !== clip.id;
      if (needReload) {
        loadedClipIdRef.current = clip.id;
        v.pause();
        v.src = src;
        v.load();
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            v.removeEventListener("loadeddata", finish);
            resolve();
          };
          v.addEventListener("loadeddata", finish);
          window.setTimeout(finish, 1200);
        });
        if (loadedClipIdRef.current !== clip.id) return;
      }

      const localTime = Math.max(0, timelineSec - clip.startSec + clip.trimInSec);
      v.playbackRate = playbackRate;
      const vol = videoAudioVolumeRef.current / 100;
      v.volume = vol;
      v.muted = videoAudioVolumeRef.current <= 0;
      if (Number.isFinite(localTime) && Math.abs(v.currentTime - localTime) > 0.12) {
        try {
          v.currentTime = localTime;
        } catch {
          /* ignore */
        }
      }

      if (shouldPlay && playingRef.current && soloRef.current?.kind !== "audio") {
        try {
          await v.play();
        } catch {
          /* autoplay */
        }
      } else {
        v.pause();
      }
    },
    [playbackRate]
  );

  const seekTo = useCallback(
    (sec: number, opts?: { play?: boolean; snap?: boolean }) => {
      const raw = opts?.snap ? snapScrubSec(sec) : sec;
      const clamped = Math.max(0, Math.min(totalSec, raw));
      setCurrentSec(clamped);
      currentSecRef.current = clamped;
      const clip = findFilmStudioClipAtTime(videoClips, clamped);

      if (opts?.play === true) {
        playingRef.current = true;
        setPlaying(true);
      } else if (opts?.play === false) {
        playingRef.current = false;
        setPlaying(false);
        videoRef.current?.pause();
        dialogVideoRef.current?.pause();
        audioElsRef.current.forEach((a) => a.pause());
      }

      const shouldPlay =
        opts?.play === true ? true : opts?.play === false ? false : playingRef.current;
      void syncVideoToClip(clip, clamped, shouldPlay);
    },
    [totalSec, videoClips, syncVideoToClip]
  );

  const secFromTimelineClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const scrollLeft = scrubRef.current?.scrollLeft ?? el.scrollLeft;
      const x = clientX - rect.left + scrollLeft;
      return snapScrubSec(Math.max(0, Math.min(totalSec, x / pxPerSecRef.current)));
    },
    [totalSec]
  );

  /** Thời gian tuyệt đối dưới con trỏ — không kẹp totalSec (kéo video ra mép phải). */
  const rawSecFromTimelineClientX = useCallback((clientX: number) => {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    return Math.max(0, x / Math.max(pxPerSecRef.current, 0.001));
  }, []);

  useEffect(() => {
    const clip = activeVideoClip;
    if (!clip) return;
    if (!(clip.videoUrl || "").trim()) {
      if (!playingRef.current) return;
      const idx = videoClips.findIndex((c) => c.id === clip.id);
      const next = findNextPlayableClip(idx + 1);
      if (next) seekTo(next.startSec, { play: true });
      else setPlaying(false);
      return;
    }
    void syncVideoToClip(clip, currentSec, playingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoClip?.id, activeVideoClip?.videoUrl, activeVideoClip?.trimInSec]);

  useEffect(() => {
    const v = previewFullscreenRef.current ? dialogVideoRef.current : videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  /** RAF playhead + sync voice tracks */
  useEffect(() => {
    if (!playing) {
      videoRef.current?.pause();
      dialogVideoRef.current?.pause();
      audioElsRef.current.forEach((a) => a.pause());
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const solo = soloRef.current;
      setCurrentSec((prev) => {
        const next = prev + dt * playbackRate;
        const hardEnd = solo ? solo.endSec : totalSec;
        if (next >= hardEnd - 0.01) {
          setPlaying(false);
          playingRef.current = false;
          soloRef.current = null;
          setSoloPlayingId(null);
          videoRef.current?.pause();
          dialogVideoRef.current?.pause();
          audioElsRef.current.forEach((a) => a.pause());
          return Math.min(next, hardEnd);
        }
        return next;
      });

      const tSec = currentSecRef.current + dt * playbackRate;

      if (solo?.kind === "audio") {
        videoRef.current?.pause();
        dialogVideoRef.current?.pause();
      voiceClips.forEach((clip) => {
        const src = resolveFilmStudioAudioSrc(clip, blobUrlRef.current);
        if (!src) return;
        let audio = audioElsRef.current.get(clip.id);
        if (!audio) {
          audio = new Audio();
          audio.preload = "auto";
          audioElsRef.current.set(clip.id, audio);
        }
        if (audio.src !== src) audio.src = src;
        audio.playbackRate = playbackRate;
        audio.volume = normalizeFilmAudioVolume(clip.volume) / 100;
          if (clip.id !== solo.clipId) {
            if (!audio.paused) audio.pause();
            return;
          }
        const end = clip.startSec + clip.durationSec;
        if (tSec >= clip.startSec && tSec < end) {
            const local = tSec - clip.startSec + (clip.trimInSec || 0);
          if (audio.paused || Math.abs(audio.currentTime - local) > 0.35) {
            try {
              audio.currentTime = local;
            } catch {
              /* ignore */
            }
            void audio.play().catch(() => undefined);
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      });
      } else if (solo?.kind === "video") {
        audioElsRef.current.forEach((a) => {
          if (!a.paused) a.pause();
        });
      } else {
        voiceClips.forEach((clip) => {
          const src = resolveFilmStudioAudioSrc(clip, blobUrlRef.current);
          if (!src) return;
          let audio = audioElsRef.current.get(clip.id);
          if (!audio) {
            audio = new Audio();
            audio.preload = "auto";
            audioElsRef.current.set(clip.id, audio);
          }
          if (audio.src !== src) audio.src = src;
          audio.playbackRate = playbackRate;
          audio.volume = normalizeFilmAudioVolume(clip.volume) / 100;
          const end = clip.startSec + clip.durationSec;
          if (tSec >= clip.startSec && tSec < end) {
            const local = tSec - clip.startSec + (clip.trimInSec || 0);
            if (audio.paused || Math.abs(audio.currentTime - local) > 0.35) {
              try {
                audio.currentTime = local;
              } catch {
                /* ignore */
              }
              void audio.play().catch(() => undefined);
            }
          } else if (!audio.paused) {
            audio.pause();
          }
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playbackRate, totalSec, voiceClips]);

  const clearSoloPlayback = useCallback(() => {
    soloRef.current = null;
    setSoloPlayingId(null);
  }, []);

  const playSoloVideo = useCallback(
    (clip: FilmStudioVideoClip) => {
      if (!(clip.videoUrl || "").trim()) {
        setToast(t("Clip này chưa có file video"));
        return;
      }
      if (soloPlayingId === clip.id && playing) {
        clearSoloPlayback();
        setPlaying(false);
        playingRef.current = false;
        videoRef.current?.pause();
        dialogVideoRef.current?.pause();
        audioElsRef.current.forEach((a) => a.pause());
        return;
      }
      setSelectedVideoId(clip.id);
      setSelectedVoiceId(null);
      setSelectedSubtitleId(null);
      setInspectorTab("video");
      const endSec = clip.startSec + clip.durationSec;
      soloRef.current = {
        kind: "video",
        clipId: clip.id,
        endSec,
      };
      setSoloPlayingId(clip.id);
      /** Playhead trong clip (chưa sát cuối) → phát tiếp; hết/ngoài clip → về đầu clip. */
      const playheadSec = currentSecRef.current;
      const insideClip =
        playheadSec >= clip.startSec && playheadSec < endSec - 0.05;
      seekTo(insideClip ? playheadSec : clip.startSec, { play: true, snap: true });
    },
    [soloPlayingId, playing, clearSoloPlayback, seekTo, t]
  );

  const playSoloAudio = useCallback(
    (clip: FilmStudioVoiceClip) => {
      const src = resolveFilmStudioAudioSrc(clip, blobUrlRef.current);
      if (!src) {
        setToast(t("Clip này chưa có file audio"));
        return;
      }
      if (soloPlayingId === clip.id && playing) {
        clearSoloPlayback();
        setPlaying(false);
        playingRef.current = false;
        videoRef.current?.pause();
        dialogVideoRef.current?.pause();
        audioElsRef.current.forEach((a) => a.pause());
        return;
      }
      setSelectedVoiceId(clip.id);
      setSelectedVideoId(clip.sceneId);
      setSelectedSubtitleId(null);
      setInspectorTab("audio");
      soloRef.current = {
        kind: "audio",
        clipId: clip.id,
        endSec: clip.startSec + clip.durationSec,
      };
      setSoloPlayingId(clip.id);
      videoRef.current?.pause();
      dialogVideoRef.current?.pause();
      seekTo(clip.startSec, { play: true, snap: true });
    },
    [soloPlayingId, playing, clearSoloPlayback, seekTo, t]
  );

  useEffect(() => {
    if (timedSubtitle) {
      setSubtitleDraft(timedSubtitle.text);
      setSelectedSubtitleId(timedSubtitle.id);
    }
  }, [timedSubtitle?.id]);

  useEffect(() => {
    previewFullscreenRef.current = previewFullscreen;
    loadedClipIdRef.current = null;
    const clip = findFilmStudioClipAtTime(videoClips, currentSecRef.current);
    void syncVideoToClip(clip, currentSecRef.current, playingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFullscreen]);

  useEffect(
    () => () => {
      blobUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlRef.current.clear();
      audioElsRef.current.forEach((a) => {
        a.pause();
        a.src = "";
      });
      audioElsRef.current.clear();
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      if (subtitleConfigTimerRef.current) {
        window.clearTimeout(subtitleConfigTimerRef.current);
        subtitleConfigTimerRef.current = null;
        onSubtitleConfigChange?.(subtitleConfigRef.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once on unmount
    []
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** Global pointer handlers for trim / move / scrub playhead */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const scrub = scrubRef.current;
      if (scrub) {
        // Chỉ đổi playhead — không khóa scroll ngang
        seekTo(secFromTimelineClientX(e.clientX), { play: false, snap: true });
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const dxPx = e.clientX - drag.startX;
      const dx = dxPx / pxPerSecRef.current;
      if (!drag.moved && Math.abs(dxPx) > 2) {
        drag.moved = true;
        if (
          drag.kind === "line-move" ||
          drag.kind === "line-left" ||
          drag.kind === "line-right"
        ) {
          setDraggingClipId(
            `${drag.sceneId}:${drag.lineId}:${drag.track === "subtitle" ? "sub" : "voice"}`
          );
        } else {
          setDraggingClipId(drag.sceneId);
        }
      }
      const scenesNow = localScenesRef.current;

      if (drag.kind === "video-left" || drag.kind === "video-right") {
        const patched =
          drag.kind === "video-left"
            ? trimFilmSceneVideoLeft(drag.origin, dx)
            : trimFilmSceneVideoRight(drag.origin, dx);
        const next = scenesNow.map((s) => (s.id === patched.id ? patched : s));
        setLocalScenes(next);
        localScenesRef.current = next;
        return;
      }

      if (drag.kind === "video-move") {
        if (!drag.moved) return;
        const originStart = drag.originStartSec ?? 0;
        const nextLeft = Math.max(0, originStart + dx);
        videoDragLeftSecRef.current = nextLeft;
        setVideoDragLeftSec(nextLeft);
        const pointerSec = rawSecFromTimelineClientX(e.clientX);
        videoDragPointerSecRef.current = pointerSec;
        setVideoDragPointerSec(pointerSec);
        return;
      }

      if (drag.kind === "line-left" || drag.kind === "line-right" || drag.kind === "line-move") {
        if (drag.kind === "line-move" && !drag.moved) return;
        const isVoiceTrack = drag.track === "voice";

        /** Audio body: kéo preview tự do theo chuột — commit khi thả. */
        if (drag.kind === "line-move" && isVoiceTrack) {
          const nextLeft = Math.max(0, drag.originStartSec + dx);
          audioDragLeftSecRef.current = nextLeft;
          setAudioDragLeftSec(nextLeft);
          return;
        }

        let startSec = drag.originStartSec;
        let duration = drag.originDuration;
        let trimIn = drag.originTrimIn;
        const end0 = drag.originStartSec + drag.originDuration;

        if (drag.kind === "line-move") {
          // Phụ đề: cập nhật live
          startSec = Math.max(0, drag.originStartSec + dx);
          duration = drag.originDuration;
          trimIn = drag.originTrimIn;
        } else if (drag.kind === "line-left") {
          const nextStart = Math.max(
            0,
            Math.min(end0 - FILM_STUDIO_MIN_CLIP_SEC, drag.originStartSec + dx)
          );
          const d = nextStart - drag.originStartSec;
          startSec = nextStart;
          duration = end0 - nextStart;
          if (isVoiceTrack) {
            // Kéo phải = cắt đầu (tăng trim). Kéo trái = kéo dài về trước;
            // hết trim nguồn (trimIn=0) vẫn cho dài timeline tự do.
            trimIn = Math.max(0, drag.originTrimIn + d);
          } else {
            trimIn = drag.originTrimIn;
          }
        } else {
          duration = Math.max(FILM_STUDIO_MIN_CLIP_SEC, drag.originDuration + dx);
          startSec = drag.originStartSec;
          trimIn = drag.originTrimIn;
        }
        const next = scenesNow.map((s) =>
          s.id === drag.sceneId
            ? patchFilmDialogueLineTiming(
                s,
                drag.lineId,
                isVoiceTrack
                  ? {
                      timelineStartSec: startSec,
                      timelineDurationSec: duration,
                      voiceTrimInSec: Math.max(0, trimIn),
                    }
                  : {
                      subtitleStartSec: startSec,
                      subtitleDurationSec: duration,
                    }
              )
            : s
        );
        setLocalScenes(next);
        localScenesRef.current = next;
      }
    };

    const onUp = (e: PointerEvent) => {
      const scrub = scrubRef.current;
      if (scrub) {
        scrubRef.current = null;
        const sec = secFromTimelineClientX(e.clientX);
        if (scrub.wasPlaying) {
          seekTo(sec, { play: true, snap: true });
        } else {
          seekTo(sec, { play: false, snap: true });
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDraggingClipId(null);
      lastDragMovedRef.current = !!drag.moved;

      if (drag.kind === "video-move") {
        const scenesBefore = localScenesRef.current;
        videoDragLeftSecRef.current = null;
        setVideoDragLeftSec(null);
        const pointerSec = videoDragPointerSecRef.current;
        videoDragPointerSecRef.current = null;
        setVideoDragPointerSec(null);
        if (drag.moved) {
          /** Thả theo vị trí con trỏ — khớp slot xanh đang hiện. */
          const dropSec =
            pointerSec != null && Number.isFinite(pointerSec)
              ? Math.max(0, pointerSec)
              : rawSecFromTimelineClientX(e.clientX);
          const next = moveFilmSceneByDropSec(scenesBefore, drag.sceneId, dropSec);
          commitScenes(next);
          const rebuilt = buildFilmStudioTimeline(next);
          const moved = rebuilt.videoClips.find((c) => c.sceneId === drag.sceneId);
          if (moved) {
            seekTo(moved.startSec + 0.01, { play: false, snap: true });
          }
          const beforeIds = scenesBefore
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((s) => s.id)
            .join("\0");
          const afterIds = next
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((s) => s.id)
            .join("\0");
          if (beforeIds !== afterIds) {
            setToast(t("Đã đổi vị trí video"));
          }
        } else {
          seekTo(secFromTimelineClientX(e.clientX), {
            play: playingRef.current,
            snap: true,
          });
        }
        return;
      }

      /** Audio: thả → ghi timelineStartSec tuyệt đối (kéo tự do). */
      if (drag.kind === "line-move" && drag.track === "voice") {
        const previewLeft = audioDragLeftSecRef.current;
        audioDragLeftSecRef.current = null;
        setAudioDragLeftSec(null);
        if (!drag.moved) {
          seekTo(secFromTimelineClientX(e.clientX), {
            play: playingRef.current,
            snap: true,
          });
          return;
        }
        const startSec =
          previewLeft != null && Number.isFinite(previewLeft)
            ? Math.max(0, previewLeft)
            : Math.max(0, drag.originStartSec);
        const scenesBefore = localScenesRef.current;
        const next = scenesBefore.map((s) => {
          if (s.id !== drag.sceneId) return s;
          const line = (s.dialogueLines || []).find((l) => l.id === drag.lineId);
          const freezeSubtitle =
            !line ||
            line.subtitleStartSec == null ||
            !Number.isFinite(line.subtitleStartSec);
          return patchFilmDialogueLineTiming(s, drag.lineId, {
            timelineStartSec: startSec,
            timelineDurationSec: drag.originDuration,
            voiceTrimInSec: Math.max(0, drag.originTrimIn),
            ...(freezeSubtitle
              ? {
                  subtitleStartSec: drag.originStartSec,
                  subtitleDurationSec:
                    line?.subtitleDurationSec != null &&
                    Number.isFinite(line.subtitleDurationSec)
                      ? Math.max(FILM_STUDIO_MIN_CLIP_SEC, line.subtitleDurationSec)
                      : drag.originDuration,
                }
              : {}),
          });
        });
        commitScenes(next);
        return;
      }

      if (drag.kind === "line-move" && !drag.moved) {
        seekTo(secFromTimelineClientX(e.clientX), {
          play: playingRef.current,
          snap: true,
        });
        return;
      }

      commitScenes(localScenesRef.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [commitScenes, seekTo, secFromTimelineClientX, rawSecFromTimelineClientX, t]);

  const beginTimelineScrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    scrubRef.current = {
      wasPlaying: playingRef.current,
      scrollLeft: timelineRef.current?.scrollLeft ?? 0,
    };
    seekTo(secFromTimelineClientX(e.clientX), { play: false, snap: true });
  };

  const beginSubtitleOverlayInteract = (
    e: React.PointerEvent,
    kind: "move" | "resize-left" | "resize-right"
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    subtitleOverlayDragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      origX: subtitleStyle.xPercent,
      origY: subtitleStyle.yPercent,
      origW: subtitleStyle.widthPercent,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = subtitleOverlayDragRef.current;
      const frame = previewFullscreenRef.current
        ? dialogFrameRef.current
        : previewFrameRef.current;
      if (!drag || !frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      if (drag.kind === "move") {
        setSubtitleStyle((s) => ({
          ...s,
          xPercent: Math.max(5, Math.min(95, drag.origX + dxPct)),
          yPercent: Math.max(8, Math.min(96, drag.origY + dyPct)),
        }));
        return;
      }
      if (drag.kind === "resize-right") {
        setSubtitleStyle((s) => ({
          ...s,
          widthPercent: Math.max(20, Math.min(100, drag.origW + dxPct * 2)),
        }));
        return;
      }
      // resize-left: mở rộng về trái → tăng width, dịch tâm nhẹ
      setSubtitleStyle((s) => {
        const nextW = Math.max(20, Math.min(100, drag.origW - dxPct * 2));
        const dW = nextW - drag.origW;
        return {
          ...s,
          widthPercent: nextW,
          xPercent: Math.max(5, Math.min(95, drag.origX - dW / 4)),
        };
      });
    };
    const onUp = () => {
      subtitleOverlayDragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  /** Lăn chuột = zoom; Shift + lăn = scroll ngang */
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (scrubRef.current) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY || e.deltaX;
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const contentX = cursorX + el.scrollLeft;
      const timeAtCursor = contentX / Math.max(pxPerSecRef.current, 0.001);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoomPxPerSec((prev) => {
        const next = Math.max(
          TIMELINE_ZOOM_MIN,
          Math.min(TIMELINE_ZOOM_MAX, prev * factor)
        );
        requestAnimationFrame(() => {
          const newScroll = timeAtCursor * next - cursorX;
          el.scrollLeft = Math.max(0, newScroll);
        });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [localScenes.length]);

  const togglePlay = () => {
    const hasAudio = voiceClips.some((c) => c.voiceUrl || c.voiceBlob);
    if (!hasAnyPlayableVideo && !hasAudio) return;

    if (playing) {
      videoRef.current?.pause();
      dialogVideoRef.current?.pause();
      audioElsRef.current.forEach((a) => a.pause());
      clearSoloPlayback();
      setPlaying(false);
      return;
    }

    clearSoloPlayback();

    const clipAtPlayhead = findFilmStudioClipAtTime(videoClips, currentSec);
    const insidePlayableVideo =
      !!clipAtPlayhead && !!(clipAtPlayhead.videoUrl || "").trim();

    /** Trong clip video → phát tiếp từ playhead; hết/ngoài video → về đầu rồi phát. */
    if (insidePlayableVideo) {
      seekTo(currentSec, { play: true });
      return;
    }

    const first = findNextPlayableClip(0);
    if (first) {
      seekTo(first.startSec, { play: true });
      return;
    }
    if (hasAudio) {
      seekTo(0, { play: true });
    }
  };

  const handleSelectSubtitle = (
    clip: FilmStudioSubtitleClip,
    opts?: { clientX?: number }
  ) => {
    setSelectedSubtitleId(clip.id);
    setSelectedVoiceId(null);
    setSelectedVideoId(null);
    setInspectorTab("subtitle");
    setSubtitleDraft(clip.text);
    const sec =
      opts?.clientX != null
        ? secFromTimelineClientX(opts.clientX)
        : clip.startSec;
    seekTo(sec, { play: playingRef.current, snap: true });
  };

  const handleUndo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(localScenes);
    setLocalScenes(prev);
    onScenesChange?.(prev);
  };

  const handleRedo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(localScenes);
    setLocalScenes(next);
    onScenesChange?.(next);
  };

  const handleReloadStudio = async () => {
    if (reloading || exporting) return;
    setReloading(true);
    setPlaying(false);
      setExportProgress(t("Đang gắn lại video từ đầu..."));
    try {
      const base = onReloadScenes
        ? await onReloadScenes()
        : localScenesRef.current.filter((s) => !s.studioDerived);

      setExportProgress(t("Đang sắp xếp lại theo Tạo video..."));
      let next = resetFilmStudioTimelineFromScratch(base);

      next = await rematerializeFilmSceneVideos(next, {
        onProgress: (done, total) => {
          setExportProgress(
            t("Đang gắn lại video {{done}}/{{total}}...", { done, total })
          );
        },
      });

      setExportProgress(t("Đang cập nhật độ dài video..."));
      next = await refreshFilmStudioSceneDurations(next, (scene) =>
        getFilmEntityVideoSrc(scene)
      );
      next = resetFilmStudioTimelineFromScratch(next);

      historyRef.current = [];
      futureRef.current = [];
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }

      blobUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlRef.current.clear();
      audioElsRef.current.forEach((a) => {
        try {
          a.pause();
          a.removeAttribute("src");
          a.load();
        } catch {
          /* ignore */
        }
      });
      audioElsRef.current.clear();
      loadedClipIdRef.current = null;

      if (onReplaceScenes) {
        const saved = await onReplaceScenes(next);
        if (Array.isArray(saved) && saved.length) next = saved;
      } else {
        onScenesChange?.(next);
      }

      setLocalScenes(next);
      localScenesRef.current = next;

      setSelectedSubtitleId(null);
      setSelectedVideoId(null);
      setSelectedVoiceId(null);
      setSubtitleDraft("");
      setCurrentSec(0);
      setMediaEpoch((n) => n + 1);
      setToast(t("Đã gắn lại đúng video từ tab Tạo video"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      setToast(msg || t("Tải lại thất bại"));
    } finally {
      setReloading(false);
      setExportProgress(null);
    }
  };

  const handleSplit = () => {
    if (inspectorTab === "subtitle" || selectedSubtitleId) {
      handleSplitSubtitle();
      return;
    }
    if (videoLocked) {
      setToast(t("Mở khóa track Video để cắt"));
      return;
    }
    const clip = selectedVideoId
      ? videoClips.find((c) => c.id === selectedVideoId)
      : activeVideoClip;
    if (!clip) {
      setToast(t("Chọn một clip video trên timeline"));
      return;
    }
    const local = currentSec - clip.startSec;
    const next = splitFilmSceneAtLocalTime(localScenes, clip.sceneId, local);
    if (next === localScenes || next.length === localScenes.length) {
      setToast(t("Đặt playhead giữa clip (cách ≥1s hai đầu) để cắt"));
      return;
    }
    commitScenes(next);
    setToast(t("Đã cắt clip thành 2 đoạn"));
  };

  const handleSplitSubtitle = () => {
    if (subtitleLocked) {
      setToast(t("Mở khóa track Phụ đề để cắt"));
      return;
    }
    const clip =
      (selectedSubtitleId ? subtitleClips.find((c) => c.id === selectedSubtitleId) : null) ||
      activeSubtitle;
    if (!clip?.lineId) {
      setToast(t("Chọn một block phụ đề trên timeline"));
      return;
    }
    if (currentSec < clip.startSec || currentSec > clip.startSec + clip.durationSec) {
      setToast(t("Đặt playhead trong block phụ đề đang chọn"));
      return;
    }
    const next = splitFilmSubtitleAtPlayhead(
      localScenes,
      clip.sceneId,
      clip.lineId,
      clip.startSec,
      clip.durationSec,
      currentSec
    );
    if (next === localScenes || next.every((s, i) => s === localScenes[i])) {
      setToast(t("Đặt playhead giữa block (cách ≥1s hai đầu) để cắt"));
      return;
    }
    commitScenes(next);
    setSelectedSubtitleId(`${clip.sceneId}:${clip.lineId}:sub`);
    setInspectorTab("subtitle");
    setToast(t("Đã cắt phụ đề thành 2 đoạn"));
  };

  /** Cắt bỏ đầu/đuôi video tại playhead */
  const handleCutVideoSide = (side: "before" | "after") => {
    if (videoLocked) {
      setToast(t("Mở khóa track Video để cắt"));
      return;
    }
    const clip =
      (selectedVideoId ? videoClips.find((c) => c.id === selectedVideoId) : null) ||
      activeVideoClip;
    if (!clip) {
      setToast(t("Chọn một clip video trên timeline"));
      return;
    }
    if (currentSec < clip.startSec || currentSec > clip.startSec + clip.durationSec) {
      setToast(t("Đặt playhead trong clip video đang chọn"));
      return;
    }
    const local = currentSec - clip.startSec;
    const scene = localScenes.find((s) => s.id === clip.sceneId);
    if (!scene) return;
    const patched =
      side === "before"
        ? cutFilmSceneVideoBeforeLocal(scene, local)
        : cutFilmSceneVideoAfterLocal(scene, local);
    if (patched === scene) {
      setToast(t("Playhead quá sát đầu/đuôi clip (cần ≥1s)"));
      return;
    }
    commitScenes(localScenes.map((s) => (s.id === patched.id ? patched : s)));
    setToast(side === "before" ? t("Đã cắt bỏ phần đầu video") : t("Đã cắt bỏ phần đuôi video"));
  };

  /** Cắt bỏ đầu/đuôi audio tại playhead */
  const handleCutAudioSide = (side: "before" | "after") => {
    if (audioLocked) {
      setToast(t("Mở khóa track Audio để cắt"));
      return;
    }
    const voice =
      (selectedVoiceId ? voiceClips.find((c) => c.id === selectedVoiceId) : null) ||
      findFilmStudioClipAtTime(voiceClips, currentSec);
    if (!voice?.lineId) {
      setToast(t("Chọn một clip audio trên timeline"));
      return;
    }
    if (currentSec < voice.startSec || currentSec > voice.startSec + voice.durationSec) {
      setToast(t("Đặt playhead trong clip audio đang chọn"));
      return;
    }
    const next = localScenes.map((s) => {
      if (s.id !== voice.sceneId) return s;
      return side === "before"
        ? cutFilmVoiceBeforePlayhead(
            s,
            voice.lineId!,
            voice.startSec,
            voice.durationSec,
            voice.trimInSec || 0,
            currentSec
          )
        : cutFilmVoiceAfterPlayhead(
            s,
            voice.lineId!,
            voice.startSec,
            voice.durationSec,
            voice.trimInSec || 0,
            currentSec
          );
    });
    const changed = next.some((s, i) => s !== localScenes[i]);
    if (!changed) {
      setToast(t("Playhead quá sát đầu/đuôi clip (cần ≥1s)"));
      return;
    }
    commitScenes(next);
    setToast(side === "before" ? t("Đã cắt bỏ phần đầu audio") : t("Đã cắt bỏ phần đuôi audio"));
  };

  /** Cắt bỏ đầu/đuôi phụ đề tại playhead */
  const handleCutSubtitleSide = (side: "before" | "after") => {
    if (subtitleLocked) {
      setToast(t("Mở khóa track Phụ đề để cắt"));
      return;
    }
    const sub =
      (selectedSubtitleId ? subtitleClips.find((c) => c.id === selectedSubtitleId) : null) ||
      activeSubtitle;
    if (!sub?.lineId) {
      setToast(t("Chọn một block phụ đề trên timeline"));
      return;
    }
    if (currentSec < sub.startSec || currentSec > sub.startSec + sub.durationSec) {
      setToast(t("Đặt playhead trong block phụ đề đang chọn"));
      return;
    }
    const next = localScenes.map((s) => {
      if (s.id !== sub.sceneId) return s;
      return side === "before"
        ? cutFilmSubtitleBeforePlayhead(
            s,
            sub.lineId!,
            sub.startSec,
            sub.durationSec,
            currentSec
          )
        : cutFilmSubtitleAfterPlayhead(
            s,
            sub.lineId!,
            sub.startSec,
            sub.durationSec,
            currentSec
          );
    });
    const changed = next.some((s, i) => s !== localScenes[i]);
    if (!changed) {
      setToast(t("Playhead quá sát đầu/đuôi clip (cần ≥1s)"));
      return;
    }
    commitScenes(next);
    setToast(
      side === "before" ? t("Đã cắt bỏ phần đầu phụ đề") : t("Đã cắt bỏ phần đuôi phụ đề")
    );
  };

  const handleDeleteAudio = (clipId?: string) => {
    if (audioLocked) {
      setToast(t("Mở khóa track Audio để xóa"));
      return;
    }
    const targetId = clipId || selectedVoiceId;
    const voice =
      (targetId ? voiceClips.find((c) => c.id === targetId) : null) ||
      findFilmStudioClipAtTime(voiceClips, currentSec);
    if (!voice) {
      setToast(t("Chọn một clip audio trên timeline"));
      return;
    }
    if (!window.confirm(t("Xóa audio khỏi timeline?"))) return;

    if (voice.lineId) {
        commitScenes(
        localScenes.map((s) => {
          if (s.id !== voice.sceneId) return s;
          const lines = s.dialogueLines || [];
          const target = lines.find((l) => l.id === voice.lineId);
          // Audio chèn trong Studio → xóa hẳn khỏi timeline
          if (target?.studioOnly) {
            const nextLines = lines.filter((l) => l.id !== voice.lineId);
            return {
                  ...s,
              dialogueLines: nextLines,
              dialogue: formatFilmDialogueText(nextLines.filter((l) => !l.studioOnly)),
              updatedAt: new Date().toISOString(),
            };
          }
          // Audio từ Tạo giọng → gỡ file audio khỏi track A1 (thoại/phụ đề giữ nguyên)
          const nextLines = lines.map((l) => {
            if (l.id !== voice.lineId) return l;
            const {
              voiceBlob: _blob,
              voiceUrl: _url,
              voiceLabel: _label,
              voiceId: _id,
              voiceSource: _src,
              voiceError: _err,
              voiceTrimInSec: _trim,
              ...rest
            } = l;
            return {
              ...rest,
                          voiceUrl: "",
                          voiceStatus: "pending" as const,
            };
          });
          return {
            ...s,
            dialogueLines: nextLines,
                  updatedAt: new Date().toISOString(),
          };
        })
      );
    } else {
      commitScenes(
        localScenes.map((s) => {
          if (s.id !== voice.sceneId) return s;
          const {
            voiceUrl: _u,
            voiceLabel: _l,
            voiceId: _i,
            voiceSource: _s,
            voiceError: _e,
            ...rest
          } = s;
          return {
            ...rest,
            voiceUrl: "",
            voiceStatus: "pending" as const,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    }
        setSelectedVoiceId(null);
    setInspectorTab("audio");
    setToast(t("Đã xóa audio khỏi timeline"));
  };

  const handleDeleteSubtitle = (clipId?: string, opts?: { confirm?: boolean }) => {
    if (subtitleLocked) {
      setToast(t("Mở khóa track Phụ đề để xóa"));
        return;
      }
    const targetId = clipId || selectedSubtitleId;
    const clip =
      (targetId ? subtitleClips.find((c) => c.id === targetId) : null) ||
      activeSubtitle;
    if (!clip?.lineId) {
      setToast(t("Chọn phụ đề trên timeline"));
      return;
    }
    if (opts?.confirm !== false && !window.confirm(t("Xóa phụ đề khỏi timeline?"))) return;

    commitScenes(
      localScenes.map((s) => {
        if (s.id !== clip.sceneId) return s;
        const lines = s.dialogueLines || [];
        const target = lines.find((l) => l.id === clip.lineId);
        if (!target) return s;

        const hasAudio = !!(target.voiceUrl || target.voiceBlob);
        // Phụ đề Studio (không audio) → xóa hẳn dòng
        if (target.studioOnly && !hasAudio) {
          const nextLines = lines.filter((l) => l.id !== clip.lineId);
          return {
            ...s,
            dialogueLines: nextLines,
            dialogue: formatFilmDialogueText(nextLines.filter((l) => !l.studioOnly)),
            updatedAt: new Date().toISOString(),
          };
        }

        // Còn audio / thoại gốc → chỉ gỡ chữ phụ đề + timing phụ đề riêng
        const nextLines = lines.map((l) =>
          l.id === clip.lineId
            ? {
                ...l,
                line: "",
                subtitleStartSec: undefined,
                subtitleDurationSec: undefined,
              }
            : l
        );
        return {
          ...s,
          dialogueLines: nextLines,
          dialogue: formatFilmDialogueText(nextLines.filter((l) => !l.studioOnly)),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setSelectedSubtitleId(null);
    setSubtitleDraft("");
    setInspectorTab("subtitle");
    setToast(t("Đã xóa phụ đề khỏi timeline"));
  };

  const handleDeleteVideo = (sceneId?: string) => {
    if (videoLocked) {
      setToast(t("Mở khóa track Video để xóa clip"));
      return;
    }
    const id = sceneId || selectedVideoId || activeVideoClip?.sceneId;
    if (!id) {
      setToast(t("Chọn clip video để xóa"));
      return;
    }
    if (!window.confirm(t("Xóa clip video khỏi timeline?"))) return;
    const next = deleteFilmSceneFromTimeline(localScenes, id);
    if (onReplaceScenes) {
      void (async () => {
        try {
          const saved = await onReplaceScenes(next);
          const resolved = Array.isArray(saved) ? saved : next;
          historyRef.current = [...historyRef.current.slice(-29), localScenesRef.current];
          futureRef.current = [];
          setLocalScenes(resolved);
          localScenesRef.current = resolved;
        } catch {
          commitScenes(next);
        }
      })();
    } else {
      commitScenes(next);
    }
    setSelectedVideoId(null);
    setToast(t("Đã xóa clip khỏi timeline"));
  };

  const handleDelete = () => {
    if (inspectorTab === "audio" || selectedVoiceId) {
      handleDeleteAudio();
      return;
    }
    if (inspectorTab === "subtitle" || selectedSubtitleId) {
      handleDeleteSubtitle();
      return;
    }
    handleDeleteVideo();
  };

  const handleSaveSubtitle = () => {
    if (subtitleLocked) {
      setToast(t("Mở khóa track Phụ đề để sửa"));
      return;
    }
    const clip =
      subtitleClips.find((s) => s.id === selectedSubtitleId) || activeSubtitle;
    if (!clip) return;
    commitScenes(
      localScenes.map((s) =>
        s.id === clip.sceneId ? updateFilmSubtitleText(s, clip.lineId, subtitleDraft) : s
      )
    );
    setToast(t("Đã lưu phụ đề"));
  };

  const setSubtitleClipEnabled = (clipId: string, enabled: boolean) => {
    const clip = subtitleClips.find((c) => c.id === clipId);
    if (!clip?.lineId) return;
    commitScenes(
      localScenes.map((s) => {
        if (s.id !== clip.sceneId) return s;
        const dialogueLines = (s.dialogueLines || []).map((l) =>
          l.id === clip.lineId ? { ...l, subtitleEnabled: enabled } : l
        );
        return { ...s, dialogueLines, updatedAt: new Date().toISOString() };
      })
    );
  };

  /** Bật/tắt tất cả block phụ đề trên timeline */
  const setAllSubtitleClipsEnabled = (enabled: boolean) => {
    setShowSubtitleOverlay(enabled);
    commitScenes(
      localScenes.map((s) => {
        const lines = s.dialogueLines || [];
        if (!lines.some((l) => String(l.line || "").trim())) return s;
        return {
          ...s,
          dialogueLines: lines.map((l) =>
            String(l.line || "").trim() ? { ...l, subtitleEnabled: enabled } : l
          ),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const enabledSubtitleCount = subtitleClips.filter((c) => c.enabled !== false).length;
  const shouldBurnSubtitles =
    showSubtitleOverlay && enabledSubtitleCount > 0;

  /** Chèn file video: nửa trái clip = trước, nửa phải = sau; gap = sau clip trước đó. */
  const resolveVideoInsertAnchor = (
    atSec?: number
  ): { afterSceneId: string | null; insertSec: number } => {
    const sec = atSec != null ? atSec : currentSec;
    if (atSec == null && selectedVideoId) {
      const selected = videoClips.find((c) => c.id === selectedVideoId);
      if (selected) {
        return {
          afterSceneId: selected.sceneId,
          insertSec: selected.startSec + selected.durationSec,
        };
      }
    }
    const at = findFilmStudioClipAtTime(videoClips, sec);
    if (at) {
      const mid = at.startSec + at.durationSec / 2;
      if (sec < mid) {
        const idx = videoClips.findIndex((c) => c.id === at.id);
        const prev = idx > 0 ? videoClips[idx - 1] : null;
        return {
          afterSceneId: prev?.sceneId ?? null,
          insertSec: at.startSec,
        };
      }
      return {
        afterSceneId: at.sceneId,
        insertSec: at.startSec + at.durationSec,
      };
    }
    const before = [...videoClips]
      .reverse()
      .find((c) => c.startSec + c.durationSec <= sec);
    return {
      afterSceneId: before?.sceneId ?? null,
      insertSec: before ? before.startSec + before.durationSec : 0,
    };
  };

  const handleInsertVideoFile = async (
    file: File | null,
    opts?: { atSec?: number }
  ) => {
    if (!file) return;
    if (videoLocked) {
      setToast(t("Mở khóa track Video để chèn"));
      return;
    }
    const template =
      localScenes.find((s) => s.id === (selectedVideoId || activeVideoClip?.sceneId)) ||
      localScenes[0];
    if (!template) return;

    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current.set(`insert-video:${Date.now()}:${file.name}`, objectUrl);
    let durationSec = 5;
    let thumbDataUrl: string | undefined;
    try {
      const [dur, thumb] = await Promise.all([
        readVideoUrlDurationSec(objectUrl),
        captureVideoFrameDataUrl(objectUrl),
      ]);
      durationSec = dur;
      thumbDataUrl = thumb;
    } catch {
      durationSec = 5;
    }

    const { afterSceneId, insertSec } = resolveVideoInsertAnchor(opts?.atSec);
    const newScene = createFilmSceneFromVideoFile({
      template,
      file,
      objectUrl,
      durationSec,
      thumbDataUrl,
    });
    const next = insertFilmSceneAfter(localScenes, afterSceneId, newScene);
    commitScenes(next);
    setSelectedVideoId(newScene.id);
    setInspectorTab("video");
    loadedClipIdRef.current = null;
    setMediaEpoch((n) => n + 1);

    const built = buildFilmStudioTimeline(next);
    const inserted = built.videoClips.find((c) => c.sceneId === newScene.id);
    const playUrl =
      resolveFilmStudioVideoSrc(newScene.videoUrl) ||
      getFilmEntityVideoSrc(newScene) ||
      objectUrl;
    if (inserted && playUrl) {
      blobUrlRef.current.set(newScene.id, playUrl);
      const start = inserted.startSec;
      setCurrentSec(start);
      currentSecRef.current = start;
      playingRef.current = false;
      setPlaying(false);
      void syncVideoToClip(
        {
          ...inserted,
          videoUrl: playUrl,
          ready: true,
          thumbUrl: normalizeFilmImageSrc(newScene.frameImageUrl) || undefined,
        },
        start,
        false
      );
    } else {
      seekTo(insertSec, { play: false });
    }
    setToast(
      afterSceneId
        ? t("Đã chèn video vào timeline")
        : t("Đã chèn video vào đầu timeline")
    );
  };

  const resolveAudioInsertAfter = (atSec?: number): FilmStudioVoiceClip | null => {
    if (atSec == null && selectedVoiceId) {
      return voiceClips.find((c) => c.id === selectedVoiceId) || null;
    }
    const sec = atSec != null ? atSec : currentSec;
    return (
      findFilmStudioClipAtTime(voiceClips, sec) ||
      [...voiceClips].reverse().find((c) => c.startSec + c.durationSec <= sec) ||
      null
    );
  };

  const resolveSubtitleInsertAfter = (): FilmStudioSubtitleClip | null => {
    if (selectedSubtitleId) {
      return subtitleClips.find((c) => c.id === selectedSubtitleId) || null;
    }
    return (
      findFilmStudioClipAtTime(subtitleClips, currentSec) ||
      [...subtitleClips]
        .reverse()
        .find((c) => c.startSec + c.durationSec <= currentSec) ||
      null
    );
  };

  const handleInsertAudioFile = async (
    file: File | null,
    opts?: { atSec?: number }
  ) => {
    if (!file) return;
    if (audioLocked) {
      setToast(t("Mở khóa track Audio để chèn"));
      return;
    }
    const after = resolveAudioInsertAfter(opts?.atSec);
    const hostSceneId =
      after?.sceneId ||
      selectedVideoId ||
      activeVideoClip?.sceneId ||
      localScenes[0]?.id;
    if (!hostSceneId) return;

    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current.set(`insert-audio:${Date.now()}:${file.name}`, objectUrl);
    let durationSec = FILM_STUDIO_MIN_CLIP_SEC + 1;
    try {
      durationSec = await readAudioUrlDurationSec(objectUrl);
    } catch {
      /* keep default */
    }
    durationSec = Math.max(FILM_STUDIO_MIN_CLIP_SEC, durationSec);
    const startSec =
      opts?.atSec != null
        ? Math.max(0, snapScrubSec(opts.atSec))
        : resolveInsertStartAfterClip(after);

    const { scenes: next, lineId, sceneId } = insertFilmIndependentLine(localScenes, {
      hostSceneId,
      startSec,
      durationSec,
      text: file.name.replace(/\.[^.]+$/, "") || "Audio",
      voiceUrl: objectUrl,
      voiceBlob: file,
      voiceLabel: file.name,
    });
    if (!lineId) return;
    commitScenes(next);
    setSelectedVoiceId(`${sceneId}:${lineId}`);
    setInspectorTab("audio");
    seekTo(startSec, { play: false });
    setToast(t("Đã chèn audio vào timeline"));
  };

  const isTimelineVideoFile = (file: File) =>
    file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name);
  const isTimelineAudioFile = (file: File) =>
    file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.name);

  const resolveVideoDropInsertSec = (sec: number): number =>
    resolveVideoInsertAnchor(sec).insertSec;

  const beginTimelineFileDrag = (track: "video" | "audio", e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    const sec = secFromTimelineClientX(e.clientX);
    const insertSec = track === "video" ? resolveVideoDropInsertSec(sec) : sec;
    setTimelineDrop({ track, sec, insertSec });
  };

  const endTimelineFileDrag = (e?: React.DragEvent) => {
    if (e) {
      const related = e.relatedTarget as Node | null;
      if (related && e.currentTarget.contains(related)) return;
    }
    setTimelineDrop(null);
  };

  const handleTimelineFileDrop = (
    track: "video" | "audio",
    e: React.DragEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sec = secFromTimelineClientX(e.clientX);
    setTimelineDrop(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (track === "video") {
      if (!isTimelineVideoFile(file)) {
        setToast(t("Kéo thả file video vào track Video"));
        return;
      }
      void handleInsertVideoFile(file, { atSec: sec });
      return;
    }
    if (!isTimelineAudioFile(file)) {
      setToast(t("Kéo thả file audio vào track Audio"));
      return;
    }
    void handleInsertAudioFile(file, { atSec: sec });
  };

  const handleInsertSubtitle = () => {
    if (subtitleLocked) {
      setToast(t("Mở khóa track Phụ đề để chèn"));
      return;
    }
    const text = window.prompt(t("Nội dung phụ đề mới"), t("Phụ đề mới"));
    if (text == null) return;
    const lineText = text.trim() || t("Phụ đề mới");

    const after = resolveSubtitleInsertAfter();
    const hostSceneId =
      after?.sceneId ||
      selectedVideoId ||
      activeVideoClip?.sceneId ||
      localScenes[0]?.id;
    if (!hostSceneId) return;

    const chars = lineText.length;
    const durationSec = Math.max(
      FILM_STUDIO_MIN_CLIP_SEC,
      Math.min(5, chars / 14 + 0.3)
    );
    const startSec = resolveInsertStartAfterClip(after);

    const { scenes: next, lineId, sceneId } = insertFilmIndependentLine(localScenes, {
      hostSceneId,
      startSec,
      durationSec,
      text: lineText,
      character: after?.character || "",
    });
    if (!lineId) return;
    commitScenes(next);
    const subId = `${sceneId}:${lineId}:sub`;
    setSelectedSubtitleId(subId);
    setSubtitleDraft(lineText);
    setInspectorTab("subtitle");
    seekTo(startSec, { play: false });
    setToast(t("Đã chèn phụ đề vào timeline"));
  };

  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
    abortFfmpegBrowser();
    setExportProgress(t("Đang dừng xuất…"));
  };

  const handleExportTimeline = async (
    formats: ("mp4" | "mp3")[],
    resolution: FilmStudioExportResolution = "source"
  ) => {
    if (exporting) return;
    const hasVideo = videoClips.some((c) => c.ready && resolveFilmStudioVideoSrc(c.videoUrl));
    const hasAudio = voiceClips.some((c) => !!(c.voiceUrl || c.voiceBlob));
    const selected = formats.filter((f) => (f === "mp4" ? hasVideo : hasAudio));
    if (!selected.length) {
      setToast(
        formats.includes("mp4") && !hasVideo
          ? t("Chưa có video sẵn sàng để xuất MP4")
          : t("Chưa có audio trên timeline để xuất MP3")
      );
      return;
    }
    const ac = new AbortController();
    exportAbortRef.current = ac;
    setExporting(true);
    setExportProgress(
      resolution === "1080p" ? t("Đang xuất 1080p...") : t("Đang xuất...")
    );
    setPlaying(false);
    try {
      const result = await exportFilmStudioTimeline(localScenesRef.current, {
        formats: selected,
        burnSubtitles: shouldBurnSubtitles,
        videoAudioVolume: videoAudioVolumeRef.current / 100,
        subtitleStyle,
        resolution,
        portrait: aspectRatio === "9:16",
        signal: ac.signal,
        onProgress: (p) => {
          if (ac.signal.aborted) return;
          setExportProgress(`${Math.round(p.ratio * 100)}% — ${p.message}`);
        },
      });
      if (ac.signal.aborted) {
        setToast(t("Đã dừng xuất"));
        return;
      }
      downloadFilmStudioExport(result, "film-studio");
      const parts: string[] = [];
      if (result.mp4) parts.push(resolution === "1080p" ? "MP4 1080p" : "MP4");
      if (result.mp3) parts.push(result.mp3.type.includes("wav") ? "WAV" : "MP3");
      if (result.mp4 && shouldBurnSubtitles) {
        if (result.subtitleMode === "hard") {
          setToast(t("Đã xuất {{formats}} (có phụ đề)", { formats: parts.join(" + ") }));
        } else if (result.subtitleMode === "none") {
          setToast(
            t("Đã xuất {{formats}} — không burn được phụ đề (kiểm tra mạng / font)", {
              formats: parts.join(" + "),
            })
          );
        } else {
          setToast(
            t("Đã xuất {{formats}} — không có phụ đề bật trên timeline", {
              formats: parts.join(" + "),
            })
          );
        }
      } else if (result.mp4 && showSubtitleOverlay && !shouldBurnSubtitles) {
        setToast(
          t("Đã xuất {{formats}} (đã tắt hết phụ đề — bỏ burn)", {
            formats: parts.join(" + "),
          })
        );
      } else {
        setToast(t("Đã xuất {{formats}}", { formats: parts.join(" + ") }));
      }
    } catch (err) {
      if (isFilmStudioExportAbortError(err) || ac.signal.aborted) {
        setToast(t("Đã dừng xuất"));
        return;
      }
      const msg = err instanceof Error ? err.message : String(err || "");
      setToast(msg || t("Xuất thất bại"));
    } finally {
      exportAbortRef.current = null;
      setExporting(false);
      setExportProgress(null);
    }
  };

  const beginVideoEdgeDrag = (
    kind: "video-left" | "video-right",
    clip: FilmStudioVideoClip,
    e: React.PointerEvent
  ) => {
    if (videoLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = localScenes.find((s) => s.id === clip.sceneId);
    if (!origin) return;
    setSelectedVideoId(clip.id);
    dragRef.current = { kind, sceneId: clip.sceneId, startX: e.clientX, origin };
  };

  const beginVideoMove = (clip: FilmStudioVideoClip, e: React.PointerEvent) => {
    if (videoLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = localScenes.find((s) => s.id === clip.sceneId);
    if (!origin) return;
    setSelectedVideoId(clip.id);
    setSelectedVoiceId(null);
    setInspectorTab("video");
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    videoDragLeftSecRef.current = clip.startSec;
    setVideoDragLeftSec(clip.startSec);
    videoDragPointerSecRef.current = clip.startSec + clip.durationSec * 0.5;
    setVideoDragPointerSec(clip.startSec + clip.durationSec * 0.5);
    setDraggingClipId(clip.sceneId);
    dragRef.current = {
      kind: "video-move",
      sceneId: clip.sceneId,
      startX: e.clientX,
      origin,
      moved: false,
      originStartSec: clip.startSec,
      originDurationSec: clip.durationSec,
    };
  };

  const beginLineDrag = (
    kind: "line-left" | "line-right" | "line-move",
    clip: {
      sceneId: string;
      lineId: string | null;
      startSec: number;
      durationSec: number;
      id: string;
      trimInSec?: number;
    },
    e: React.PointerEvent,
    opts?: { select?: "voice" | "subtitle" }
  ) => {
    if (!clip.lineId) return;
    e.preventDefault();
    e.stopPropagation();
    const track = opts?.select === "subtitle" ? "subtitle" : "voice";
    if (track === "subtitle") {
      setSelectedSubtitleId(`${clip.sceneId}:${clip.lineId}:sub`);
      setSelectedVoiceId(null);
      setInspectorTab("subtitle");
    } else {
    setSelectedVoiceId(clip.id);
      setSelectedSubtitleId(null);
      setInspectorTab("audio");
    }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = {
      kind,
      sceneId: clip.sceneId,
      lineId: clip.lineId,
      startX: e.clientX,
      originStartSec: clip.startSec,
      originDuration: clip.durationSec,
      originTrimIn: Math.max(0, clip.trimInSec ?? 0),
      track,
      moved: kind === "line-move" ? false : true,
    };
  };

  const beginVoiceDrag = (
    kind: "line-left" | "line-right" | "line-move",
    clip: FilmStudioVoiceClip,
    e: React.PointerEvent
  ) => {
    if (audioLocked) return;

    let dragClip = clip;
    // Scene-level voice (không có lineId) → tạo dòng studioOnly để kéo tự do được
    if (!dragClip.lineId) {
      const promoted = insertFilmIndependentLine(localScenesRef.current, {
        hostSceneId: dragClip.sceneId,
        startSec: dragClip.startSec,
        durationSec: dragClip.durationSec,
        character: dragClip.character,
        text: dragClip.text || dragClip.label || "Audio",
        voiceUrl: dragClip.voiceUrl,
        voiceBlob: dragClip.voiceBlob,
        voiceLabel: dragClip.label,
        voiceTrimInSec: dragClip.trimInSec,
      });
      if (!promoted.lineId) return;
      setLocalScenes(promoted.scenes);
      localScenesRef.current = promoted.scenes;
      dragClip = {
        ...dragClip,
        id: `${promoted.sceneId}:${promoted.lineId}`,
        lineId: promoted.lineId,
        kind: "line",
      };
      setSelectedVoiceId(dragClip.id);
    }

    if (kind === "line-move") {
      audioDragLeftSecRef.current = dragClip.startSec;
      setAudioDragLeftSec(dragClip.startSec);
      setDraggingClipId(`${dragClip.sceneId}:${dragClip.lineId}:voice`);
    }
    beginLineDrag(kind, dragClip, e, { select: "voice" });
  };

  const beginSubtitleDrag = (
    kind: "line-left" | "line-right" | "line-move",
    clip: FilmStudioSubtitleClip,
    e: React.PointerEvent
  ) => {
    if (subtitleLocked) return;
    const linkedVoice = voiceClips.find(
      (v) => v.sceneId === clip.sceneId && v.lineId === clip.lineId
    );
    beginLineDrag(
      kind,
      {
        ...clip,
        id: clip.id,
        lineId: clip.lineId,
        trimInSec: linkedVoice?.trimInSec ?? 0,
      },
      e,
      { select: "subtitle" }
    );
  };

  const playheadLeft = currentSec * pxPerSec;
  const isPortrait = aspectRatio === "9:16";
  const inspectorMode = inspectorTab;

  /** Slot preview khi kéo đổi vị trí video trên timeline */
  const videoDragLayout = useMemo(() => {
    if (!draggingClipId || videoDragLeftSec == null) return null;
    const self = videoClips.find((c) => c.sceneId === draggingClipId);
    if (!self) return null;
    const dropSec = Math.max(
      0,
      videoDragPointerSec != null
        ? videoDragPointerSec
        : videoDragLeftSec + Math.min(0.35, self.durationSec * 0.25)
    );
    return buildVideoDragLayout(videoClips, draggingClipId, dropSec);
  }, [draggingClipId, videoDragLeftSec, videoDragPointerSec, videoClips]);

  const videoDragOthersLeft = useMemo(() => {
    const map = new Map<string, number>();
    if (!videoDragLayout) return map;
    for (const o of videoDragLayout.others) {
      map.set(o.sceneId, o.startSec);
    }
    return map;
  }, [videoDragLayout]);

  if (!localScenes.length) {
    return (
      <div
        className="flex flex-col justify-center items-center w-full px-6 text-center bg-gray-100"
        style={{ minHeight: "calc(100vh - 7rem)" }}
      >
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <p className="m-0 text-base font-semibold text-gray-800">
          {t("Chưa có cảnh quay")}
        </p>
          <p className="mt-2 m-0 text-sm text-gray-500">
          {t("Tạo chuỗi cảnh quay trước khi mở Studio")}
        </p>
        </div>
      </div>
    );
  }

  /** Chiều cao cố định thanh timeline (neo đáy khi scroll trang Studio) */
  const TIMELINE_DOCK_H = 300;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full h-full bg-gray-100 gap-2  ">
      {toast || exportProgress ? (
        <div
          className="absolute z-50 left-1/4 top-3 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white shadow-lg flex items-center gap-2"
          style={{ maxWidth: "90%" }}
        >
          <span className="min-w-0 truncate">{exportProgress || toast}</span>
          {exporting ? (
            <button
              type="button"
              onClick={handleCancelExport}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-300 text-red-100 bg-red-600 hover:bg-red-500 cursor-pointer"
              title={t("Dừng xuất")}
            >
              <HiStop className="text-sm" />
              {t("Dừng")}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Preview + inspector — chiếm phần còn lại phía trên timeline */}
      <div className="grid flex-1 min-h-0 w-full grid-cols-1 md:grid-cols-4 gap-2 md:gap-3">
        {/* Preview trái */}  
        <section
          className="md:col-span-3 flex flex-col min-h-0 h-full min-w-0 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
            <h3 className="m-0 text-sm font-bold text-gray-800">{t("Preview")}</h3>
          </div>

          <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-black flex flex-col">
            <div
              className={`relative flex-1 min-h-0 w-full overflow-hidden ${
                isPortrait ? "flex justify-center items-center" : ""
              }`}
            >
              <div
                ref={previewFrameRef}
                className="relative w-full h-full"
                style={{
                  minHeight: 160,
                  ...(isPortrait ? { maxWidth: 260 } : null),
                }}
          >
            {hasAnyPlayableVideo ? (
              <>
                <video
                      key={`studio-preview-${mediaEpoch}`}
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-contain bg-black ${
                    previewSrc ? "opacity-100" : "opacity-0"
                  }`}
                  playsInline
                  muted={videoAudioVolume <= 0}
                  onEnded={() => {  
                        if (soloRef.current?.kind === "video") {
                          clearSoloPlayback();
                          setPlaying(false);
                          playingRef.current = false;
                          return;
                        }
                    const idx = videoClips.findIndex((c) => c.id === activeVideoClip?.id);
                    const next = findNextPlayableClip(idx + 1);
                    if (next) seekTo(next.startSec, { play: true });
                    else setPlaying(false);
                  }}
                />
                {!previewSrc ? (
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 px-4 text-gray-300 text-center pointer-events-none">
                    <p className="m-0 text-sm">
                      {t("Phân cảnh này chưa có video — kéo playhead tới clip đã gen.")}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
                  <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 px-4 text-gray-400 text-center">
                <span className="text-4xl opacity-40">▶</span>
                {hasAnyFrameThumb ? (
                  <>
                        <p className="m-0 text-sm text-gray-300">
                      {t("Timeline đang hiện khung hình — chưa có file video để phát.")}
                    </p>
                        <p className="m-0 text-xs text-gray-500">
                      {t("Vào tab Tạo video để gen video cho từng phân cảnh.")}
                    </p>
                  </>
                ) : (
                  <p className="m-0 text-sm">{t("Chưa có video — tạo video ở tab Tạo video")}</p>
                )}
              </div>
            )}

                {showSubtitleOverlay &&
                timedSubtitle?.text &&
                timedSubtitle.enabled !== false ? (
                  <div
                    className="absolute z-10 px-2 py-1 rounded-md text-center cursor-move select-none shadow-md"
                    style={{
                      left: `${subtitleStyle.xPercent}%`,
                      top: `${subtitleStyle.yPercent}%`,
                      width: `${subtitleStyle.widthPercent}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: Math.max(10, Math.round(subtitleStyle.fontSizePx * 0.55)),
                      lineHeight: 1.35,
                      color: subtitleStyle.textColor || "#ffffff",
                      backgroundColor: subtitleStyle.bgTransparent
                        ? "transparent"
                        : hexToRgba(subtitleStyle.bgColor || "#000000", 0.8),
                      borderWidth: subtitleStyle.borderTransparent ? 0 : 1,
                      borderStyle: "solid",
                      borderColor: subtitleStyle.borderTransparent
                        ? "transparent"
                        : hexToRgba(subtitleStyle.borderColor || "#ffffff", 0.35),
                    }}
                    onPointerDown={(e) => beginSubtitleOverlayInteract(e, "move")}
                    title={t("Kéo để đổi vị trí phụ đề")}
                  >
                    <span className="block break-words pointer-events-none">
                      {timedSubtitle.text}
                  </span>
                    <div
                      data-handle="sub-left"
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                      onPointerDown={(e) => beginSubtitleOverlayInteract(e, "resize-left")}
                      title={t("Kéo để đổi chiều ngang")}
                    />
                    <div
                      data-handle="sub-right"
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                      onPointerDown={(e) => beginSubtitleOverlayInteract(e, "resize-right")}
                      title={t("Kéo để đổi chiều ngang")}
                    />
                  </div>
                ) : null}

                {/* Đồng hồ + fullscreen trên khung video */}
                <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 px-3 py-2 pointer-events-none bg-gradient-to-t from-black/70 to-transparent">
                  <div
                    className="pointer-events-none font-mono font-semibold text-white tabular-nums drop-shadow"
                    style={{ fontSize: 12, letterSpacing: "0.02em", lineHeight: 1.2 }}
                    title={t("Thời gian timeline")}
                  >
                    <span>{formatReviewClock(currentSec)}</span>
                    <span className="opacity-70" style={{ fontSize: 12 }}>
                      {" / "}
                      {formatReviewClock(totalSec)}
                    </span>
                    <span className="ml-1 opacity-60" style={{ fontSize: 12 }}>
                      s
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewFullscreen(true)}
                    className="pointer-events-auto flex items-center justify-center w-6 h-6 rounded-xl  text-white hover:bg-opacity-70 cursor-pointer"
                    title={t("Xem to")}
                  >
                    <RiFullscreenLine className="text-xl" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Dialog
            isOpen={previewFullscreen}
            onClose={() => setPreviewFullscreen(false)}
            title={t("Preview")}
            width="92vw"
            maxWidth={isPortrait ? 480 : 1100}
            slideFromBottom="none"
            extraDialogClass="overflow-hidden"
            bodyClass="relative p-0 bg-black rounded-b-2xl"
          >
            <Dialog.Body>
              <div className="flex flex-col bg-black" style={{ maxHeight: "82vh" }}>
                <div
                  className={`relative w-full overflow-hidden bg-black ${
                    isPortrait ? "flex justify-center items-center mx-auto" : ""
                  }`}
                  style={
                    isPortrait
                      ? { height: "70vh", maxWidth: 420 }
                      : { height: "65vh", maxHeight: 620 }
                  }
                >
                  <div ref={dialogFrameRef} className="relative w-full h-full">
                    {hasAnyPlayableVideo ? (
                      <>
                        <video
                          key={`studio-dialog-${mediaEpoch}`}
                          ref={dialogVideoRef}
                          className={`absolute inset-0 w-full h-full object-contain bg-black ${
                            previewSrc ? "opacity-100" : "opacity-0"
                          }`}
                          playsInline
                          muted={videoAudioVolume <= 0}
                          onEnded={() => {
                            if (soloRef.current?.kind === "video") {
                              clearSoloPlayback();
                              setPlaying(false);
                              playingRef.current = false;
                              return;
                            }
                            const idx = videoClips.findIndex((c) => c.id === activeVideoClip?.id);
                            const next = findNextPlayableClip(idx + 1);
                            if (next) seekTo(next.startSec, { play: true });
                            else setPlaying(false);
                          }}
                        />
                        {!previewSrc ? (
                          <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 px-4 text-gray-300 text-center pointer-events-none">
                            <p className="m-0 text-sm">
                              {t("Phân cảnh này chưa có video — kéo playhead tới clip đã gen.")}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 px-4 text-gray-400 text-center">
                        <span className="text-4xl opacity-40">▶</span>
                        <p className="m-0 text-sm">{t("Chưa có video — tạo video ở tab Tạo video")}</p>
              </div>
            )}

                    {showSubtitleOverlay &&
                    timedSubtitle?.text &&
                    timedSubtitle.enabled !== false ? (
                      <div
                        className="absolute z-10 px-2 py-1 rounded-md text-center cursor-move select-none shadow-md"
                        style={{
                          left: `${subtitleStyle.xPercent}%`,
                          top: `${subtitleStyle.yPercent}%`,
                          width: `${subtitleStyle.widthPercent}%`,
                          transform: "translate(-50%, -50%)",
                          fontSize: subtitleStyle.fontSizePx,
                          lineHeight: 1.35,
                          color: subtitleStyle.textColor || "#ffffff",
                          backgroundColor: subtitleStyle.bgTransparent
                            ? "transparent"
                            : hexToRgba(subtitleStyle.bgColor || "#000000", 0.8),
                          borderWidth: subtitleStyle.borderTransparent ? 0 : 1,
                          borderStyle: "solid",
                          borderColor: subtitleStyle.borderTransparent
                            ? "transparent"
                            : hexToRgba(subtitleStyle.borderColor || "#ffffff", 0.35),
                        }}
                        onPointerDown={(e) => beginSubtitleOverlayInteract(e, "move")}
                        title={t("Kéo để đổi vị trí phụ đề")}
                      >
                        <span className="block break-words pointer-events-none">
                          {timedSubtitle.text}
                        </span>
                        <div
                          data-handle="sub-left"
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                          onPointerDown={(e) => beginSubtitleOverlayInteract(e, "resize-left")}
                          title={t("Kéo để đổi chiều ngang")}
                        />
                        <div
                          data-handle="sub-right"
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                          onPointerDown={(e) => beginSubtitleOverlayInteract(e, "resize-right")}
                          title={t("Kéo để đổi chiều ngang")}
                        />
                      </div>
                    ) : null}
                  </div>
          </div>

                <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 border-t border-gray-700">
                  <span
                    className="font-mono font-semibold text-white tabular-nums"
                    style={{ fontSize: 20 }}
                  >
                    {formatReviewClock(currentSec)}
                    <span className="opacity-70" style={{ fontSize: 15 }}>
                      {" / "}
                      {formatReviewClock(totalSec)}
                    </span>
                    <span className="ml-1 opacity-60" style={{ fontSize: 12 }}>
                      s
                    </span>
                  </span>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!hasAnyPlayableVideo}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:text-primary border text-white bg-transparent hover:bg-white hover:bg-opacity-15 cursor-pointer disabled:opacity-40"
                    title={playing ? t("Tạm dừng") : t("Phát")}
              >
                    {playing ? <RiPauseFill className="text-xl" /> : <RiPlayFill className="text-xl" />}
              </button>
                </div>
              </div>
            </Dialog.Body>
          </Dialog>

          <div className="flex-shrink-0 overflow-x-auto overflow-y-hidden h-scrollbar px-2 sm:px-3 py-1.5 border-t border-gray-100 bg-gray-50" style={{ scrollbarWidth: "thin" }}>
            <div className="flex items-center gap-1.5 flex-nowrap min-w-max">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!hasAnyPlayableVideo}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary hover:bg-primary-dark text-white cursor-pointer disabled:opacity-40 border-0"
              >
                {playing ? <RiPauseFill className="text-lg" /> : <RiPlayFill className="text-lg" />}
              </button>
              <button
                type="button"
                onClick={() => seekTo(0)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 cursor-pointer"
                title={t("Về đầu")}
              >
                <HiChevronDoubleLeft className="text-base" />
              </button>
              <div className="relative flex-shrink-0">
                <Button
                  small
                  outline
                  innerRef={exportBtnRef}
                  isLoading={exporting}
                  disabled={
                    exporting ||
                    (!hasAnyPlayableVideo &&
                      !voiceClips.some((c) => !!(c.voiceUrl || c.voiceBlob)))
                  }
                  className="!rounded-lg !border-violet-200 !text-violet-800 !bg-violet-50 hover:!bg-violet-100"
                  text={
                    <span className="inline-flex items-center gap-1">
                      {exporting ? t("Đang xuất…") : t("Xuất")}
                      <HiChevronDown className="text-sm opacity-80" />
                    </span>
                  }
                />
                <Dropdown reference={exportBtnRef} placement="bottom-end">
                  <Dropdown.Item
                    text={t("MP4")}
                    disabled={exporting || !hasAnyPlayableVideo}
                    onClick={() => void handleExportTimeline(["mp4"], "source")}
                  />
                  <Dropdown.Item
                    text={t("MP4 1080p")}
                    disabled={exporting || !hasAnyPlayableVideo}
                    onClick={() => void handleExportTimeline(["mp4"], "1080p")}
                  />
                  <Dropdown.Item
                    text={t("MP3")}
                    disabled={
                      exporting || !voiceClips.some((c) => !!(c.voiceUrl || c.voiceBlob))
                    }
                    onClick={() => void handleExportTimeline(["mp3"], "source")}
                  />
                  <Dropdown.Item
                    text={t("Tất cả (MP4 + MP3)")}
                    disabled={
                      exporting ||
                      (!hasAnyPlayableVideo &&
                        !voiceClips.some((c) => !!(c.voiceUrl || c.voiceBlob)))
                    }
                    onClick={() => void handleExportTimeline(["mp4", "mp3"], "source")}
                  />
                  <Dropdown.Item
                    text={t("Tất cả 1080p (MP4 + MP3)")}
                    disabled={
                      exporting ||
                      (!hasAnyPlayableVideo &&
                        !voiceClips.some((c) => !!(c.voiceUrl || c.voiceBlob)))
                    }
                    onClick={() => void handleExportTimeline(["mp4", "mp3"], "1080p")}
                  />
                </Dropdown>
              </div>
              <input
                ref={videoInsertInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.mkv"
                className="hidden"
                onChange={(e) => {
                  void handleInsertVideoFile(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              <input
                ref={audioInsertInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={(e) => {
                  void handleInsertAudioFile(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />

            <label className="flex-shrink-0 flex items-center gap-1.5 text-sm text-gray-600 ml-1">
                <span>{t("Tốc độ")}</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="px-2 py-1 text-xs rounded-md bg-white border border-gray-200 text-gray-800 outline-none"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <option key={r} value={r}>
                      {r}x
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Cột tab — nội dung scroll bên trong thẻ */}
        <aside
          className="md:col-span-1 flex flex-col min-h-0 h-full min-w-0 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex-shrink-0 px-2 sm:px-2.5 py-1.5 border-b border-gray-100">
            <div className="flex gap-0.5 sm:gap-1 p-0.5 rounded-lg bg-gray-100 border border-gray-200">
              {(
                [
                  ["subtitle", t("Phụ đề")],
                  ["video", t("Video")],
                  ["audio", t("Audio")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setInspectorTab(id);
                    if (id === "video" && selectedVideoClip) {
                      setSelectedVideoId(selectedVideoClip.id);
                      setSelectedVoiceId(null);
                    } else if (id === "audio" && selectedVoiceClip) {
                      setSelectedVoiceId(selectedVoiceClip.id);
                    } else if (id === "subtitle") {
                      setSelectedVoiceId(null);
                      if (!selectedSubtitleId && activeSubtitle) {
                        setSelectedSubtitleId(activeSubtitle.id);
                      }
                    }
                  }}
                  className={`flex-1 min-w-0 py-1.5 px-1 text-10 sm:text-xs font-semibold rounded-md border-0 cursor-pointer transition-colors truncate ${
                    inspectorMode === id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "bg-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>
        </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain v-scrollbar p-3 space-y-2.5" style={{ scrollbarWidth: "thin" }}>
            {inspectorMode === "video" && selectedVideoClip ? (
              <>
                <p className="m-0 text-sm font-semibold text-gray-900 truncate">
                  {selectedVideoClip.label}
                </p>
                <p className="m-0 text-xs text-gray-500 leading-relaxed">
                  {t("Kéo mép clip hoặc đặt playhead rồi Cắt bỏ đầu/đuôi.")}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    selectedVideoClip ? playSoloVideo(selectedVideoClip) : undefined
                  }
                  disabled={!selectedVideoClip?.videoUrl}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 cursor-pointer disabled:opacity-40"
                >
                  {soloPlayingId === selectedVideoClip?.id && playing ? (
                    <RiPauseFill />
                  ) : (
                    <RiPlayFill />
                  )}
                  {soloPlayingId === selectedVideoClip?.id && playing
                    ? t("Dừng nghe clip")
                    : t("Nghe clip video này")}
                </button>
                <label className="block">
                  <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                    {t("Âm lượng tiếng gốc")}
                  </span>
                  <div className="mt-1.5">
                    <FilmVolumeSlider
                      value={videoAudioVolume}
                      onChange={handleVideoAudioVolumeChange}
                    />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Trim in")}
                    </span>
                    <input
                      readOnly
                      value={formatTimecode(selectedVideoClip.trimInSec)}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                    />
                  </label>
                  <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Độ dài")}
                    </span>
                    <input
                      readOnly
                      value={`${selectedVideoClip.durationSec.toFixed(1)}s`}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                    />
                  </label>
          </div>
                <button
                  type="button"
                  onClick={handleSplit}
                  disabled={videoLocked}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 cursor-pointer disabled:opacity-40"
                >
                  <RiScissorsCutLine />
                  {t("Tách thành 2 đoạn")}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCutVideoSide("before")}
                    disabled={videoLocked}
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đầu")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCutVideoSide("after")}
                    disabled={videoLocked}
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đuôi")}
                  </button>
                </div>
                <p className="m-0 text-10 text-gray-400">
                  {t("Hoặc kéo mép xanh trên clip video để cắt đầu/đuôi.")}
                </p>
                <button
                  type="button"
                  onClick={() => videoInsertInputRef.current?.click()}
                  disabled={videoLocked}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 cursor-pointer disabled:opacity-40"
                >
                  {t("Chèn video sau clip này")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVideo(selectedVideoClip?.sceneId)}
                  disabled={videoLocked || !selectedVideoClip}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 cursor-pointer disabled:opacity-40"
                >
                  <RiDeleteBinLine />
                  {t("Xóa video")}
                </button>
                <p className="m-0 text-10 text-gray-400">
                  {t("Kéo thả file video vào track Video, hoặc Chèn từ đây. Kéo clip để đổi thứ tự.")}
                </p>
              </>
            ) : null}

            {inspectorMode === "video" && !selectedVideoClip ? (
              <p className="m-0 text-sm text-gray-500">
                {t("Chọn một clip video trên timeline")}
              </p>
            ) : null}

            {inspectorMode === "audio" ? (
              <>
                <p className="m-0 text-sm font-semibold text-gray-900 truncate">
                  {selectedVoiceClip?.label || t("Chưa chọn audio")}
                </p>
                {selectedVoiceClip?.character ? (
                  <p className="m-0 text-xs text-emerald-700">
                    {t("Nhân vật")}: {selectedVoiceClip.character}
                  </p>
                ) : null}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Start")}
                    </span>
                    <input
                      readOnly
                      value={formatTimecode(selectedVoiceClip?.startSec ?? 0)}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                    />
                  </label>
                  <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("End")}
                    </span>
                    <input
                      readOnly
                      value={formatTimecode(
                        (selectedVoiceClip?.startSec ?? 0) +
                          (selectedVoiceClip?.durationSec ?? 0)
                      )}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                    />
                  </label>
                </div>
                <div
                  className="h-12 rounded-lg overflow-hidden border border-primary border-opacity-30 relative"
                  style={{ background: AUDIO_STRIPE_BG }}
                >
                  {selectedVoiceClip ? (
                    <AudioSourceVisual
                      clipId={selectedVoiceClip.id}
                      startPx={0}
                      widthPx={240}
                      hasAudio={
                        !!(selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob)
                      }
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-primary-dark truncate pointer-events-none">
                    {selectedVoiceClip?.label || t("Audio source")}
                  </span>
                </div>
                {selectedVoiceClip &&
                (selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob) ? (
                  <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Âm lượng clip")}
                    </span>
                    <div className="mt-1.5">
                      <FilmVolumeSlider
                        value={selectedVoiceClip.volume}
                        onChange={(vol) => handleVoiceVolumeChange(selectedVoiceClip, vol)}
                        disabled={audioLocked}
                      />
                    </div>
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    selectedVoiceClip ? playSoloAudio(selectedVoiceClip) : undefined
                  }
                  disabled={
                    !selectedVoiceClip ||
                    !(selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob)
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-primary border-opacity-40 text-primary-dark bg-primary-light hover:opacity-90 cursor-pointer disabled:opacity-40"
                >
                  {soloPlayingId === selectedVoiceClip?.id && playing ? (
                    <RiPauseFill />
                  ) : (
                    <RiPlayFill />
                  )}
                  {soloPlayingId === selectedVoiceClip?.id && playing
                    ? t("Dừng nghe clip")
                    : t("Nghe clip audio này")}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCutAudioSide("before")}
                    disabled={
                      audioLocked ||
                      !selectedVoiceClip?.lineId ||
                      !(selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob)
                    }
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đầu")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCutAudioSide("after")}
                    disabled={
                      audioLocked ||
                      !selectedVoiceClip?.lineId ||
                      !(selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob)
                    }
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đuôi")}
                  </button>
                </div>
                <p className="m-0 text-10 text-gray-400">
                  {t("Đặt playhead trong clip rồi cắt, hoặc kéo mép clip audio.")}
                </p>
                <button
                  type="button"
                  onClick={() => audioInsertInputRef.current?.click()}
                  disabled={audioLocked}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer disabled:opacity-40"
                >
                  {t("Chèn audio sau clip này")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAudio(selectedVoiceClip?.id ?? undefined)}
                  disabled={
                    audioLocked ||
                    !selectedVoiceClip ||
                    !(selectedVoiceClip.voiceUrl || selectedVoiceClip.voiceBlob)
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 cursor-pointer disabled:opacity-40"
                >
                  <RiDeleteBinLine />
                  {t("Xóa audio")}
                </button>
              </>
            ) : null}

            {inspectorMode === "subtitle" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Start")}
                    </span>
                <input
                  readOnly
                  value={formatTimecode(activeSubtitle?.startSec ?? 0)}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                />
              </label>
              <label className="block">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("End")}
                    </span>
                <input
                  readOnly
                  value={formatTimecode(
                    (activeSubtitle?.startSec ?? 0) + (activeSubtitle?.durationSec ?? 0)
                  )}
                      className="mt-1 w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-gray-50 border border-gray-200 text-gray-800"
                />
              </label>
            </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCutSubtitleSide("before")}
                    disabled={subtitleLocked || !activeSubtitle?.lineId}
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đầu")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCutSubtitleSide("after")}
                    disabled={subtitleLocked || !activeSubtitle?.lineId}
                    className="flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Cắt bỏ đuôi")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSplitSubtitle}
                  disabled={subtitleLocked || !activeSubtitle?.lineId}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                >
                  <RiScissorsCutLine />
                  {t("Split tại playhead")}
                </button>
                <p className="m-0 text-10 text-gray-400">
                  {t("Đặt playhead trong block rồi cắt, hoặc kéo mép clip phụ đề.")}
                </p>

                <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <span className="text-10 font-semibold text-gray-600 uppercase tracking-wide">
                    {t("Hiện tất cả phụ đề")}
                  </span>
                  <input
                    type="checkbox"
                    checked={showSubtitleOverlay}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setShowSubtitleOverlay(on);
                      if (on && enabledSubtitleCount === 0 && subtitleClips.length > 0) {
                        setAllSubtitleClipsEnabled(true);
                      }
                    }}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
            </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllSubtitleClipsEnabled(true)}
                    disabled={subtitleLocked || !subtitleClips.length}
                    className="flex-1 py-1.5 text-10 font-semibold rounded-lg border border-violet-200 text-violet-800 bg-violet-50 hover:bg-violet-100 cursor-pointer disabled:opacity-40"
                  >
                    {t("Bật tất cả")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllSubtitleClipsEnabled(false)}
                    disabled={subtitleLocked || !subtitleClips.length}
                    className="flex-1 py-1.5 text-10 font-semibold rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40"
                  >
                    {t("Tắt tất cả")}
                  </button>
                </div>
                {activeSubtitle?.lineId ? (
                  <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-violet-100 bg-violet-50">
                    <span className="text-10 font-semibold text-violet-800 uppercase tracking-wide">
                      {t("Hiện phụ đề này")}
                    </span>
                    <input
                      type="checkbox"
                      checked={activeSubtitle.enabled !== false}
                      onChange={(e) =>
                        setSubtitleClipEnabled(activeSubtitle.id, e.target.checked)
                      }
                      className="w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                  </label>
                ) : null}

                <div className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Cỡ chữ")}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={
                          fontSizeDraft != null
                            ? fontSizeDraft
                            : String(subtitleStyle.fontSizePx)
                        }
                        onFocus={() => setFontSizeDraft(String(subtitleStyle.fontSizePx))}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                          setFontSizeDraft(raw);
                        }}
                        onBlur={() => {
                          const n = Number(fontSizeDraft);
                          const next = Number.isFinite(n)
                            ? Math.max(11, Math.min(40, Math.round(n)))
                            : subtitleStyle.fontSizePx;
                          setSubtitleStyle((s) => ({ ...s, fontSizePx: next }));
                          setFontSizeDraft(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-14 px-1.5 py-1 text-xs font-mono text-right rounded-md border border-gray-200 bg-white text-gray-800 outline-none focus:border-sky-400"
                      />
                      <span className="text-10 text-gray-400">px</span>
                    </div>
                  </div>
                </div>

                <div className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Chiều ngang")}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={
                          widthPercentDraft != null
                            ? widthPercentDraft
                            : String(Math.round(subtitleStyle.widthPercent))
                        }
                        onFocus={() =>
                          setWidthPercentDraft(String(Math.round(subtitleStyle.widthPercent)))
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                          setWidthPercentDraft(raw);
                        }}
                        onBlur={() => {
                          const n = Number(widthPercentDraft);
                          const next = Number.isFinite(n)
                            ? Math.max(20, Math.min(100, Math.round(n)))
                            : subtitleStyle.widthPercent;
                          setSubtitleStyle((s) => ({ ...s, widthPercent: next }));
                          setWidthPercentDraft(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-14 px-1.5 py-1 text-xs font-mono text-right rounded-md border border-gray-200 bg-white text-gray-800 outline-none focus:border-sky-400"
                      />
                      <span className="text-10 text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Màu chữ")}
                    </span>
                    <input
                      type="color"
                      value={normalizeHexColor(subtitleStyle.textColor, "#ffffff")}
                      onChange={(e) =>
                        setSubtitleStyle((s) => ({ ...s, textColor: e.target.value }))
                      }
                      className="w-9 h-7 p-0 border border-gray-200 rounded cursor-pointer bg-white"
                      title={t("Màu chữ")}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Màu nền")}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-10 text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.bgTransparent}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              bgTransparent: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 accent-amber-600 cursor-pointer"
                        />
                        {t("Trong suốt")}
                      </label>
                      <input
                        type="color"
                        value={normalizeHexColor(subtitleStyle.bgColor, "#000000")}
                        disabled={subtitleStyle.bgTransparent}
                        onChange={(e) =>
                          setSubtitleStyle((s) => ({ ...s, bgColor: e.target.value }))
                        }
                        className="w-9 h-7 p-0 border border-gray-200 rounded cursor-pointer bg-white disabled:opacity-40"
                        title={t("Màu nền")}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                      {t("Màu viền")}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-10 text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.borderTransparent}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              borderTransparent: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 accent-amber-600 cursor-pointer"
                        />
                        {t("Trong suốt")}
                      </label>
                      <input
                        type="color"
                        value={normalizeHexColor(subtitleStyle.borderColor, "#ffffff")}
                        disabled={subtitleStyle.borderTransparent}
                        onChange={(e) =>
                          setSubtitleStyle((s) => ({ ...s, borderColor: e.target.value }))
                        }
                        className="w-9 h-7 p-0 border border-gray-200 rounded cursor-pointer bg-white disabled:opacity-40"
                        title={t("Màu viền")}
                      />
                    </div>
                  </div>
                </div>

                <p className="m-0 text-10 text-gray-400">
                  {t("Kéo phụ đề trên preview để đổi vị trí; kéo mép trái/phải để đổi chiều ngang.")}
                </p>

                <label className="block">
                  <span className="text-10 font-semibold text-gray-500 uppercase tracking-wide">
                    {t("Text")}
                  </span>
              <textarea
                value={subtitleDraft}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                    rows={2}
                disabled={subtitleLocked}
                placeholder={t("Chọn block phụ đề trên timeline...")}
                    className="mt-1 w-full px-3 py-2.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-900 outline-none focus:border-sky-400 resize-none disabled:opacity-50"
              />
            </label>
                <button
                  type="button"
                  onClick={handleInsertSubtitle}
                  disabled={subtitleLocked}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-40"
                >
                  {t("Chèn phụ đề sau clip này")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSubtitle(activeSubtitle?.id)}
                  disabled={subtitleLocked || !activeSubtitle?.lineId}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 cursor-pointer disabled:opacity-40"
                >
                  <RiDeleteBinLine />
                  {t("Xóa phụ đề")}
                </button>
                <p className="m-0 text-10 text-gray-400">
                  {t("Chọn block phụ đề → Chèn → block mới nằm ngay sau trên timeline riêng.")}
                </p>
              </>
            ) : null}
          </div>

          {inspectorMode === "subtitle" ? (
            <div className="flex-shrink-0 p-4 border-t border-gray-100 space-y-2">
            <button
              type="button"
              disabled={!subtitleDraft.trim() || subtitleLocked}
              onClick={handleSaveSubtitle}
                className="w-full py-2.5 text-sm font-semibold rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 cursor-pointer disabled:opacity-40"
            >
              {t("Lưu phụ đề")}
            </button>
          </div>
          ) : null}
        </aside>
      </div>

      {/* Timeline — neo đáy panel Studio */}
      <section
        className="z-20 flex flex-col flex-shrink-0 w-full overflow-hidden border border-gray-200 bg-white shadow rounded-lg"
        style={{ height: TIMELINE_DOCK_H, minHeight: TIMELINE_DOCK_H, maxHeight: TIMELINE_DOCK_H }}
      >
        <div className="flex flex-wrap gap-2 items-center justify-end px-3 sm:px-4 py-0.5 sm:py-1 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex flex-wrap gap-1">
            <ToolBtn
              title={t("Làm lại — lấy đúng video từ tab Tạo video")}
              onClick={() => void handleReloadStudio()}
              disabled={reloading || exporting}
            >
              <HiRefresh className={`text-sm ${reloading ? "animate-spin" : ""}`} />
            </ToolBtn>
            <ToolBtn title={t("Undo")} onClick={handleUndo}>
              <RiSkipBackLine className="text-sm" />
            </ToolBtn>
            <ToolBtn title={t("Redo")} onClick={handleRedo}>
              <RiSkipForwardLine className="text-sm" />
            </ToolBtn>
            <ToolBtn title={t("Split")} onClick={handleSplit} accent>
              <RiScissorsCutLine className="text-sm" />
            </ToolBtn>
            <div className="flex items-center gap-1.5 px-0.5">
              <ToolBtn
                title={
                  videoAudioVolume <= 0
                    ? t("Bật tiếng gốc video")
                    : t("Tắt tiếng gốc video")
                }
                onClick={() =>
                  handleVideoAudioVolumeChange(videoAudioVolume <= 0 ? 100 : 0)
                }
                accent={videoAudioVolume <= 0}
              >
                {videoAudioVolume <= 0 ? (
                  <HiVolumeOff className="text-sm" />
                ) : (
                  <HiVolumeUp className="text-sm" />
                )}
              </ToolBtn>
              <FilmVolumeSlider
                value={videoAudioVolume}
                onChange={handleVideoAudioVolumeChange}
                className="w-24"
              />
            </div>
            <ToolBtn title={t("Delete")} onClick={handleDelete}>
              <RiDeleteBinLine className="text-sm" />
            </ToolBtn>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden" style={{ flexBasis: 0 }}>
          {/* Cột tiêu đề cố định — không scroll ngang */}
          <div
            className="flex-shrink-0 flex flex-col bg-gray-50 border-r border-gray-200 z-10"
            style={{ width: TRACK_LABEL_W }}
          >
            <div className="flex-shrink-0 h-5 border-b border-gray-200 bg-gray-50 flex items-center justify-center">
            
            </div>
            <TimelineTrackLabel
              label={t("Video")}
              locked={videoLocked}
              onToggleLock={() => setVideoLocked((v) => !v)}
              heightPx={88}
            />
            <TimelineTrackLabel
              label={t("Audio")}
              locked={audioLocked}
              onToggleLock={() => setAudioLocked((v) => !v)}
              heightPx={44}
            />
            <TimelineTrackLabel
              label={t("Phụ đề")}
              locked={subtitleLocked}
              onToggleLock={() => setSubtitleLocked((v) => !v)}
              heightPx={72}
              last
            />
          </div>

          {/* Vùng timeline — chỉ scroll ngang/dọc bên trong */}
        <div
          ref={timelineRef}
            className="relative flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-auto v-scrollbar h-scrollbar select-none bg-white"
            style={{ scrollbarWidth: "thin" }}
        >
          <div
            className="flex-shrink-0 z-20 h-5 border-b border-gray-200 bg-slate-900 cursor-ew-resize relative"
            style={{ width: timelineWidth, minWidth: timelineWidth }}
            onPointerDown={beginTimelineScrub}
            title={t("Kéo để tua playhead (giây)")}
          >
              {Array.from(
                { length: Math.floor(Math.ceil(totalSec) / TIMELINE_RULER_STEP_SEC) + 1 },
                (_, i) => i * TIMELINE_RULER_STEP_SEC
              ).map((s) => (
                  <div
                    key={s}
                    className="absolute bottom-0.5 -translate-x-1/2 text-10 leading-none text-slate-300 font-mono pointer-events-none tabular-nums"
                    style={{ left: s * pxPerSec }}
                  >
                    {s}
                </div>
              ))}
          </div>

          {/* Playhead — chỉ bắt kéo ở đầu (ruler); thân line không chặn kéo clip */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: playheadLeft - 6, width: 12 }}
          >
            <div
              className="absolute left-0 top-0 h-5 w-full cursor-ew-resize pointer-events-auto"
              onPointerDown={beginTimelineScrub}
              title={t("Kéo playhead")}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-red-500" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-sm bg-red-500 rotate-45" />
          </div>

          <div
            className="flex flex-col flex-shrink-0"
            style={{
              width: timelineWidth,
              minWidth: timelineWidth,
            }}
          >
          <TimelineTrack
            width={timelineWidth}
            heightPx={88}
            onLanePointerDown={beginTimelineScrub}
            dropActive={timelineDrop?.track === "video"}
            dropSec={timelineDrop?.track === "video" ? timelineDrop.insertSec : null}
            dropPreviewSec={
              timelineDrop?.track === "video" ? FILM_STUDIO_DEFAULT_SCENE_SEC : null
            }
            pxPerSec={pxPerSec}
            onDragOver={(e) => beginTimelineFileDrag("video", e)}
            onDragLeave={endTimelineFileDrag}
            onDrop={(e) => handleTimelineFileDrop("video", e)}
          >
            {videoDragLayout ? (
              <div
                className="absolute top-1.5 bottom-1.5 z-10 pointer-events-none rounded border-2 border-dashed border-emerald-400"
                style={{
                  left: videoDragLayout.slot.startSec * pxPerSec,
                  width: Math.max(28, videoDragLayout.slot.durationSec * pxPerSec),
                  backgroundColor: "rgba(52, 211, 153, 0.22)",
                  boxShadow: "inset 0 0 0 1px rgba(52, 211, 153, 0.45)",
                }}
                title={t("Vị trí video sau khi thả")}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l bg-emerald-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-10 font-bold text-emerald-100 drop-shadow px-1 truncate">
                    {t("Thả vào đây")}
                  </span>
                </div>
              </div>
            ) : null}
            {videoClips.map((clip) => {
              const selected =
                selectedVideoId === clip.id || activeVideoClip?.id === clip.id;
              const isDragging = draggingClipId === clip.sceneId;
              const packedLeft = videoDragOthersLeft.get(clip.sceneId);
              const leftSec = isDragging
                ? videoDragLeftSec != null
                  ? videoDragLeftSec
                  : clip.startSec
                : packedLeft != null
                  ? packedLeft
                  : clip.startSec;
              return (
              <div
                key={clip.id}
                  className={`absolute top-1.5 bottom-1.5 rounded overflow-visible group ${
                    selected || isDragging
                      ? "ring-2 ring-sky-400 z-30"
                      : "ring-1 ring-sky-600 ring-opacity-60 hover:ring-sky-400 z-10"
                  } ${clip.ready ? "bg-sky-950" : "bg-slate-800 opacity-70"} ${
                    videoLocked ? "cursor-ew-resize" : "cursor-grab active:cursor-grabbing"
                } ${isDragging ? "opacity-90 shadow-lg z-40" : ""}`}
                style={{
                    left: leftSec * pxPerSec,
                    width: Math.max(clip.durationSec * pxPerSec, 28),
                    // Không transition khi đang kéo — tránh giật / khó nhắm
                    transition: draggingClipId ? "none" : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedVideoId(clip.id);
                  setSelectedVoiceId(null);
                  setInspectorTab("video");
                  if (!lastDragMovedRef.current) {
                    seekTo(secFromTimelineClientX(e.clientX), {
                      play: playingRef.current,
                      snap: true,
                    });
                  }
                  lastDragMovedRef.current = false;
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest("[data-handle]")) return;
                    e.stopPropagation();
                    if (videoLocked) {
                      beginTimelineScrub(e);
                      return;
                    }
                  beginVideoMove(clip, e);
                }}
                  title={`${clip.label} · ${clip.durationSec.toFixed(1)}s · ${t("Kéo để đổi vị trí")}`}
              >
                  <div
                    className={`absolute inset-0 overflow-hidden rounded pointer-events-none ${
                      draggingClipId === clip.sceneId ? "opacity-70 ring-2 ring-sky-300" : ""
                    }`}
              >
                {clip.thumbUrl ? (
                  <img
                    src={clip.thumbUrl}
                    alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-10 text-sky-100 px-1 truncate opacity-80">
                    {clip.label}
                  </div>
                )}
                    <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black to-transparent opacity-80" />
                    <span className="absolute bottom-0.5 left-1.5 text-10 font-bold text-white drop-shadow">
                      {String(clip.index).padStart(2, "0")} · {clip.durationSec.toFixed(1)}s
                </span>
                  </div>
                  {clip.ready && (clip.videoUrl || "").trim() ? (
                    <button
                      type="button"
                      title={t("Nghe clip video này")}
                      className={`absolute top-1 z-40 flex items-center justify-center w-6 h-6 rounded-full bg-black bg-opacity-55 hover:bg-opacity-75 text-white border-0 cursor-pointer ${
                        selected || soloPlayingId === clip.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ left: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        playSoloVideo(clip);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {soloPlayingId === clip.id && playing ? (
                        <RiPauseFill className="text-xs" />
                      ) : (
                        <RiPlayFill className="text-xs" />
                      )}
                    </button>
                  ) : null}
                  {!videoLocked ? (
                    <button
                      type="button"
                      title={t("Xóa video")}
                      className={`absolute top-1 z-40 flex items-center justify-center w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white border-0 cursor-pointer ${
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ right: 10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(clip.sceneId);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <RiDeleteBinLine className="text-xs" />
                    </button>
                  ) : null}
                {!videoLocked ? (
                  <>
                      <TimelineEdgeHandle
                        side="left"
                        color="sky"
                        visible={selected}
                        title={t("Cắt đầu clip")}
                      onPointerDown={(e) => beginVideoEdgeDrag("video-left", clip, e)}
                    />
                      <TimelineEdgeHandle
                        side="right"
                        color="sky"
                        visible={selected}
                        title={t("Cắt đuôi clip")}
                      onPointerDown={(e) => beginVideoEdgeDrag("video-right", clip, e)}
                    />
                  </>
                ) : null}
              </div>
              );
            })}
          </TimelineTrack>

          <TimelineTrack
            width={timelineWidth}
            heightPx={44}
            onLanePointerDown={beginTimelineScrub}
            dropActive={timelineDrop?.track === "audio"}
            dropSec={timelineDrop?.track === "audio" ? timelineDrop.sec : null}
            pxPerSec={pxPerSec}
            onDragOver={(e) => beginTimelineFileDrag("audio", e)}
            onDragLeave={endTimelineFileDrag}
            onDrop={(e) => handleTimelineFileDrop("audio", e)}
          >
            {voiceClips.map((clip) => {
              const hasAudio = !!(clip.voiceUrl || clip.voiceBlob);
              const selected = selectedVoiceId === clip.id;
              const isDragging =
                draggingClipId === `${clip.sceneId}:${clip.lineId}:voice`;
              const leftSec =
                isDragging && audioDragLeftSec != null
                  ? Math.max(0, audioDragLeftSec)
                  : clip.startSec;
              const clipLeft = leftSec * pxPerSec;
              const clipWidth = Math.max(clip.durationSec * pxPerSec, 24);
              return (
              <div
                key={clip.id}
                  className={`absolute top-1 bottom-1 rounded overflow-visible group ${
                    selected || isDragging
                      ? "ring-2 ring-primary z-20"
                      : "ring-1 ring-primary ring-opacity-30 hover:ring-opacity-55 z-10"
                  } ${audioLocked ? "cursor-ew-resize" : "cursor-grab active:cursor-grabbing"} ${
                    isDragging ? "opacity-85 shadow-md z-30" : ""
                  }`}
                style={{
                    left: clipLeft,
                    width: clipWidth,
                    backgroundColor: selected || isDragging
                      ? "rgba(254,241,231,0.98)"
                      : "rgba(255,252,248,0.95)",
                    zIndex: isDragging ? 30 : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedVoiceId(clip.id);
                  setSelectedVideoId(clip.sceneId);
                    setInspectorTab("audio");
                    if (!lastDragMovedRef.current) {
                      seekTo(secFromTimelineClientX(e.clientX), {
                        play: playingRef.current,
                        snap: true,
                      });
                    }
                    lastDragMovedRef.current = false;
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest("[data-handle]")) return;
                    e.stopPropagation();
                    if (audioLocked) {
                      beginTimelineScrub(e);
                      return;
                    }
                    beginVoiceDrag("line-move", clip, e);
                  }}
                  title={`${clip.label}${clip.character ? ` · ${clip.character}` : ""} · ${t("Kéo tự do trên timeline")}`}
                >
                  <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
                    <AudioSourceVisual
                      clipId={clip.id}
                      startPx={clipLeft}
                      widthPx={clipWidth}
                      hasAudio={hasAudio}
                    />
                  </div>
                  <div className="absolute top-0 left-0 right-0 z-10 flex items-start pointer-events-none pl-3 pr-5 pt-0.5">
                    <span className="min-w-0 text-10 font-semibold text-primary-dark truncate leading-none">
                      {clip.label}
                  </span>
                  </div>
                  {hasAudio ? (
                    <button
                      type="button"
                      title={t("Nghe clip audio này")}
                      className={`absolute bottom-0.5 z-40 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white border-0 cursor-pointer ${
                        selected || soloPlayingId === clip.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ left: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        playSoloAudio(clip);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {soloPlayingId === clip.id && playing ? (
                        <RiPauseFill className="text-8" />
                      ) : (
                        <RiPlayFill className="text-8" />
                      )}
                    </button>
                  ) : null}
                  {hasAudio && !audioLocked ? (
                    <button
                      type="button"
                      title={t("Xóa audio")}
                      className={`absolute top-0.5 z-40 flex items-center justify-center w-5 h-5 rounded bg-red-500 hover:bg-red-600 text-white border-0 cursor-pointer ${
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ right: 10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAudio(clip.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <RiDeleteBinLine className="text-10" />
                    </button>
                ) : null}
                {!audioLocked && clip.lineId ? (
                  <>
                      <TimelineEdgeHandle
                        side="left"
                        color="primary"
                        visible={selected}
                        title={t("Kéo mép đầu audio")}
                        onPointerDown={(e) => beginVoiceDrag("line-left", clip, e)}
                      />
                      <TimelineEdgeHandle
                        side="right"
                        color="primary"
                        visible={selected}
                        title={t("Kéo mép đuôi audio")}
                        onPointerDown={(e) => beginVoiceDrag("line-right", clip, e)}
                    />
                  </>
                ) : null}
              </div>
              );
            })}
          </TimelineTrack>

          <TimelineTrack
            width={timelineWidth}
            heightPx={72}
            last
            onLanePointerDown={beginTimelineScrub}
          >
            {subtitleClips.map((clip) => {
              const selected = selectedSubtitleId === clip.id;
              const clipOn = clip.enabled !== false;
              return (
              <div
                key={clip.id}
                  className={`absolute top-1.5 bottom-1.5 rounded overflow-visible group text-10 leading-tight ${
                    selected ? "z-20" : "z-10"
                  } ${subtitleLocked ? "cursor-ew-resize" : "cursor-grab active:cursor-grabbing"}`}
                style={{
                    left: clip.startSec * pxPerSec,
                    width: Math.max(clip.durationSec * pxPerSec, 36),
                    backgroundColor: !clipOn
                      ? "rgba(229,231,235,0.9)"
                      : selected
                        ? "rgba(221,214,254,0.98)"
                        : "rgba(237,233,254,0.95)",
                    color: !clipOn ? "#6b7280" : "#4c1d95",
                    opacity:
                      draggingClipId === `${clip.sceneId}:${clip.lineId}:sub`
                        ? 0.75
                        : !clipOn
                          ? 0.55
                          : 1,
                    zIndex:
                      draggingClipId === `${clip.sceneId}:${clip.lineId}:sub` ? 30 : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                    if (!lastDragMovedRef.current) {
                      handleSelectSubtitle(clip, { clientX: e.clientX });
                    }
                    lastDragMovedRef.current = false;
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    if ((e.target as HTMLElement).closest("[data-handle]")) return;
                    e.stopPropagation();
                    if (subtitleLocked) {
                      beginTimelineScrub(e);
                      return;
                    }
                    beginSubtitleDrag("line-move", clip, e);
                }}
                title={`${clip.text || t("Phụ đề")} · ${t("Kéo để đổi vị trí")}`}
              >
                  <div className="absolute inset-0 overflow-visible rounded px-1.5 py-0.5 flex items-center justify-center text-center pointer-events-none whitespace-normal break-words leading-snug">
                    {clip.text || t("Phụ đề")}
              </div>
                  <button
                    type="button"
                    title={clipOn ? t("Tắt phụ đề này") : t("Bật phụ đề này")}
                    className={`absolute top-0.5 z-40 mr-1 flex items-center justify-center w-5 h-5 rounded border-0 cursor-pointer ${
                      clipOn
                        ? "bg-blue-500 hover:bg-violet-700 text-white"
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                    } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    style={{ right: 28 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubtitleClipEnabled(clip.id, !clipOn);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {clipOn ? <HiEye className="text-10" /> : <HiEyeOff className="text-10" />}
                  </button>
                  {!subtitleLocked ? (
                    <button
                      type="button"
                      title={t("Xóa phụ đề")}
                      className={`absolute top-0.5 z-40 flex items-center justify-center w-5 h-5 rounded bg-red-500 hover:bg-red-600 text-white border-0 cursor-pointer ${
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ right: 10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubtitle(clip.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <RiDeleteBinLine className="text-10" />
                    </button>
                  ) : null}
                  {!subtitleLocked && clip.lineId ? (
                    <>
                      <TimelineEdgeHandle
                        side="left"
                        color="violet"
                        visible={selected}
                        title={t("Cắt đầu phụ đề")}
                        onPointerDown={(e) => beginSubtitleDrag("line-left", clip, e)}
                      />
                      <TimelineEdgeHandle
                        side="right"
                        color="violet"
                        visible={selected}
                        title={t("Cắt đuôi phụ đề")}
                        onPointerDown={(e) => beginSubtitleDrag("line-right", clip, e)}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </TimelineTrack>
        </div>
      </div>
        </div>
      </section>
    </div>
  );
}

function ToolBtn({
  title,
  onClick,
  accent,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-8 h-8 rounded-lg border cursor-pointer disabled:opacity-40 ${
        accent
          ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function TimelineTrackLabel({
  label,
  subLabel,
  locked,
  onToggleLock,
  icon,
  last,
  heightPx = 56,
  visibilityOn,
  onToggleVisibility,
  visibilityTitle,
}: {
  label: string;
  subLabel?: string;
  locked: boolean;
  onToggleLock: () => void;
  icon?: React.ReactNode;
  last?: boolean;
  heightPx?: number;
  visibilityOn?: boolean;
  onToggleVisibility?: () => void;
  visibilityTitle?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 flex flex-col justify-center gap-0.5 px-2 bg-gray-50 ${
        last ? "" : "border-b border-gray-200"
      }`}
      style={{ height: heightPx, minHeight: heightPx }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 min-w-0">
          {icon}
        <span className="text-xs font-bold text-gray-800 truncate">{label}</span>
        {onToggleVisibility ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className={`ml-auto p-0.5 border-0 bg-transparent cursor-pointer ${
              visibilityOn
                ? "text-violet-700 hover:text-violet-900"
                : "text-blue-500 hover:text-blue-700"
            }`}
            title={visibilityTitle}
          >
            {visibilityOn ? <HiEye className="text-xs" /> : <HiEyeOff className="text-xs" />}
          </button>
        ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
          className={`p-0.5 border-0 bg-transparent cursor-pointer text-gray-400 hover:text-gray-700 ${
            onToggleVisibility ? "" : "ml-auto"
          }`}
          >
            {locked ? <HiLockClosed className="text-xs" /> : <HiLockOpen className="text-xs" />}
          </button>
        </div>
      {subLabel ? (
        <span className="text-10 text-gray-500 truncate font-medium">{subLabel}</span>
      ) : null}
      </div>
  );
}

function TimelineTrack({
  width,
  last,
  heightPx = 56,
  onLanePointerDown,
  dropActive,
  dropSec,
  dropPreviewSec = null,
  pxPerSec = 0,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  width: number;
  last?: boolean;
  /** Chiều cao cố định track — tránh bị flex cắt phần dưới */
  heightPx?: number;
  onLanePointerDown?: (e: React.PointerEvent) => void;
  dropActive?: boolean;
  dropSec?: number | null;
  /** Độ dài ước lượng (giây) cho ghost chèn — tránh vùng trắng đè clip */
  dropPreviewSec?: number | null;
  pxPerSec?: number;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex-shrink-0 bg-slate-900 overflow-hidden cursor-ew-resize ${
        last ? "" : "border-b border-gray-200"
      } ${dropActive ? "ring-2 ring-inset ring-sky-400 ring-opacity-80" : ""}`}
      style={{
        width,
        minWidth: width,
        height: heightPx,
        minHeight: heightPx,
      }}
      onPointerDown={onLanePointerDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {dropActive && dropSec != null && pxPerSec > 0 ? (
        <>
          {dropPreviewSec != null && dropPreviewSec > 0 ? (
            <div
              className="absolute top-1.5 bottom-1.5 z-40 pointer-events-none rounded border-2 border-dashed border-sky-300"
              style={{
                left: Math.max(0, dropSec * pxPerSec),
                width: Math.max(28, dropPreviewSec * pxPerSec),
                backgroundColor: "rgba(56, 189, 248, 0.28)",
              }}
            />
          ) : null}
          <div
            className="absolute top-0 bottom-0 z-50 pointer-events-none"
            style={{ left: Math.max(0, dropSec * pxPerSec) - 1, width: 2 }}
          >
            <div className="w-full h-full bg-emerald-400" />
          </div>
        </>
      ) : null}
    </div>
  );
}
