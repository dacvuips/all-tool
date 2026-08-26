/**
 * Danh sách giọng miễn phí (Flow2). Mặc định: chưa chọn (placeholder "Chọn giọng").
 * Style đồng bộ upload audio / source (pink accent — không dùng emerald).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown } from "react-icons/hi";
import { MdRecordVoiceOver } from "react-icons/md";
import { RiCloseLine } from "react-icons/ri";
import { FREE_GEN_AUDIO_VOICES, freeGenAudioVoiceLabel } from "./free-voice-voices";

export const FREE_VOICE_NONE = "";

type SharedProps = {
  value?: string | null;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  className?: string;
  /** Placeholder khi chưa chọn (mặc định: "Chọn giọng") */
  placeholder?: string;
};

function normalizeVoiceValue(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Dropdown chọn giọng — toolbar batch / dưới tab Video (style giống source audio). */
export function FreeVoiceSelect({
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder,
}: SharedProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = normalizeVoiceValue(value);
  const placeholderText = placeholder || t("Chọn giọng");
  const selectedLabel = selected
    ? freeGenAudioVoiceLabel(selected).split(" — ")[0] || selected
    : "";

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (voiceId: string) => {
    onChange(voiceId);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative min-w-[10rem] flex-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        title={selected ? freeGenAudioVoiceLabel(selected) : placeholderText}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className={`w-full flex items-center gap-1.5 text-left text-xs bg-white border rounded-lg py-1.5 pl-2 pr-2 shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-pink-300 focus:border-pink-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          selected
            ? "border-pink-300 text-gray-800"
            : "border-gray-200 text-gray-400 hover:border-pink-300"
        }`}
      >
        <span
          className={`inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-md ${
            selected ? "bg-pink-100" : "bg-gray-100"
          }`}
        >
          <MdRecordVoiceOver
            className={`text-sm ${selected ? "text-pink-500" : "text-gray-400"}`}
            aria-hidden
          />
        </span>
        <span className="flex-1 min-w-0 truncate font-medium">
          {selectedLabel || placeholderText}
        </span>
        {selected && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="inline-flex flex-shrink-0 items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-danger hover:bg-red-50"
            title={t("Xóa giọng")}
            aria-label={t("Xóa giọng")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(FREE_VOICE_NONE);
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange(FREE_VOICE_NONE);
                setOpen(false);
              }
            }}
          >
            <RiCloseLine className="text-sm leading-none" />
          </span>
        ) : (
          <HiChevronDown className="flex-shrink-0 text-sm text-gray-400" aria-hidden />
        )}
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-full w-max max-w-[20rem] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <FreeVoiceList value={selected} onChange={pick} className="max-h-56" />
        </div>
      ) : null}
    </div>
  );
}

/** Danh sách nút (popover Film / dropdown) — mỗi dòng có icon voice. */
export function FreeVoiceList({ value, onChange, disabled = false, className = "" }: SharedProps) {
  const selected = normalizeVoiceValue(value);

  return (
    <div className={`max-h-56 overflow-y-auto py-1 ${className}`}>
      {FREE_GEN_AUDIO_VOICES.map((voice) => {
        const isSelected = selected === voice.id;
        return (
          <button
            key={voice.id}
            type="button"
            disabled={disabled}
            className={`w-full flex items-start gap-2 text-left px-3 py-2 border-0 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected ? "bg-pink-50" : "bg-transparent hover:bg-gray-50"
            }`}
            onClick={() => onChange(voice.id)}
          >
            <span
              className={`inline-flex flex-shrink-0 items-center justify-center w-7 h-7 mt-0.5 rounded-lg ${
                isSelected ? "bg-pink-100" : "bg-gray-100"
              }`}
            >
              <MdRecordVoiceOver
                className={`text-sm ${isSelected ? "text-pink-500" : "text-gray-400"}`}
                aria-hidden
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-gray-800">{voice.name}</span>
              <span className="block text-xs text-gray-500 truncate">{voice.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
