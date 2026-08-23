import { useTranslation } from "react-i18next";
import { HiPlay, HiSpeakerWave } from "react-icons/hi2";
import { RiLoader4Line, RiPauseFill } from "react-icons/ri";
import { useFilmVoicePreview } from "./film-voice-preview";

const PLAY_BTN_SIZE = {
  sm: "w-5 h-5 rounded-md",
  md: "w-6 h-6 rounded-lg",
} as const;

const PLAY_ICON_SIZE = {
  sm: "text-sm",
  md: "text-base",
} as const;

export function FilmCharacterVoicePlayButton({
  blob,
  voiceId,
  className = "",
  size = "md",
}: {
  blob?: Blob;
  voiceId?: string;
  className?: string;
  size?: keyof typeof PLAY_BTN_SIZE;
}) {
  const { t } = useTranslation();
  const { playing, loading, toggle, canPreview, hasCached } = useFilmVoicePreview(blob, voiceId);
  const iconClass = PLAY_ICON_SIZE[size];
  const btnClass = PLAY_BTN_SIZE[size];

  const title = loading
    ? t("Đang tải...")
    : playing
      ? t("Tạm dừng")
      : hasCached
        ? t("Phát audio đã lưu")
        : t("Tạo audio nghe thử");

  const colorClass = hasCached
    ? "bg-primary-light text-primary hover:bg-primary hover:text-white"
    : "bg-blue-50 text-blue-600 hover:bg-blue-100";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      disabled={!canPreview || loading}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default flex-shrink-0 ${colorClass} ${btnClass} ${className}`}
    >
      {loading ? (
        <RiLoader4Line className={`${iconClass} animate-spin`} />
      ) : playing ? (
        <RiPauseFill className={iconClass} />
      ) : hasCached ? (
        <HiPlay className={iconClass} />
      ) : (
        <HiSpeakerWave className={iconClass} />
      )}
    </button>
  );
}
