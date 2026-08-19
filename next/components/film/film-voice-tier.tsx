import { useTranslation } from "react-i18next";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import { getVoiceTool } from "../app/voice/voice-tools-config";

export type FilmVoiceTier = "free" | "paid";

export function resolveFilmVoiceTier(voiceId?: string): FilmVoiceTier | null {
  const id = voiceId?.trim();
  if (!id) return null;
  return isFreeGenAudioVoiceId(id) ? "free" : "paid";
}

export function FilmVoiceTierSuffix({
  voiceId,
  className = "",
}: {
  voiceId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const tier = resolveFilmVoiceTier(voiceId);
  if (!tier) return null;
  return (
    <span
      className={`flex-shrink-0 text-10 font-semibold ${
        tier === "free" ? "text-purple-600" : "text-amber-700"
      } ${className}`}
    >
      ({tier === "free" ? t("Miễn phí") : t("Thu phí")})
    </span>
  );
}

export function FilmVoiceTierTabs({  tier,
  onChange,
}: {
  tier: FilmVoiceTier;
  onChange: (tier: FilmVoiceTier) => void;
}) {
  const { t } = useTranslation();
  const { color } = getVoiceTool("voices");
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-gray-50 border border-gray-100">
      {(
        [
          { id: "free" as const, label: t("Miễn phí") },
          { id: "paid" as const, label: t("Thu phí") },
        ] as const
      ).map((tab) => {
        const selected = tier === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex-1 px-2 py-2.5 text-xs font-bold rounded-lg border-0 cursor-pointer"
            style={{
              color: selected ? color : "#6b7280",
              background: selected ? `${color}14` : "transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
