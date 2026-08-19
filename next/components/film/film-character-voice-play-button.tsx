import { useTranslation } from "react-i18next";
import { HiSpeakerWave } from "react-icons/hi2";
import { RiLoader4Line, RiPauseFill } from "react-icons/ri";
import { useFilmVoicePreview } from "./film-voice-preview";

export function FilmCharacterVoicePlayButton({
  blob,
  voiceId,
  className = "",
}: {
  blob?: Blob;
  voiceId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { playing, loading, toggle, canPreview } = useFilmVoicePreview(blob, voiceId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      disabled={!canPreview || loading}
      title={loading ? t("Đang tải...") : t("Nghe thử")}
      aria-label={loading ? t("Đang tải...") : t("Nghe thử")}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-0 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer disabled:opacity-40 disabled:cursor-default flex-shrink-0 ${className}`}
    >
      {loading ? (
        <RiLoader4Line className="text-lg animate-spin" />
      ) : playing ? (
        <RiPauseFill className="text-lg" />
      ) : (
        <HiSpeakerWave className="text-lg" />
      )}
    </button>
  );
}
