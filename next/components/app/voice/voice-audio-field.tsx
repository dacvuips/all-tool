import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiUploadCloud2Line } from "react-icons/ri";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  disabled?: boolean;
};

export function VoiceAudioField({ file, onChange, hint, disabled }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex flex-col gap-1 justify-center items-center px-4 py-6 w-full text-left rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary/5 disabled:opacity-60"
      >
        <RiUploadCloud2Line className="text-2xl text-primary" />
        <span className="text-sm font-medium text-gray-800">
          {file ? file.name : t("Chọn file audio")}
        </span>
        {file ? (
          <span className="text-xs text-gray-500">{`${(file.size / 1024 / 1024).toFixed(2)} MB`}</span>
        ) : (
          <span className="text-xs text-gray-500">{hint || t("MP3, WAV, M4A")}</span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          onChange(e.target.files?.[0] || null);
          e.currentTarget.value = "";
        }}
      />
      {file && previewUrl && <audio controls src={previewUrl} className="mt-3 w-full" />}
    </div>
  );
}

export function VoiceRangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
