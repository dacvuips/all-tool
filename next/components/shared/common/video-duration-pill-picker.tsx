import { useTranslation } from "react-i18next";

export type VideoDurationSeconds = 8 | 6 | 4;

const DEFAULT_OPTIONS: VideoDurationSeconds[] = [8, 6, 4];

/**
 * Pill-style video duration selector (Thời lượng video) — shared across
 * feature areas that use the rounded-pill segmented-control look (e.g. Film),
 * as opposed to the square-button grid style used by
 * `affiliate-video/shared/video-duration-picker.tsx`.
 */
export function VideoDurationPillPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  disabled,
  className,
}: {
  value?: VideoDurationSeconds;
  onChange: (duration: VideoDurationSeconds) => void;
  options?: VideoDurationSeconds[];
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const active = value ?? 8;

  return (
    <div
      className={
        className ??
        "inline-flex items-center gap-1 whitespace-nowrap border border-gray-200 rounded-full p-0.5 w-max"
      }
    >
      {options.map((duration) => {
        const isActive = active === duration;
        return (
          <button
            key={duration}
            type="button"
            disabled={disabled}
            onClick={() => onChange(duration)}
            data-tooltip={t("Thời lượng video")}
            data-placement="bottom"
            className={`px-3 py-0 rounded-full text-xs font-semibold border-0 cursor-pointer transition-colors ${
              isActive
                ? "text-blue-700 bg-blue-50"
                : "text-gray-600 bg-transparent hover:bg-gray-50"
            } ${disabled ? "opacity-60" : ""}`}
          >
            {duration}s
          </button>
        );
      })}
    </div>
  );
}
