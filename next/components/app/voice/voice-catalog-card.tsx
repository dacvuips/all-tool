import { saveAs } from "file-saver";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { MdChildCare, MdFemale, MdMale, MdPerson } from "react-icons/md";
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiCloseLine,
  RiDownload2Line,
  RiLoader4Line,
  RiPauseFill,
  RiPlayFill,
} from "react-icons/ri";
import { voicePreviewUrl } from "./voice-api";
import { useVoiceContext } from "./voice-provider";
import { getVoiceTool } from "./voice-tools-config";
import type { MicroxVoice } from "./voice-types";
import { voiceIdOf } from "./voice-types";

const WAVE_PATTERN = [
  8, 14, 10, 18, 11, 6, 17, 12, 20, 9, 15, 5, 16, 11, 19, 8, 14, 10, 17, 6, 15, 12, 9, 18, 6, 16,
  10, 20, 12, 7, 16, 13, 8, 19, 11, 5, 15, 14, 9, 18,
];
const WAVE_BAR_WIDTH = 2;
const WAVE_BAR_GAP = 3;

function waveHeights(count: number): number[] {
  const bars = new Array(count);
  for (let i = 0; i < count; i++) bars[i] = WAVE_PATTERN[i % WAVE_PATTERN.length];
  return bars;
}

const ROLE_MAP: Record<string, string> = {
  advertise: "Quảng cáo",
  commercial: "Quảng cáo",
  sales: "Bán hàng",
  news: "Tin tức",
  education: "Giáo dục",
  educational: "Giáo dục",
  story: "Kể chuyện",
  storyteller: "Kể chuyện",
  review: "Đánh giá",
  audiobook: "Sách nói",
  children: "Thiếu nhi",
  kids: "Thiếu nhi",
  conversation: "Hội thoại",
  conversational: "Hội thoại",
  uncategorized: "Chưa phân loại",
  uncategorised: "Chưa phân loại",
  brand: "Giọng thương hiệu",
  brand_voice: "Giọng thương hiệu",
  narrator: "Người dẫn chuyện",
  narrative: "Người dẫn chuyện",
};

const ROLE_COLOR: Record<string, string> = {
  advertise: "#ea580c",
  commercial: "#ea580c",
  "quảng cáo": "#ea580c",
  sales: "#d97706",
  "bán hàng": "#d97706",
  news: "#2563eb",
  "tin tức": "#2563eb",
  education: "#0d9488",
  educational: "#0d9488",
  "giáo dục": "#0d9488",
  story: "#7c3aed",
  storyteller: "#7c3aed",
  "kể chuyện": "#7c3aed",
  review: "#e11d48",
  "đánh giá": "#e11d48",
  audiobook: "#4f46e5",
  "sách nói": "#4f46e5",
  children: "#db2777",
  kids: "#db2777",
  "thiếu nhi": "#db2777",
  conversation: "#0891b2",
  conversational: "#0891b2",
  "hội thoại": "#0891b2",
  uncategorized: "#6b7280",
  uncategorised: "#6b7280",
  "chưa phân loại": "#6b7280",
  brand: "#c026d3",
  brand_voice: "#c026d3",
  "giọng thương hiệu": "#c026d3",
  narrator: "#475569",
  narrative: "#475569",
  "người dẫn chuyện": "#475569",
};

export function voiceCategoryColor(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ROLE_COLOR[key] || ROLE_COLOR[raw.trim().toLowerCase()] || "#9ca3af";
}

const BADGE_MAP: Record<string, string> = {
  voice_conversion: "Chuyển giọng",
  conversion: "Chuyển giọng",
  clone: "Nhân bản",
  cloned: "Nhân bản",
};

function field(voice: MicroxVoice, keys: string[]): string {
  for (const key of keys) {
    const v = voice[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function prettyLabel(
  raw: string,
  map: Record<string, string>,
  translate: (key: string) => string
): string {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (map[key]) return translate(map[key]);
  const fallback = raw.replace(/_/g, " ").trim();
  return translate(fallback);
}

function genderOf(voice: MicroxVoice): "male" | "female" | "child" | "" {
  const raw = String(voice.gender || voice.sex || voice.voice_gender || "").toLowerCase();
  if (!raw.trim()) return "";
  if (
    raw.includes("female") ||
    raw.includes("woman") ||
    raw.includes("nữ") ||
    raw.includes("girl")
  ) {
    return "female";
  }
  if (raw.includes("child") || raw.includes("kid") || raw.includes("trẻ")) return "child";
  if (raw.includes("male") || raw.includes("man") || raw.includes("nam") || raw.includes("boy")) {
    return "male";
  }
  return "";
}

function GenderIcon({ gender, color }: { gender: ReturnType<typeof genderOf>; color: string }) {
  const Icon =
    gender === "female"
      ? MdFemale
      : gender === "male"
      ? MdMale
      : gender === "child"
      ? MdChildCare
      : MdPerson;
  const iconColor = gender === "female" ? "#ec4899" : color;
  return <Icon className="text-xl" style={{ color: iconColor }} />;
}

function safeFileName(raw: string): string {
  return (
    raw
      .replace(/[<>:"/\\|?*]+/g, "_")
      .trim()
      .slice(0, 80) || "voice"
  );
}

async function saveAudioFile(src: string, fileName: string) {
  if (src.startsWith("blob:")) {
    const res = await fetch(src);
    const blob = await res.blob();
    saveAs(blob, fileName);
    return;
  }
  const res = await fetch(src, { credentials: "include" });
  if (!res.ok) throw new Error("Tải voice thất bại");
  const blob = await res.blob();
  saveAs(blob, fileName);
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function readDuration(el: HTMLAudioElement): number {
  const d = el.duration;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export function VoiceWaveformPlayer({
  src,
  color,
  onDownload,
  downloading = false,
  mediaRef,
  onTimeUpdate,
  onDuration,
}: {
  src?: string;
  color: string;
  onDownload?: (e: React.MouseEvent) => void;
  downloading?: boolean;
  mediaRef?: MutableRefObject<HTMLAudioElement | null>;
  onTimeUpdate?: (current: number, duration: number) => void;
  onDuration?: (duration: number) => void;
}) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barCount, setBarCount] = useState(24);

  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const next = Math.max(8, Math.floor((width + WAVE_BAR_GAP) / (WAVE_BAR_WIDTH + WAVE_BAR_GAP)));
      setBarCount((prev) => (prev === next ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const syncTime = (el: HTMLAudioElement) => {
    setProgress(el.currentTime || 0);
    const nextDuration = readDuration(el);
    if (nextDuration) setDuration(nextDuration);
    onTimeUpdate?.(el.currentTime || 0, nextDuration);
    if (nextDuration) onDuration?.(nextDuration);
  };

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      const other = (event as CustomEvent<HTMLAudioElement | null>).detail;
      const audio = audioRef.current;
      if (audio && other && other !== audio) audio.pause();
    };
    window.addEventListener("microx-voice-preview", onOtherPlay);
    return () => window.removeEventListener("microx-voice-preview", onOtherPlay);
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const onSeekWave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const node = e.currentTarget as HTMLElement;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((e.clientX - rect.left) / rect.width) * duration;
    audio.currentTime = Math.min(duration, Math.max(0, next));
    syncTime(audio);
  };

  const ratio = duration > 0 ? Math.min(1, progress / duration) : 0;
  const bars = waveHeights(barCount);

  return (
    <div className="flex gap-2 items-center">
      {src && (
        <audio
          ref={(el) => {
            audioRef.current = el;
            if (mediaRef) mediaRef.current = el;
          }}
          src={src}
          preload="auto"
          onPlay={() => {
            setPlaying(true);
            if (audioRef.current) syncTime(audioRef.current);
            window.dispatchEvent(
              new CustomEvent("microx-voice-preview", {
                detail: audioRef.current,
              })
            );
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
          onTimeUpdate={(e) => syncTime(e.currentTarget)}
          onLoadedMetadata={(e) => syncTime(e.currentTarget)}
          onDurationChange={(e) => syncTime(e.currentTarget)}
        />
      )}
      <button
        type="button"
        disabled={!src}
        onClick={toggle}
        className={`flex flex-shrink-0 justify-center items-center w-8 h-8 rounded-lg disabled:opacity-40 ${
          playing ? "bg-danger-light" : ""
        }`}
        style={{ background: playing ? undefined : color }}
      >
        {playing ? (
          <RiPauseFill className="text-lg text-danger-dark" />
        ) : (
          <RiPlayFill className="ml-0.5 text-lg text-white" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          ref={waveRef}
          onClick={onSeekWave}
          className="flex overflow-hidden items-center w-full h-6 cursor-pointer"
          style={{ gap: WAVE_BAR_GAP }}
        >
          {bars.map((h, i) => {
            const filled = barCount > 0 && i / barCount <= ratio;
            return (
              <span
                key={i}
                className="flex-shrink-0 rounded-full"
                style={{
                  width: WAVE_BAR_WIDTH,
                  height: `${h}px`,
                  background: filled ? color : `${color}1A`,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-xs tabular-nums text-gray-400">{formatClock(progress)}</span>
          <span className="flex gap-1 items-center">
            <span className="text-xs tabular-nums text-gray-400">{formatClock(duration)}</span>
            {onDownload ? (
              <button
                type="button"
                title={t("Tải voice")}
                aria-label={t("Tải voice")}
                disabled={downloading}
                onClick={onDownload}
                className="flex flex-shrink-0 justify-center items-center p-0 w-4 h-4 bg-transparent rounded border-0"
                style={{ color }}
              >
                {downloading ? (
                  <RiLoader4Line className="text-sm animate-spin" />
                ) : (
                  <RiDownload2Line className="text-sm" />
                )}
              </button>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

export function VoiceCatalogCard({
  voice,
  onPick,
  variant = "grid",
  saved = false,
  onToggleSave,
  audioSrc,
  showSave = true,
  showBadge = true,
  onDownload,
  onClear,
  tag,
  accentColor,
}: {
  voice: MicroxVoice;
  onPick?: (voice: MicroxVoice) => void;
  variant?: "grid" | "list" | "compact";
  saved?: boolean;
  onToggleSave?: (voice: MicroxVoice) => void;
  audioSrc?: string;
  showSave?: boolean;
  showBadge?: boolean;
  onDownload?: () => void;
  onClear?: () => void;
  tag?: string;
  accentColor?: string;
}) {
  const { t } = useTranslation();
  const { tool, generatedUrls } = useVoiceContext();
  const color = accentColor || getVoiceTool(tool).color;
  const colorSoft = `${color}22`;
  const id = voiceIdOf(voice);
  const name = field(voice, ["name", "display_name", "label"]) || id || t("Voice");
  const roleRaw =
    field(voice, ["category", "role", "type", "voice_type"]) || field(voice, ["gender"]) || "Voice";
  const cap = (voice.capabilities && voice.capabilities[0]) || field(voice, ["capability"]);
  const badgeRaw =
    cap && !/^(directed|tts|text_to_speech)$/i.test(cap.replace(/[\s-]+/g, "_"))
      ? prettyLabel(cap, BADGE_MAP, t)
      : "";
  const badge = badgeRaw && badgeRaw !== t("Đọc kịch bản") ? badgeRaw : "";
  const sample = field(voice, ["sample_text", "preview_text", "text", "bio", "intro"]);
  const useCase = field(voice, ["use_case", "title", "headline", "style_name"]);
  const heading =
    useCase ||
    (field(voice, ["description"]) && field(voice, ["description"]) !== sample
      ? field(voice, ["description"])
      : "");
  const audio = audioSrc || generatedUrls[id] || (id ? voicePreviewUrl(id) : "");
  const gender = genderOf(voice);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
      return;
    }
    if (!audio || downloading) return;
    setDownloading(true);
    try {
      await saveAudioFile(audio, `${safeFileName(name)}.mp3`);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role={onPick ? "button" : undefined}
      tabIndex={onPick ? 0 : undefined}
      onClick={() => onPick?.(voice)}
      onKeyDown={(e) => {
        if (!onPick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(voice);
        }
      }}
      className={`group relative flex w-full min-w-0 overflow-hidden text-left bg-white rounded-xl border border-gray-200 ${
        variant === "list"
          ? "flex-col gap-2 p-2 md:flex-row md:gap-4 md:items-center"
          : variant === "compact"
          ? "flex-col p-2"
          : "flex-col p-2 min-h-72"
      } ${onPick ? "cursor-pointer hover:shadow-lg" : ""}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
      }}
    >
      {onClear ? (
        <button
          type="button"
          title={t("Xóa")}
          aria-label={t("Xóa")}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="flex absolute top-1.5 right-1.5 z-10 justify-center items-center w-7 h-7 text-white bg-red-500 rounded-full border-0"
        >
          <RiCloseLine className="text-base" />
        </button>
      ) : null}
      <div
        className={`flex gap-2.5 items-center min-w-0 ${variant === "list" ? "md:flex-1" : ""} ${
          onClear ? "pr-7" : ""
        }`}
      >
        <div
          className="flex flex-shrink-0 justify-center items-center w-9 h-9 rounded-lg"
          style={{ background: colorSoft }}
        >
          <GenderIcon gender={gender} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold leading-tight text-gray-900 truncate">{name}</div>
          <div
            className="mt-0.5 text-xs tracking-widest truncate"
            style={{ color: voiceCategoryColor(roleRaw) }}
          >
            {tag || prettyLabel(roleRaw, ROLE_MAP, t)}
          </div>
        </div>
        {showSave ? (
          <button
            type="button"
            title={t("Lưu giọng")}
            aria-label={t("Lưu giọng")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave?.(voice);
            }}
            className="flex flex-shrink-0 justify-center items-center w-8 h-8 rounded-lg"
            style={{ background: colorSoft }}
          >
            {saved ? (
              <RiBookmarkFill className="text-base" style={{ color }} />
            ) : (
              <RiBookmarkLine className="text-base" style={{ color }} />
            )}
          </button>
        ) : null}
        {showBadge && badge ? (
          <span
            className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold tracking-wider uppercase rounded-full"
            style={{ color, background: colorSoft }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {variant === "grid" && (heading || sample) ? (
        <div className="pt-5 pb-6">
          {heading ? (
            <div className="text-lg font-bold leading-snug text-gray-900">{heading}</div>
          ) : null}
          {sample ? (
            <p className={`text-sm leading-relaxed text-gray-500 ${heading ? "mt-2" : ""}`}>
              {sample}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          variant === "list"
            ? "pt-2 w-full min-w-0 border-t border-gray-100 md:flex-shrink-0 md:w-56 md:pt-0 md:border-0"
            : "pt-2 mt-auto border-t border-gray-100"
        }
      >
        <VoiceWaveformPlayer
          src={audio || undefined}
          color={color}
          downloading={downloading}
          onDownload={audio || onDownload ? handleDownload : undefined}
        />
      </div>
    </div>
  );
}
