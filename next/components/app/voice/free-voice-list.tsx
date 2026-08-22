/**
 * Danh sách giọng miễn phí (Flow2). Mặc định: chưa chọn (placeholder "Chọn giọng").
 * Dùng dropdown tùy chỉnh để mỗi option có icon voice (native <option> không hỗ trợ).
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

/** Dropdown chọn giọng — dùng dưới "Ảnh tham chiếu" / toolbar batch. */
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
        className={`w-full flex items-center gap-1.5 text-left text-xs bg-white border border-emerald-200 rounded-lg py-0.5 pl-2 pr-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          selected ? "text-gray-700" : "text-gray-400"
        }`}
      >
        <MdRecordVoiceOver
          className={`flex-shrink-0 text-sm ${selected ? "text-emerald-600" : "text-gray-400"}`}
          aria-hidden
        />
        <span className="flex-1 min-w-0 truncate">{selectedLabel || placeholderText}</span>
        {selected && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="inline-flex flex-shrink-0 items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-full w-max max-w-[20rem] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
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
              isSelected ? "bg-emerald-50" : "bg-transparent hover:bg-gray-50"
            }`}
            onClick={() => onChange(voice.id)}
          >
            <MdRecordVoiceOver
              className={`flex-shrink-0 text-sm mt-0.5 ${
                isSelected ? "text-emerald-600" : "text-gray-400"
              }`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-gray-800">{voice.name}</span>
              <span className="block text-10 text-gray-500 truncate">{voice.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
