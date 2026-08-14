/**
 * IMAGE PROMPT — 2 dòng + ellipsis (giống tool scene-batch-row, không phụ thuộc line-clamp TW).
 */
import type { CSSProperties, ReactNode } from "react";

const CLAMP_2_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

type Props = {
  /** Toàn bộ prompt; rỗng → không render */
  text: string;
  className?: string;
  /** Nhãn; mặc định IMAGE PROMPT cam */
  label?: ReactNode;
};

export default function FilmImagePromptBlock({ text, className = "", label }: Props) {
  const body = (text || "").trim();
  if (!body) return null;

  return (
    <div className={className}>
      <span
        className="text-xs leading-relaxed text-gray-600 whitespace-pre-line"
        style={CLAMP_2_STYLE}
        title={body}
      >
        {label ?? (
          <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
            IMAGE PROMPT
          </span>
        )}
        {body}
      </span>
    </div>
  );
}
