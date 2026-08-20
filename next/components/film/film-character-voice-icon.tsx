import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiSpeakerWave, HiXMark } from "react-icons/hi2";
import { RiPauseFill, RiUserVoiceLine } from "react-icons/ri";
import { voicePreviewUrl } from "../app/voice/voice-api";
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
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef("");
  const hasVoice = filmCharacterHasVoice(character);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    audioRef.current = null;
  }, [character?.id, character?.voiceId, character?.voicePreviewBlob]);

  if (!hasVoice || !character) return null;

  const resolveSrc = () => {
    if (character.voicePreviewBlob) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(character.voicePreviewBlob);
      objectUrlRef.current = url;
      return url;
    }
    const id = character.voiceId?.trim();
    return id ? voicePreviewUrl(id) : "";
  };

  const handleClick = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const src = resolveSrc();
    if (!src) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
    } else {
      audio.src = src;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      className={`inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer ${
        playing ? "text-red-500 hover:bg-red-50" : "text-green-500 hover:bg-green-50"
      } ${className}`}
      title={t("Nghe thử giọng")}
      aria-label={t("Nghe thử giọng")}
    >
      {playing ? <RiPauseFill className="text-base" /> : <HiSpeakerWave className="text-base" />}
    </button>
  );
}
