import { saveAs } from "file-saver";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { IconType } from "react-icons";
import { MdPerson } from "react-icons/md";
import {
  RiArrowGoBackLine,
  RiArrowLeftRightLine,
  RiAspectRatioLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiDownload2Line,
  RiFileCopyLine,
  RiFullscreenExitLine,
  RiLoader4Line,
  RiMusic2Line,
  RiScissorsCutLine,
  RiStackLine,
  RiTimerFlashLine,
  RiUploadCloud2Line,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from "react-icons/ri";
import {
  changeSpeedInBrowser,
  changeVolumeInBrowser,
  compressMediaInBrowser,
  cropAspectInBrowser,
  extractAudioTrackInBrowser,
  fadeMediaInBrowser,
  isAudioMediaFile,
  mergeAudioInBrowser,
  mergeVideosInBrowser,
  removeSilenceInBrowser,
  reverseMediaInBrowser,
  trimMediaInBrowser,
} from "../../video-affiliate-plus/ffmpeg-browser";
import { VoiceWaveformPlayer } from "./voice-catalog-card";
import { FEATURE_TEXT_LABEL, resultFeatureOf, type VoiceResultRecord } from "./voice-idb";
import { useVoiceContext } from "./voice-provider";
import { getVoiceTool } from "./voice-tools-config";

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v|avi)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;

function isVideoFile(item: File) {
  if (item.type.startsWith("video/")) return true;
  return VIDEO_EXT.test(item.name);
}

function isAudioFile(item: File) {
  if (isAudioMediaFile(item)) return true;
  return AUDIO_EXT.test(item.name);
}

type UploadKind = "audio" | "video" | "both";

const ACCEPT_VIDEO = "video/*,.mp4,.webm,.mov,.mkv,.m4v,.avi";
const ACCEPT_AUDIO = "audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac";
const ACCEPT_BOTH = `${ACCEPT_VIDEO},${ACCEPT_AUDIO}`;

const MODE_UPLOAD: Record<
  string,
  { kind: UploadKind; accept: string; hint: string; reject: string }
> = {
  trim: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Cắt đoạn chỉ nhận video hoặc audio",
  },
  split: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio dài: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Tách đoạn chỉ nhận video hoặc audio",
  },
  extract: {
    kind: "video",
    accept: ACCEPT_VIDEO,
    hint: "Chỉ video: MP4, WEBM, MOV, MKV",
    reject: "Tách audio chỉ nhận file video, không nhận audio",
  },
  silence: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Bỏ im lặng chỉ nhận video hoặc audio",
  },
  merge: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Chọn từ 2 file cùng loại (cùng video hoặc cùng audio)",
    reject: "Ghép file chỉ nhận video hoặc audio",
  },
  speed: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Đổi tốc độ chỉ nhận video hoặc audio",
  },
  volume: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Âm lượng chỉ nhận video hoặc audio",
  },
  crop: {
    kind: "video",
    accept: ACCEPT_VIDEO,
    hint: "Chỉ video: MP4, WEBM, MOV, MKV",
    reject: "Tỉ lệ khung chỉ nhận file video",
  },
  fade: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Fade chỉ nhận video hoặc audio",
  },
  reverse: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Đảo chiều chỉ nhận video hoặc audio",
  },
  compress: {
    kind: "both",
    accept: ACCEPT_BOTH,
    hint: "Video hoặc audio: MP4, WEBM, MOV, MP3, WAV, M4A",
    reject: "Nén dung lượng chỉ nhận video hoặc audio",
  },
};

function isAllowedForMode(mode: string, item: File | null | undefined): boolean {
  if (!item) return false;
  const kind = MODE_UPLOAD[mode]?.kind || "both";
  const audio = isAudioFile(item);
  const video = isVideoFile(item);
  if (kind === "audio") return audio && !video;
  if (kind === "video") return video;
  return audio || video;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

function parseClock(raw: string): number | null {
  const text = String(raw || "")
    .trim()
    .replace(",", ".");
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }
  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((part) => part === "" || !Number.isFinite(Number(part)))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
}

function TimeField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (sec: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(formatClock(value));

  useEffect(() => {
    setDraft(formatClock(value));
  }, [value]);

  const commit = () => {
    const parsed = parseClock(draft);
    if (parsed == null) {
      setDraft(formatClock(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <label className="flex-1 min-w-0">
      <div className="mb-1 text-xs font-medium text-gray-600">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        spellCheck={false}
        disabled={disabled}
        value={draft}
        placeholder={t("00:00.0")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="px-2 w-full h-9 text-sm text-center tabular-nums rounded-lg border border-gray-200"
      />
    </label>
  );
}

function TrimRangeBar({
  start,
  end,
  duration,
  color,
  disabled,
  onChange,
  onSeek,
}: {
  start: number;
  end: number;
  duration: number;
  color: string;
  disabled?: boolean;
  onChange: (nextStart: number, nextEnd: number) => void;
  onSeek?: (sec: number) => void;
}) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);
  const startRef = useRef(start);
  const endRef = useRef(end);
  const durationRef = useRef(duration);
  const onChangeRef = useRef(onChange);
  const onSeekRef = useRef(onSeek);
  startRef.current = start;
  endRef.current = end;
  durationRef.current = duration;
  onChangeRef.current = onChange;
  onSeekRef.current = onSeek;

  const toSec = (clientX: number) => {
    const el = trackRef.current;
    const max = durationRef.current;
    if (!el || max <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const pct = (clientX - rect.left) / Math.max(1, rect.width);
    return Math.min(max, Math.max(0, pct * max));
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const which = dragRef.current;
      if (!which) return;
      const sec = toSec(e.clientX);
      if (which === "start") onChangeRef.current(sec, endRef.current);
      else onChangeRef.current(startRef.current, sec);
      onSeekRef.current?.(sec);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;

  const beginDrag = (which: "start" | "end", e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = which;
    onSeek?.(which === "start" ? start : end);
  };

  return (
    <div
      ref={trackRef}
      className="relative h-7 select-none touch-none"
      onPointerDown={(e) => {
        if (disabled || dragRef.current) return;
        const sec = toSec(e.clientX);
        const next = Math.abs(sec - start) <= Math.abs(sec - end) ? "start" : "end";
        dragRef.current = next;
        if (next === "start") onChange(sec, end);
        else onChange(start, sec);
        onSeek?.(sec);
      }}
    >
      <div
        className="absolute right-0 left-0 h-1.5 bg-gray-100 rounded-full"
        style={{ top: "50%", marginTop: -3 }}
      />
      <div
        className="absolute h-1.5 rounded-full pointer-events-none"
        style={{
          top: "50%",
          marginTop: -3,
          left: `${startPct}%`,
          width: `${Math.max(1.2, endPct - startPct)}%`,
          background: color,
        }}
      />
      <div
        role="slider"
        aria-label={t("Điểm đầu")}
        aria-valuenow={start}
        onPointerDown={(e) => beginDrag("start", e)}
        className="absolute w-4 h-4 bg-white rounded-full border-2 box-border"
        style={{
          top: "50%",
          left: `${startPct}%`,
          marginTop: -8,
          marginLeft: -8,
          borderColor: color,
          zIndex: 2,
        }}
      />
      <div
        role="slider"
        aria-label={t("Điểm cuối")}
        aria-valuenow={end}
        onPointerDown={(e) => beginDrag("end", e)}
        className="absolute w-4 h-4 bg-white rounded-full border-2 box-border"
        style={{
          top: "50%",
          left: `${endPct}%`,
          marginTop: -8,
          marginLeft: -8,
          borderColor: color,
          zIndex: 2,
        }}
      />
    </div>
  );
}

function VoiceVideoField({
  file,
  files,
  onChange,
  onChangeFiles,
  disabled,
  mode,
}: {
  file?: File | null;
  files?: File[];
  onChange?: (file: File | null) => void;
  onChangeFiles?: (files: File[]) => void;
  disabled?: boolean;
  mode: string;
}) {
  const { t } = useTranslation();
  const { color } = getVoiceTool("cut");
  const ref = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [reject, setReject] = useState("");
  const upload = MODE_UPLOAD[mode] || MODE_UPLOAD.trim;
  const multiple = mode === "merge";
  const list = files?.length ? files : file ? [file] : [];

  const applyFiles = (next: File[]) => {
    const allowed = next.filter((item) => isAllowedForMode(mode, item));
    if (!allowed.length) {
      setReject(t(upload.reject));
      return;
    }
    if (multiple) {
      const combined = [...(files || []), ...allowed];
      const videos = combined.filter(isVideoFile);
      const audios = combined.filter((item) => isAudioFile(item) && !isVideoFile(item));
      const same = videos.length && !audios.length ? videos : audios.length && !videos.length ? audios : [];
      if (!same.length) {
        setReject(t("Hãy chọn toàn video hoặc toàn audio, tối thiểu 2 file"));
        return;
      }
      const uniq = same.filter(
        (item, index, arr) =>
          arr.findIndex((row) => row.name === item.name && row.size === item.size && row.lastModified === item.lastModified) ===
          index
      );
      setReject("");
      onChangeFiles?.(uniq);
      onChange?.(uniq[0]);
      return;
    }
    setReject("");
    onChange?.(allowed[0]);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCount.current += 1;
    setDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current -= 1;
    if (dragCount.current <= 0) {
      dragCount.current = 0;
      setDragging(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current = 0;
    setDragging(false);
    if (disabled) return;
    const picked = Array.from(e.dataTransfer.files || []);
    if (!picked.length) return;
    applyFiles(picked);
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex flex-col gap-1 justify-center items-center px-4 py-6 w-full text-left rounded-xl border border-dashed disabled:opacity-60"
        style={{
          borderColor: dragging ? color : `${color}88`,
          background: dragging ? `${color}14` : "#f9fafb",
        }}
      >
        <RiUploadCloud2Line className="text-2xl" style={{ color }} />
        <span className="text-sm font-medium text-gray-800">
          {dragging
            ? t("Thả file vào đây")
            : list.length > 1
            ? t("{{count}} file đã chọn", { count: list.length })
            : list[0]
            ? list[0].name
            : upload.kind === "audio"
            ? t("Kéo thả hoặc chọn audio")
            : upload.kind === "video"
            ? t("Kéo thả hoặc chọn video")
            : t("Kéo thả hoặc chọn file")}
        </span>
        <span className="text-xs text-gray-500">{t(upload.hint)}</span>
      </button>
      {reject ? <p className="mt-2 text-xs text-red-600">{reject}</p> : null}
      {list.length ? (
        <button
          type="button"
          disabled={disabled}
          title={t("Xóa")}
          onClick={() => {
            setReject("");
            onChange?.(null);
            onChangeFiles?.([]);
          }}
          className="flex gap-1.5 justify-center items-center mt-2 w-full h-8 text-xs font-medium text-red-600 bg-white rounded-lg border border-red-200 disabled:opacity-50"
        >
          <RiCloseLine className="text-base" />
          {t("Xóa file")}
        </button>
      ) : null}
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept={upload.accept}
        className="hidden"
        onChange={(e) => {
          applyFiles(Array.from(e.target.files || []));
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

const CUT_MODES: { id: string; label: string; Icon: IconType }[] = [
  { id: "trim", label: "Cắt đoạn", Icon: RiScissorsCutLine },
  { id: "split", label: "Tách đoạn", Icon: RiFileCopyLine },
  { id: "merge", label: "Ghép file", Icon: RiStackLine },
  { id: "extract", label: "Tách audio", Icon: RiMusic2Line },
  { id: "speed", label: "Đổi tốc độ", Icon: RiTimerFlashLine },
  { id: "volume", label: "Âm lượng", Icon: RiVolumeUpLine },
  { id: "crop", label: "Tỉ lệ khung", Icon: RiAspectRatioLine },
  { id: "fade", label: "Fade", Icon: RiArrowLeftRightLine },
  { id: "reverse", label: "Đảo chiều", Icon: RiArrowGoBackLine },
  { id: "compress", label: "Nén dung lượng", Icon: RiFullscreenExitLine },
  { id: "silence", label: "Bỏ im lặng", Icon: RiVolumeMuteLine },
];

const MODE_HINT: Record<string, string> = {
  trim: "Cắt video hoặc audio trên máy.",
  split: "Chia video hoặc audio theo số giây bạn nhập (tối đa 36 đoạn).",
  merge: "Nối từ 2 file cùng loại (video hoặc audio) trên máy.",
  extract: "Tách audio từ video sang MP3 / WAV. Chỉ nhận file video.",
  speed: "Đổi tốc độ phát 0.5x–2x trên máy.",
  volume: "Tăng / giảm âm lượng (dB) trên máy.",
  crop: "Crop video 9:16, 1:1 hoặc 16:9 trên máy.",
  fade: "Fade in / fade out đầu và cuối file trên máy.",
  reverse: "Đảo chiều video hoặc audio trên máy.",
  compress: "Nén video 720p hoặc audio 96kbps trên máy.",
  silence: "Tự bỏ các đoạn im lặng trên video hoặc audio, chạy trên máy.",
};

function featureLabel(mode: string) {
  return CUT_MODES.find((item) => item.id === mode)?.label || "Cắt video/audio";
}

function withFeature(
  mode: string,
  rows: { label: string; value: string }[]
): { label: string; value: string }[] {
  return [{ label: "feature", value: featureLabel(mode) }, ...rows];
}

export function CutVideoPanel() {
  const { t } = useTranslation();
  const {
    running,
    error,
    ownerId,
    runLocal,
    saveLocalMedia,
    saveLocalMediaBatch,
    cancelRun,
  } = useVoiceContext();
  const { color } = getVoiceTool("cut");
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [mode, setMode] = useState("trim");
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const audioMode = isAudioMediaFile(file);
  const [src, setSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [current, setCurrent] = useState(0);
  const [splitSec, setSplitSec] = useState(5);
  const [audioFmt, setAudioFmt] = useState<"mp3" | "wav">("mp3");
  const [speed, setSpeed] = useState(1);
  const [volumeDb, setVolumeDb] = useState(0);
  const [cropAspect, setCropAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [fadeSec, setFadeSec] = useState(0.5);

  useEffect(() => {
    if (mode !== "merge") setBatchFiles([]);
    if (file && !isAllowedForMode(mode, file) && mode !== "merge") setFile(null);
  }, [mode, file]);

  useEffect(() => {
    if (!file) {
      setSrc("");
      setDuration(0);
      setStart(0);
      setEnd(0);
      setCurrent(0);
      return;
    }
    setDuration(0);
    setStart(0);
    setEnd(0);
    setCurrent(0);
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDuration = (next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setDuration((prev) => {
      if (prev > 0) return prev;
      setStart(0);
      setEnd(next);
      return next;
    });
  };

  const onMeta = (el: HTMLMediaElement) => {
    onDuration(el.duration);
  };

  const seek = (sec: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.min(duration || sec, Math.max(0, sec));
  };

  const clampRange = (nextStart: number, nextEnd: number) => {
    const max = duration || nextEnd;
    let a = Math.max(0, Math.min(nextStart, max));
    let b = Math.max(0, Math.min(nextEnd, max));
    if (b - a < 0.1) b = Math.min(max, a + 0.1);
    setStart(a);
    setEnd(b);
  };

  const canCut = Boolean(
    file &&
      isAllowedForMode(mode, file) &&
      duration > 0.1 &&
      end - start >= 0.1 &&
      ownerId &&
      !running
  );
  const needsDuration = mode === "trim" || mode === "split" || mode === "silence" || mode === "fade";
  const canRun =
    !running &&
    ownerId &&
    (mode === "trim"
      ? canCut
      : mode === "merge"
      ? batchFiles.length >= 2
      : Boolean(
          file &&
            isAllowedForMode(mode, file) &&
            (needsDuration ? duration > 0.2 : true)
        ));

  const fileBase = (name: string) => name.replace(/\.[^.]+$/, "") || "media";

  const onRun = () => {
    if (!canRun) return;
    if (mode === "trim") {
      if (!file || !canCut) return;
      void runLocal(async (onProgress) => {
        const cut = await trimMediaInBrowser(file, start, end, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: cut.blob,
          mimeType: cut.mimeType,
          name: `${fileBase(file.name)}-${formatClock(start)}-${formatClock(end)}`.replace(
            /[^\w.-]+/g,
            "_"
          ),
          texts: withFeature("trim", [
            { label: t("Đoạn cắt"), value: `${formatClock(start)} → ${formatClock(end)}` },
            { label: "ext", value: cut.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file đã cắt"));
      });
      return;
    }
    if (mode === "split" && file) {
      void runLocal(async (onProgress) => {
        const seg = Math.max(1, Math.min(600, Number(splitSec) || 5));
        const count = Math.min(36, Math.ceil(duration / seg));
        const items: {
          blob: Blob;
          mimeType?: string;
          name?: string;
          texts?: { label: string; value: string }[];
        }[] = [];
        for (let i = 0; i < count; i += 1) {
          const a = i * seg;
          const b = Math.min(duration, a + seg);
          if (b - a < 0.15) continue;
          onProgress(t("Đoạn {{current}}/{{total}}", { current: i + 1, total: count }));
          const cut = await trimMediaInBrowser(file, a, b, {
            fileName: file.name,
            mimeType: file.type,
            onProgress: (p) =>
              onProgress(
                t("Đoạn {{current}}/{{total}}: {{detail}}", {
                  current: i + 1,
                  total: count,
                  detail: t(p.message),
                })
              ),
          });
          items.push({
            blob: cut.blob,
            mimeType: cut.mimeType,
            name: `${fileBase(file.name)}-${i + 1}`.replace(/[^\w.-]+/g, "_"),
            texts: withFeature("split", [
              { label: t("Đoạn cắt"), value: `${formatClock(a)} → ${formatClock(b)}` },
              { label: "ext", value: cut.ext },
            ]),
          });
        }
        const n = await saveLocalMediaBatch(items);
        if (!n) throw new Error(t("Không lưu được các đoạn"));
      });
      return;
    }
    if (mode === "merge") {
      void runLocal(async (onProgress) => {
        const videos = batchFiles.filter(isVideoFile);
        const audios = batchFiles.filter((item) => isAudioFile(item) && !isVideoFile(item));
        const queue = videos.length >= 2 ? videos : audios;
        if (queue.length < 2) throw new Error(t("Cần ít nhất 2 file cùng loại để ghép"));
        onProgress(t("Đang ghép file..."));
        const first = queue[0];
        if (videos.length >= 2) {
          const blob = await mergeVideosInBrowser(queue, {
            onProgress: (p) => onProgress(t(p.message)),
          });
          const record = await saveLocalMedia({
            blob,
            mimeType: "video/mp4",
            name: `${fileBase(first.name)}-merge`.replace(/[^\w.-]+/g, "_"),
            texts: withFeature("merge", [
              { label: t("Ghép file"), value: `${queue.length} video` },
              { label: "ext", value: "mp4" },
            ]),
          });
          if (!record) throw new Error(t("Không lưu được file"));
          return;
        }
        const out = await mergeAudioInBrowser(queue, {
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(first.name)}-merge`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("merge", [
            { label: t("Ghép file"), value: `${queue.length} audio` },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "extract" && file) {
      void runLocal(async (onProgress) => {
        const out = await extractAudioTrackInBrowser(file, audioFmt, {
          fileName: file.name,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-audio`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("extract", [
            { label: t("Tách audio"), value: out.ext.toUpperCase() },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được audio"));
      });
      return;
    }
    if (mode === "silence" && file) {
      void runLocal(async (onProgress) => {
        const out = await removeSilenceInBrowser(file, duration, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-nosilence`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("silence", [
            { label: t("Bỏ im lặng"), value: out.ext.toUpperCase() },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "speed" && file) {
      void runLocal(async (onProgress) => {
        const out = await changeSpeedInBrowser(file, speed, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-${speed}x`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("speed", [
            { label: t("Đổi tốc độ"), value: `${speed}x` },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "volume" && file) {
      void runLocal(async (onProgress) => {
        const out = await changeVolumeInBrowser(file, volumeDb, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-vol`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("volume", [
            { label: t("Âm lượng"), value: `${volumeDb > 0 ? "+" : ""}${volumeDb} dB` },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "crop" && file) {
      void runLocal(async (onProgress) => {
        const out = await cropAspectInBrowser(file, cropAspect, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-${cropAspect.replace(":", "x")}`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("crop", [
            { label: t("Tỉ lệ khung"), value: cropAspect },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "fade" && file) {
      void runLocal(async (onProgress) => {
        const out = await fadeMediaInBrowser(file, fadeSec, duration, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-fade`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("fade", [
            { label: t("Fade"), value: `${fadeSec}s` },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "reverse" && file) {
      void runLocal(async (onProgress) => {
        const out = await reverseMediaInBrowser(file, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-reverse`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("reverse", [
            { label: t("Đảo chiều"), value: out.ext.toUpperCase() },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
    if (mode === "compress" && file) {
      void runLocal(async (onProgress) => {
        const out = await compressMediaInBrowser(file, {
          fileName: file.name,
          mimeType: file.type,
          onProgress: (p) => onProgress(t(p.message)),
        });
        const record = await saveLocalMedia({
          blob: out.blob,
          mimeType: out.mimeType,
          name: `${fileBase(file.name)}-compress`.replace(/[^\w.-]+/g, "_"),
          texts: withFeature("compress", [
            { label: t("Nén dung lượng"), value: out.ext.toUpperCase() },
            { label: "ext", value: out.ext },
          ]),
        });
        if (!record) throw new Error(t("Không lưu được file"));
      });
      return;
    }
  };

  return (
    <div className="flex overflow-hidden flex-col flex-1 min-h-0">
      <div className="overflow-y-auto flex-1 min-h-0 v-scrollbar">
        <div className="px-4 pt-1 pb-3 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {CUT_MODES.map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={running}
                  onClick={() => setMode(item.id)}
                  className="inline-flex gap-1 items-center px-2.5 h-8 text-xs font-semibold rounded-full border"
                  style={{
                    color: active ? "#fff" : color,
                    background: active ? color : "#fff",
                    borderColor: active ? color : `${color}55`,
                  }}
                >
                  <item.Icon className="flex-shrink-0 text-sm" />
                  {t(item.label)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">{t(MODE_HINT[mode] || MODE_HINT.trim)}</p>
          <VoiceVideoField
            file={file}
            files={batchFiles}
            onChange={setFile}
            onChangeFiles={setBatchFiles}
            disabled={running}
            mode={mode}
          />
          {mode === "merge" && batchFiles.length ? (
            <ul className="px-3 py-2 space-y-1 text-xs text-gray-600 bg-white rounded-xl border border-gray-200">
              {batchFiles.map((item, index) => (
                <li key={`${item.name}-${index}`} className="truncate">
                  {index + 1}. {item.name}
                </li>
              ))}
            </ul>
          ) : null}
          {mode === "split" ? (
            <div className="p-3 space-y-2 bg-white rounded-xl border border-gray-200">
              <label className="block">
                <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                  <span>{t("Số giây mỗi đoạn")}</span>
                  <span className="tabular-nums">{splitSec}s</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  disabled={running}
                  value={splitSec}
                  onChange={(e) => {
                    const next = Math.floor(Number(e.target.value));
                    if (!Number.isFinite(next)) return;
                    setSplitSec(Math.max(1, Math.min(600, next)));
                  }}
                  className="px-3 w-full h-9 text-sm rounded-lg border border-gray-200"
                />
              </label>
              <div className="flex gap-1.5">
                {[5, 8, 10].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={running}
                    onClick={() => setSplitSec(sec)}
                    className="flex-1 h-8 text-xs font-semibold rounded-lg border"
                    style={{
                      color: splitSec === sec ? "#fff" : color,
                      background: splitSec === sec ? color : "#fff",
                      borderColor: color,
                    }}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              {duration > 0 ? (
                <p className="text-xs text-gray-500">
                  {t("Sẽ tạo khoảng {{count}} đoạn", {
                    count: Math.min(36, Math.ceil(duration / Math.max(1, splitSec))),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          {mode === "extract" ? (
            <div className="flex gap-1.5">
              {(["mp3", "wav"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={running}
                  onClick={() => setAudioFmt(fmt)}
                  className="flex-1 h-8 text-xs font-semibold rounded-lg border uppercase"
                  style={{
                    color: audioFmt === fmt ? "#fff" : color,
                    background: audioFmt === fmt ? color : "#fff",
                    borderColor: color,
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "speed" ? (
            <div className="p-3 space-y-2 bg-white rounded-xl border border-gray-200">
              <label className="block">
                <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                  <span>{t("Tốc độ")}</span>
                  <span className="tabular-nums">{speed}x</span>
                </div>
                <input
                  type="number"
                  min={0.25}
                  max={4}
                  step={0.25}
                  disabled={running}
                  value={speed}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setSpeed(Math.max(0.25, Math.min(4, next)));
                  }}
                  className="px-3 w-full h-9 text-sm rounded-lg border border-gray-200"
                />
              </label>
              <div className="flex gap-1.5">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    disabled={running}
                    onClick={() => setSpeed(rate)}
                    className="flex-1 h-8 text-xs font-semibold rounded-lg border"
                    style={{
                      color: speed === rate ? "#fff" : color,
                      background: speed === rate ? color : "#fff",
                      borderColor: color,
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {mode === "volume" ? (
            <div className="p-3 space-y-2 bg-white rounded-xl border border-gray-200">
              <label className="block">
                <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                  <span>{t("Âm lượng (dB)")}</span>
                  <span className="tabular-nums">
                    {volumeDb > 0 ? "+" : ""}
                    {volumeDb}
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  disabled={running}
                  value={volumeDb}
                  onChange={(e) => setVolumeDb(Number(e.target.value))}
                  className="w-full voice-range-rose"
                  style={{
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${
                      ((volumeDb + 12) / 24) * 100
                    }%, #e5e7eb ${((volumeDb + 12) / 24) * 100}%, #e5e7eb 100%)`,
                  }}
                />
              </label>
            </div>
          ) : null}
          {mode === "crop" ? (
            <div className="flex gap-1.5">
              {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  disabled={running}
                  onClick={() => setCropAspect(ratio)}
                  className="flex-1 h-8 text-xs font-semibold rounded-lg border"
                  style={{
                    color: cropAspect === ratio ? "#fff" : color,
                    background: cropAspect === ratio ? color : "#fff",
                    borderColor: color,
                  }}
                >
                  {ratio}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "fade" ? (
            <label className="block p-3 bg-white rounded-xl border border-gray-200">
              <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                <span>{t("Thời lượng fade (giây)")}</span>
                <span className="tabular-nums">{fadeSec}s</span>
              </div>
              <input
                type="number"
                min={0.1}
                max={8}
                step={0.1}
                disabled={running}
                value={fadeSec}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setFadeSec(Math.max(0.1, Math.min(8, next)));
                }}
                className="px-3 w-full h-9 text-sm rounded-lg border border-gray-200"
              />
            </label>
          ) : null}
          {src ? (
            audioMode ? (
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <div className="flex gap-2.5 items-center mb-3">
                  <div
                    className="flex flex-shrink-0 justify-center items-center w-9 h-9 rounded-lg"
                    style={{ background: `${color}22` }}
                  >
                    <MdPerson className="text-xl" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight text-gray-900 truncate">
                      {file?.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {t("Audio")} · {formatClock(duration)}
                    </div>
                  </div>
                </div>
                <VoiceWaveformPlayer
                  src={src}
                  color={color}
                  mediaRef={mediaRef as MutableRefObject<HTMLAudioElement | null>}
                  onDuration={onDuration}
                  onTimeUpdate={(time) => setCurrent(time)}
                  onDownload={(e) => {
                    e.stopPropagation();
                    if (file) saveAs(file, file.name);
                  }}
                />
              </div>
            ) : (
              <div className="overflow-hidden bg-black rounded-xl border border-gray-200">
                <video
                  ref={(el) => {
                    mediaRef.current = el;
                  }}
                  src={src}
                  controls
                  className="w-full max-h-56 bg-black"
                  onLoadedMetadata={(e) => onMeta(e.currentTarget)}
                  onDurationChange={(e) => onMeta(e.currentTarget)}
                  onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
                />
              </div>
            )
          ) : null}
          {mode === "trim" && duration > 0 ? (
            <div className="p-3 space-y-3 bg-white rounded-xl border border-gray-200">
              <div className="flex gap-2 items-end">
                <TimeField
                  label={t("Điểm đầu")}
                  value={start}
                  disabled={running}
                  onCommit={(sec) => {
                    clampRange(sec, end);
                    seek(sec);
                  }}
                />
                <TimeField
                  label={t("Điểm cuối")}
                  value={end}
                  disabled={running}
                  onCommit={(sec) => {
                    clampRange(start, sec);
                    seek(sec);
                  }}
                />
                <div className="flex-shrink-0 pb-1.5 text-xs text-gray-500 tabular-nums">
                  {formatClock(end - start)}
                </div>
              </div>
              <TrimRangeBar
                start={start}
                end={end}
                duration={duration}
                color={color}
                disabled={running}
                onChange={clampRange}
                onSeek={seek}
              />
              <p className="text-xs text-gray-500">
                {t("Đoạn cắt")}: {formatClock(start)} → {formatClock(end)} ({formatClock(end - start)})
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => clampRange(current, end)}
                  className="px-2 h-8 text-xs font-semibold text-white rounded-lg border-0"
                  style={{ background: color }}
                >
                  {t("Đặt điểm đầu")}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => clampRange(start, current)}
                  className="px-2 h-8 text-xs font-semibold text-white rounded-lg border-0"
                  style={{ background: color }}
                >
                  {t("Đặt điểm cuối")}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => seek(start)}
                  className="px-2 h-8 text-xs font-medium bg-white rounded-lg border border-gray-200"
                >
                  {t("Tua tới đầu")}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => seek(end)}
                  className="px-2 h-8 text-xs font-medium bg-white rounded-lg border border-gray-200"
                >
                  {t("Tua tới cuối")}
                </button>
              </div>
            </div>
          ) : null}
          {!ownerId ? (
            <p className="text-xs text-amber-700">{t("Vui lòng đăng nhập để lưu file đã cắt")}</p>
          ) : null}
          {error ? <div className="text-sm text-red-600">{t(error)}</div> : null}
        </div>
      </div>
      <div className="flex-shrink-0 px-4 pt-2 pb-4 bg-white border-t border-gray-100">
        {running ? (
          <button
            type="button"
            onClick={cancelRun}
            className="flex gap-1.5 justify-center items-center w-full h-10 text-sm font-semibold text-white bg-gray-700 rounded-full border-0"
          >
            <RiCloseLine className="text-lg text-white" />
            <span>{t("Dừng tiến trình")}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="flex gap-1.5 justify-center items-center w-full h-10 text-sm font-semibold rounded-full border-0 disabled:cursor-default"
            style={{
              background: canRun ? color : "#d1d5db",
              color: "#ffffff",
            }}
          >
            <RiScissorsCutLine className="text-lg text-white" />
            <span className="text-white">
              {mode === "extract"
                ? t("Tách audio")
                : mode === "silence"
                ? t("Bỏ im lặng")
                : mode === "split"
                ? t("Tách mỗi {{sec}}s", { sec: splitSec })
                : mode === "merge"
                ? t("Ghép file")
                : mode === "speed"
                ? t("Đổi tốc độ {{speed}}x", { speed })
                : mode === "volume"
                ? t("Chỉnh âm lượng")
                : mode === "crop"
                ? t("Crop {{ratio}}", { ratio: cropAspect })
                : mode === "fade"
                ? t("Fade in/out")
                : mode === "reverse"
                ? t("Đảo chiều")
                : mode === "compress"
                ? t("Nén dung lượng")
                : t("Cắt video/audio")}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export function CutVideoResults() {
  const { t } = useTranslation();
  const { history, running, progress, removeHistory, cancelRun } = useVoiceContext();
  const { color } = getVoiceTool("cut");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [featureFilter, setFeatureFilter] = useState("");

  useEffect(() => {
    const next: Record<string, string> = {};
    history.forEach((item) => {
      const blob = item.blobs?.[0];
      if (blob) next[item.id] = URL.createObjectURL(blob);
    });
    setUrls(next);
    return () => {
      Object.values(next).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, [history]);

  const filtered = useMemo(() => {
    if (!featureFilter) return history;
    return history.filter(
      (item) => resultFeatureOf(item, inferCutFeature(item)) === featureFilter
    );
  }, [history, featureFilter]);

  return (
    <div className="space-y-4">
      {history.length || running ? (
        <div className="flex gap-2 items-center px-3 py-2 bg-white rounded-xl border border-gray-200">
          <label className="flex-shrink-0 text-xs font-medium text-gray-600">
            {t("Lọc chức năng")}
          </label>
          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="flex-1 min-w-0 px-2 h-9 text-sm bg-white rounded-lg border border-gray-200"
          >
            <option value="">{t("Tất cả")}</option>
            {CUT_MODES.map((item) => (
              <option key={item.id} value={item.label}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {running ? (
        <div
          className="flex gap-2 items-center px-3 py-2 text-sm rounded-xl border"
          style={{ color, background: `${color}14`, borderColor: `${color}55` }}
        >
          <RiLoader4Line className="text-lg animate-spin" style={{ color }} />
          <span className="flex-1 min-w-0 truncate">{progress || t("Đang xử lý...")}</span>
          <button
            type="button"
            onClick={cancelRun}
            className="flex-shrink-0 px-2.5 h-7 text-xs font-semibold text-white bg-gray-700 rounded-lg border-0"
          >
            {t("Dừng")}
          </button>
        </div>
      ) : null}
      {!history.length && !running ? (
        <div className="flex flex-col justify-center items-center px-6 py-20 text-center bg-white rounded-md">
          <div
            className="flex justify-center items-center mb-4 w-16 h-16 rounded-2xl border shadow-sm"
            style={{ color, background: `${color}14`, borderColor: `${color}33` }}
          >
            <RiScissorsCutLine className="text-3xl" style={{ color }} />
          </div>
          <p className="text-base font-semibold text-slate-700">{t("Chưa có file đã xử lý")}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {t("Chọn công cụ bên trái: cắt, ghép, tốc độ, crop, fade, nén trên máy.")}
          </p>
        </div>
      ) : !filtered.length ? (
        <div className="px-4 py-10 text-sm text-center text-slate-500 bg-white rounded-md">
          {t("Không có kết quả cho chức năng này")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((item) => (
            <CutResultCard
              key={item.id}
              item={item}
              src={urls[item.id]}
              onDelete={() => void removeHistory(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function resultExt(item: VoiceResultRecord): string {
  const fromText = item.texts?.find((row) => row.label === "ext")?.value;
  if (fromText) return fromText;
  const mime = String(item.mimeTypes?.[0] || item.blobs?.[0]?.type || "").toLowerCase();
  const name = String(item.voice?.name || "").toLowerCase();
  if (mime.includes("vtt") || name.endsWith(".vtt")) return "vtt";
  if (name.endsWith(".srt") || mime.includes("subrip")) return "srt";
  if (name.endsWith(".ass")) return "ass";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.startsWith("text/")) return "txt";
  if (mime.startsWith("audio/") || mime.includes("m4a") || mime === "audio/mp4") return "m4a";
  return "mp4";
}

function isSubtitleResult(item: VoiceResultRecord): boolean {
  return ["srt", "ass", "vtt", "txt"].includes(resultExt(item));
}

function isAudioResult(item: VoiceResultRecord): boolean {
  if (isSubtitleResult(item)) return false;
  const mime = String(item.mimeTypes?.[0] || item.blobs?.[0]?.type || "").toLowerCase();
  if (mime.startsWith("audio/")) return true;
  return ["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(resultExt(item));
}

function downloadNameOf(item: VoiceResultRecord): string {
  const name = String(item.voice?.name || item.jobId);
  const ext = resultExt(item);
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

function inferCutFeature(item: VoiceResultRecord): string {
  const labels = (item.texts || []).map((row) => row.label);
  if (labels.includes("Phụ đề")) return "Phụ đề";
  if (labels.includes("Tách audio")) return "Tách audio";
  if (labels.includes("Bỏ im lặng")) return "Bỏ im lặng";
  if (labels.includes("Ghép file")) return "Ghép file";
  if (labels.includes("Đổi tốc độ")) return "Đổi tốc độ";
  if (labels.includes("Âm lượng")) return "Âm lượng";
  if (labels.includes("Tỉ lệ khung")) return "Tỉ lệ khung";
  if (labels.includes("Fade")) return "Fade";
  if (labels.includes("Đảo chiều")) return "Đảo chiều";
  if (labels.includes("Nén dung lượng")) return "Nén dung lượng";
  if (labels.includes("Đoạn cắt")) return "Cắt đoạn";
  return "Cắt video/audio";
}

function CutResultCard({
  item,
  src,
  onDelete,
}: {
  item: VoiceResultRecord;
  src?: string;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const name = String(item.voice?.name || item.jobId);
  const feature = resultFeatureOf(item, inferCutFeature(item));
  const range =
    item.texts?.find((row) => row.label !== "ext" && row.label !== FEATURE_TEXT_LABEL)?.value || "";
  const blob = item.blobs?.[0];
  const ext = resultExt(item);
  const audio = isAudioResult(item);
  const subtitle = isSubtitleResult(item);
  const fileName = downloadNameOf(item);

  return (
    <div
      className={`flex overflow-hidden flex-col bg-white rounded-xl border border-gray-200 ${
        audio ? "self-start w-full" : "h-full"
      }`}
    >
      {src && !subtitle ? (
        audio ? (
          <div className="px-3 pt-3 max-h-16">
            <VoiceWaveformPlayer
              src={src}
              color={getVoiceTool("cut").color}
              onDownload={(e) => {
                e.stopPropagation();
                if (blob) saveAs(blob, fileName);
              }}
            />
          </div>
        ) : (
          <video src={src} controls className="w-full bg-black aspect-video" />
        )
      ) : (
        <div className="flex flex-1 justify-center items-center px-3 py-8 bg-gray-50 min-h-[7.5rem]">
          <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{ext}</span>
        </div>
      )}
      <div className="flex flex-shrink-0 gap-2 items-center p-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">{t(feature)}</div>
          <div className="text-xs text-gray-500 truncate">
            {name}
            {range ? ` · ${range}` : ""}
            {ext ? ` · ${ext.toUpperCase()}` : ""}
          </div>
        </div>
        <button
          type="button"
          title={t("Tải xuống")}
          disabled={!blob}
          onClick={() => blob && saveAs(blob, fileName)}
          className="flex flex-shrink-0 justify-center items-center w-8 h-8 bg-white rounded-lg border border-gray-200"
        >
          <RiDownload2Line className="text-base text-gray-600" />
        </button>
        <button
          type="button"
          title={t("Xóa")}
          onClick={onDelete}
          className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-red-500 bg-white rounded-lg border border-red-200"
        >
          <RiDeleteBinLine className="text-base text-red-500" />
        </button>
      </div>
    </div>
  );
}
