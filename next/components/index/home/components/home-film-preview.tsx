import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaExpand,
  FaLock,
  FaPause,
  FaPlay,
  FaRedo,
  FaStepBackward,
  FaStepForward,
  FaTrash,
  FaUndo,
  FaVolumeUp,
} from "react-icons/fa";
import { HiChevronDown } from "react-icons/hi";

const RULER_MARKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
const MOCK_DURATION_SEC = 160.1;
const PLAYBACK_SPEED = 8;
const TICK_MS = 40;

const VIDEO_CLIPS = [
  { leftPct: 2, widthPct: 14, label: "01" },
  { leftPct: 17, widthPct: 16, label: "02" },
  { leftPct: 34, widthPct: 12, label: "03" },
  { leftPct: 47, widthPct: 15, label: "04" },
  { leftPct: 63, widthPct: 14, label: "05" },
  { leftPct: 78, widthPct: 18, label: "06" },
];

function getActiveClipIndex(playheadPct: number) {
  return VIDEO_CLIPS.findIndex(
    (clip) => playheadPct >= clip.leftPct && playheadPct < clip.leftPct + clip.widthPct
  );
}

const AUDIO_CLIPS = [
  { left: "2%", width: "28%" },
  { left: "32%", width: "22%" },
  { left: "56%", width: "30%" },
];

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function MockPreviewFrame({ playing }: { playing: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #1a1a2e 0%, #16213e 35%, #0f3460 60%, #1a1a2e 100%)",
        }}
      />
      <div
        className={`absolute inset-0 opacity-60 ${playing ? "animate-pulse" : ""}`}
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 35% 45%, rgba(251,113,133,0.45), transparent 55%), radial-gradient(ellipse 40% 35% at 70% 55%, rgba(56,189,248,0.3), transparent 50%)",
        }}
      />
      {/* Silhouette nhân vật giả */}
      <div className="absolute bottom-[18%] left-[28%] w-[14%] h-[42%] rounded-t-full bg-black/40 blur-[1px]" />
      <div className="absolute bottom-[18%] left-[42%] w-[22%] h-[8%] rounded-full bg-black/25" />
      {/* Scanline nhẹ khi đang phát */}
      {playing && (
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 3px)",
          }}
        />
      )}
    </div>
  );
}

export function HomeFilmPreview() {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);

  useEffect(() => {
    if (!playing) return;

    const step = (TICK_MS / 1000) * PLAYBACK_SPEED;
    const id = window.setInterval(() => {
      setCurrentSec((prev) => {
        const next = prev + step;
        return next >= MOCK_DURATION_SEC ? 0 : next;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [playing]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const seekStart = useCallback(() => {
    setCurrentSec(0);
  }, []);

  const playheadPct = Math.min(95, Math.max(2, (currentSec / MOCK_DURATION_SEC) * 100));
  const activeClipIndex = getActiveClipIndex(playheadPct);

  return (
    <div className="w-full min-w-0 select-none">
      <div className="overflow-hidden bg-white rounded-lg border border-dashed border-rose shadow-sm">
        <div className="flex flex-col border-b border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Preview</span>
          </div>

          <div className="relative mx-3 mt-3 overflow-hidden rounded-md bg-black aspect-video">
            <MockPreviewFrame playing={playing} />
            <div className="absolute inset-x-0 bottom-0 flex justify-between items-end px-3 py-2 pointer-events-none bg-gradient-to-t from-black/70 to-transparent">
              <span className="font-mono text-white text-11 sm:text-xs">
                {formatTime(currentSec)} / {formatTime(MOCK_DURATION_SEC)}
              </span>
              <FaExpand className="text-white text-xs opacity-80" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center px-3 py-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex justify-center items-center w-10 h-10 text-white rounded-full transition-colors bg-rose hover:bg-rose-dark"
              aria-label={playing ? t("Tạm dừng") : t("Phát")}
            >
              {playing ? <FaPause className="text-sm" /> : <FaPlay className="ml-0.5 text-sm" />}
            </button>
            <button
              type="button"
              onClick={seekStart}
              className="flex justify-center items-center w-9 h-9 text-gray-600 bg-white rounded-full border border-gray-200 hover:bg-gray-50"
              aria-label={t("Về đầu")}
            >
              <FaStepBackward className="text-xs" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 pointer-events-none"
              aria-hidden
            >
              {t("Xuất")}
              <HiChevronDown className="text-gray-400" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 pointer-events-none"
              aria-hidden
            >
              {t("Tốc độ")} {PLAYBACK_SPEED}x
              <HiChevronDown className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="bg-white">
          <div className="flex justify-end gap-2 items-center px-3 py-1.5 border-b border-gray-100 text-gray-400">
            <FaUndo className="text-xs" />
            <FaRedo className="text-xs" />
            <span className="w-px h-3 bg-gray-200" />
            <FaStepBackward className="text-xs" />
            <FaPause className="text-xs" />
            <FaStepForward className="text-xs" />
            <span className="w-px h-3 bg-gray-200" />
            <FaVolumeUp className="text-xs" />
            <div className="w-16 h-1 rounded-full bg-gray-200">
              <div className="w-2/3 h-full rounded-full bg-rose" />
            </div>
            <FaTrash className="text-xs" />
            <span className="ml-1 text-11 text-gray-500">100%</span>
          </div>

          <div className="overflow-hidden relative">
            <div className="flex border-b border-gray-100">
              <div className="flex-shrink-0 w-16 sm:w-20 border-r border-gray-100" />
              <div className="relative flex-1 h-6">
                {RULER_MARKS.map((m) => (
                  <span
                    key={m}
                    className="absolute top-1 text-10 text-gray-400 -translate-x-1/2"
                    style={{ left: `${(m / 30) * 100}%` }}
                  >
                    {m}
                  </span>
                ))}
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500"
                  style={{ left: `${playheadPct}%` }}
                >
                  <div className="absolute top-0 left-1/2 w-2.5 h-2.5 bg-red-500 rounded-sm -translate-x-1/2" />
                </div>
              </div>
            </div>

            <div
              className="absolute top-6 bottom-0 z-20 w-px bg-red-500 pointer-events-none sm:hidden"
              style={{ left: `calc(4rem + (100% - 4rem) * ${playheadPct} / 100)` }}
            />
            <div
              className="hidden sm:block absolute top-6 bottom-0 z-20 w-px bg-red-500 pointer-events-none"
              style={{ left: `calc(5rem + (100% - 5rem) * ${playheadPct} / 100)` }}
            />

            <TimelineTrack label={t("Video")} lock>
              <div className="relative h-full">
                {VIDEO_CLIPS.map((clip, i) => {
                  const isActive = i === activeClipIndex;
                  return (
                    <div
                      key={clip.label}
                      className={`absolute top-1 bottom-1 overflow-hidden rounded border transition-colors duration-150 ${
                        isActive
                          ? "border-red-500 ring-2 ring-red-400 z-10"
                          : "border-gray-300"
                      }`}
                      style={{ left: `${clip.leftPct}%`, width: `${clip.widthPct}%` }}
                    >
                      <div
                        className="absolute inset-0 transition-colors duration-150"
                        style={{
                          background: isActive
                            ? "linear-gradient(90deg, #fb7185, #ef4444, #dc2626)"
                            : "linear-gradient(90deg, #64748b, #475569, #334155)",
                        }}
                      />
                      <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.2)_8px,rgba(255,255,255,0.2)_16px)]" />
                      {isActive && (
                        <span className="absolute top-0.5 right-0.5 flex justify-center items-center w-4 h-4 text-white bg-red-600 rounded-full text-[8px] font-bold">
                          {clip.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </TimelineTrack>

            <TimelineTrack label={t("Audio")} lock>
              <div className="relative h-full">
                {AUDIO_CLIPS.map((clip, i) => (
                  <div
                    key={i}
                    className="absolute top-1.5 bottom-1.5 overflow-hidden rounded border border-amber-400 bg-amber-100"
                    style={{ left: clip.left, width: clip.width }}
                  >
                    <WaveformFake />
                  </div>
                ))}
              </div>
            </TimelineTrack>

            <TimelineTrack label={t("Phụ đề")} lock last>
              <div className="h-full bg-[repeating-linear-gradient(0deg,transparent,transparent_11px,#f3f4f6_11px,#f3f4f6_12px)]" />
            </TimelineTrack>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTrack({
  label,
  lock,
  last,
  children,
}: {
  label: string;
  lock?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex h-12 sm:h-14 ${last ? "" : "border-b border-gray-100"}`}>
      <div className="flex flex-shrink-0 gap-1.5 justify-between items-center px-2 w-16 sm:w-20 border-r border-gray-100 bg-gray-50">
        <span className="text-10 sm:text-11 font-medium text-gray-600 truncate">{label}</span>
        {lock && <FaLock className="flex-shrink-0 text-[9px] text-gray-400" />}
      </div>
      <div className="relative flex-1 min-w-0 bg-white">{children}</div>
    </div>
  );
}

function WaveformFake() {
  return (
    <div className="flex gap-px items-center px-1 h-full">
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm bg-amber-500 bg-opacity-70"
          style={{ height: `${30 + ((i * 17) % 55)}%` }}
        />
      ))}
    </div>
  );
}
