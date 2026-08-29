import { useTranslation } from "react-i18next";

export interface SocialPostScenesCollapseSwitchProps {
  expanded: boolean;
  onToggle: () => void;
  /** compact: chỉ switch; default: switch + label */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SocialPostScenesCollapseSwitch({
  expanded,
  onToggle,
  compact = false,
  disabled = false,
  className = "",
}: SocialPostScenesCollapseSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={expanded}
        aria-label={expanded ? t("Ẩn phân cảnh") : t("Hiện phân cảnh")}
        title={expanded ? t("Ẩn phân cảnh") : t("Hiện phân cảnh")}
        disabled={disabled}
        onClick={onToggle}
        className={`relative w-8 h-4 rounded-full border-0 cursor-pointer transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
          expanded ? "bg-purple-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ease-out ${
            expanded ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      {!compact ? (
        <span
          className={`text-10 font-semibold whitespace-nowrap select-none ${
            disabled ? "cursor-default" : "cursor-pointer"
          } ${expanded ? "text-purple-700" : "text-gray-500"}`}
          onClick={() => {
            if (!disabled) onToggle();
          }}
        ></span>
      ) : null}
    </div>
  );
}
