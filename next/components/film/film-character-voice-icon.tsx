import { useTranslation } from "react-i18next";
import { HiXMark } from "react-icons/hi2";
import { RiUserVoiceLine } from "react-icons/ri";
import { FilmCharacterVoicePlayButton } from "./film-character-voice-play-button";
import type { FilmCharacterRecord } from "./film-types";

export function filmCharacterHasVoice(
  character?: Pick<FilmCharacterRecord, "voiceId" | "voiceLabel" | "voicePreviewBlob"> | null
): boolean {
  if (!character) return false;
  return Boolean(
    character.voiceId?.trim() || character.voiceLabel?.trim() || character.voicePreviewBlob
  );
}

export function clearFilmCharacterVoice(character: FilmCharacterRecord): FilmCharacterRecord {
  return {
    ...character,
    voiceId: undefined,
    voiceLabel: undefined,
    voicePreviewBlob: undefined,
    voiceResultId: undefined,
    updatedAt: new Date().toISOString(),
  };
}

type UnlinkButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
};

export function FilmCharacterVoiceUnlinkButton({
  onClick,
  className = "",
  title,
  disabled = false,
}: UnlinkButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || t("Xóa gắn giọng")}
      aria-label={title || t("Xóa gắn giọng")}
      className={`inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-md border-0 bg-transparent text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <HiXMark className="text-sm" />
    </button>
  );
}

type CreateButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export function FilmCharacterVoiceCreateButton({ onClick, className = "" }: CreateButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("Tạo giọng")}
      aria-label={t("Tạo giọng")}
      className={`inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-md border-0 bg-transparent text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer ${className}`}
    >
      <RiUserVoiceLine className="text-base" />
    </button>
  );
}

type Props = {
  character?: FilmCharacterRecord | null;
  className?: string;
};

export default function FilmCharacterVoiceIcon({ character, className = "" }: Props) {
  const hasVoice = filmCharacterHasVoice(character);

  if (!hasVoice || !character) return null;

  return (
    <FilmCharacterVoicePlayButton
      blob={character.voicePreviewBlob}
      voiceId={character.voiceId}
      className={`!w-6 !h-6 !rounded-md !bg-transparent hover:!bg-green-50 !text-green-500 hover:!text-green-600 ${className}`}
    />
  );
}
