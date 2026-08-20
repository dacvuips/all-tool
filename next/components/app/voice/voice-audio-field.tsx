import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { MdPerson } from "react-icons/md";
import { RiCloseLine, RiUploadCloud2Line } from "react-icons/ri";
import { VoiceWaveformPlayer } from "./voice-catalog-card";
import { useVoiceContext } from "./voice-provider";
import { getVoiceTool } from "./voice-tools-config";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  disabled?: boolean;
};

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i;

function isAudioFile(item: File) {
  if (item.type.startsWith("audio/")) return true;
  return AUDIO_EXT.test(item.name);
}

function pickAudioFile(list: FileList | File[] | null | undefined): File | null {
  if (!list) return null;
  return Array.from(list).find(isAudioFile) || null;
}

export function VoiceAudioField({ file, onChange, hint, disabled }: Props) {
  const { t } = useTranslation();
  const { tool } = useVoiceContext();
  const { color } = getVoiceTool(tool);
  const ref = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [dragging, setDragging] = useState(false);
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

  const applyFile = (next: File | null) => {
    if (!next) return;
    onChange(next);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCount.current += 1;
    setDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current -= 1;
    if (dragCount.current <= 0) {
      dragCount.current = 0;
      setDragging(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current = 0;
    setDragging(false);
    if (disabled) return;
    applyFile(pickAudioFile(e.dataTransfer.files));
  };

  return (
    <div onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex flex-col gap-1 justify-center items-center px-4 py-6 w-full text-left rounded-xl border border-dashed disabled:opacity-60"
        style={{
          borderColor: dragging ? color : `${color}88`,
          background: dragging ? `${color}14` : "#f9fafb",
        }}
      >
        <RiUploadCloud2Line className="text-2xl" style={{ color }} />
        <span className="text-sm font-medium text-gray-800">
          {dragging
            ? t("Thả file audio vào đây")
            : file
            ? file.name
            : t("Kéo thả hoặc chọn file audio")}
        </span>
        {file && !dragging ? (
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
          applyFile(pickAudioFile(e.target.files));
          e.currentTarget.value = "";
        }}
      />
      {file && previewUrl ? (
        <div className="relative p-2 mt-3 w-full bg-white rounded-xl border border-gray-200 group">
          <button
            type="button"
            title={t("Xóa")}
            aria-label={t("Xóa")}
            disabled={disabled}
            onClick={() => onChange(null)}
            className="flex absolute top-1.5 right-1.5 z-10 justify-center items-center w-7 h-7 text-white bg-red-500 rounded-full border-0 disabled:opacity-40"
          >
            <RiCloseLine className="text-base" />
          </button>
          <div className="flex gap-2.5 items-center pr-7">
            <div
              className="flex flex-shrink-0 justify-center items-center w-9 h-9 rounded-lg"
              style={{ background: `${color}22` }}
            >
              <MdPerson className="text-xl" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold leading-tight text-gray-900 truncate">
                {file.name}
              </div>
              <div className="mt-0.5 text-xs tracking-widest text-gray-400 uppercase">
                {t("Voice")}
              </div>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-gray-100">
            <VoiceWaveformPlayer
              src={previewUrl}
              color={color}
              onDownload={(e) => {
                e.stopPropagation();
                saveAs(file, file.name);
              }}
            />
          </div>
        </div>
      ) : null}
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
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
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
        className="w-full voice-range"
        style={{
          background: `linear-gradient(to right, #F2890D 0%, #F2890D ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
        }}
      />
    </label>
  );
}
