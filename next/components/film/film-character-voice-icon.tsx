import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiSpeakerWave, HiXMark } from "react-icons/hi2";
import { RiPauseFill } from "react-icons/ri";
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

type Props = {
  character?: FilmCharacterRecord | null;
  onEdit?: (c: FilmCharacterRecord) => void;
  className?: string;
};

export default function FilmCharacterVoiceIcon({ character, onEdit, className = "" }: Props) {
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

  const resolveSrc = () => {
    if (!character) return "";
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
    if (!hasVoice || !character) {
      if (character) onEdit?.(character);
      return;
    }
    const src = resolveSrc();
    if (!src) {
      onEdit?.(character);
      return;
    }
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
        playing
          ? "text-red-500 hover:bg-red-50"
          : hasVoice
          ? "text-green-500 hover:bg-green-50"
          : "text-gray-300 hover:bg-gray-100"
      } ${className}`}
      title={
        hasVoice ? t("Nghe thử giọng") : t("Tạo giọng — mở Sửa nhân vật")
      }
      aria-label={
        hasVoice ? t("Nghe thử giọng") : t("Tạo giọng — mở Sửa nhân vật")
      }
    >
      {playing ? <RiPauseFill className="text-base" /> : <HiSpeakerWave className="text-base" />}
    </button>
  );
}
