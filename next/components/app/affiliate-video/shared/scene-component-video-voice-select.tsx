/**
 * Select giọng miễn phí cho gen video Flow2 mode `component` (+ có ảnh).
 * Style đồng bộ upload audio / source (pink).
 */
import { useTranslation } from "react-i18next";
import { FreeVoiceSelect } from "../../voice/free-voice-list";

type Props = {
  value?: string | null;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SceneComponentVideoVoiceSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: Props) {
  const { t } = useTranslation();
  return (
    <div className={`mt-2 ${className}`}>
      <div className="mb-1 text-xs font-semibold text-gray-700">{t("Giọng video")}</div>
      <FreeVoiceSelect
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={t("Chọn giọng")}
      />
    </div>
  );
}

/** Chỉ gắn voice khi mode component và có ≥1 ảnh (khớp rule backend Flow2). */
export function shouldAttachComponentVideoVoice(options: {
  videoMode?: string | null;
  serviceImageType?: string | null;
  componentTab?: boolean;
  imageCount: number;
  voiceDisable?: boolean;
}): boolean {
  if (options.voiceDisable) return false;
  if (options.imageCount < 1) return false;
  if (options.componentTab) return true;
  const mode = String(options.videoMode || "").trim().toLowerCase();
  if (mode === "component" || mode === "reference") return true;
  const service = String(options.serviceImageType || "").trim().toLowerCase();
  return service === "start_add_end";
}

/** Trả voice đã chọn; không chọn / không đủ điều kiện → undefined (không gửi Flow2). */
export function resolveComponentVideoVoiceParam(options: {
  voice?: string | null;
  videoMode?: string | null;
  serviceImageType?: string | null;
  componentTab?: boolean;
  imageCount: number;
  voiceDisable?: boolean;
}): string | undefined {
  if (!shouldAttachComponentVideoVoice(options)) return undefined;
  const voice = String(options.voice || "").trim().toLowerCase();
  return voice || undefined;
}
