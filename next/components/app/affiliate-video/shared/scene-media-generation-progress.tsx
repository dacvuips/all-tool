/**
 * scene-media-generation-progress.tsx
 * Loader + % — hover thay bằng icon + chữ "Dừng" màu danger.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line, RiStopCircleLine } from "react-icons/ri";

export type SceneMediaGenerationVariant = "image" | "video" | "extend";

const VARIANT_STYLES: Record<
  SceneMediaGenerationVariant,
  { spinner: string; text: string; border: string; bg: string }
> = {
  image: {
    spinner: "text-pink-500",
    text: "text-pink-600",
    border: "border-pink-200",
    bg: "bg-pink-50",
  },
  video: {
    spinner: "text-purple-500",
    text: "text-purple-600",
    border: "border-purple-200",
    bg: "bg-purple-50",
  },
  extend: {
    spinner: "text-teal-500",
    text: "text-teal-600",
    border: "border-teal-200",
    bg: "bg-teal-50",
  },
};

export interface SceneMediaGenerationProgressProps {
  variant: SceneMediaGenerationVariant;
  progress: number;
  actionPending?: boolean;
  layout?: "compact" | "card" | "minimal" | "inline-cell";
  onStop?: () => void;
}

export function SceneMediaGenerationProgress({
  variant,
  progress,
  actionPending = false,
  layout = "compact",
  onStop,
}: SceneMediaGenerationProgressProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const styles = VARIANT_STYLES[variant];
  const isMinimal = layout === "minimal";
  const isInlineCell = layout === "inline-cell";
  const isCard = layout === "card";
  const iconSize = isInlineCell ? "text-sm" : isMinimal ? "text-xs" : isCard ? "text-xl" : "text-sm";
  const textSize = isInlineCell
    ? "text-10"
    : isMinimal
      ? "text-[9px]"
      : isCard
        ? "text-[10px]"
        : "text-10";
  const showStop = Boolean(onStop) && hovered;

  const shellClass = isInlineCell
    ? "flex justify-center items-center w-full h-full"
    : isMinimal
      ? "flex justify-center items-center shrink-0"
      : isCard
        ? `flex justify-center items-center w-16 min-h-16 rounded-xl border-2 ${styles.border} ${styles.bg}`
        : `flex justify-center items-center min-h-8 min-w-8 px-2 py-1 rounded-lg border ${styles.border} ${styles.bg}`;

  const content = showStop ? (
    <div className="flex flex-col items-center gap-0.5 pointer-events-none">
      {actionPending ? (
        <RiLoader4Line className={`animate-spin text-danger ${iconSize}`} />
      ) : (
        <RiStopCircleLine className={`text-danger ${iconSize}`} />
      )}
      <span className={`font-bold leading-none text-danger ${textSize}`}>{t("Dừng")}</span>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-0.5 pointer-events-none">
      <RiLoader4Line className={`animate-spin ${styles.spinner} ${iconSize}`} />
      <span className={`font-bold leading-none ${styles.text} ${textSize}`}>{progress}%</span>
    </div>
  );

  if (onStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        disabled={actionPending}
        title={t("Dừng")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`cursor-pointer ${shellClass} disabled:cursor-wait`}
      >
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
}
