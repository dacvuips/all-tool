/**
 * Layout media gọn cho danh sách MXH (inline / row).
 * Khối gom: preview trái + lưới icon 2×2 phải, cùng chiều cao.
 */
import type { ReactNode } from "react";
import { SceneMediaError } from "./scene-media-error";

/** h-7 / w-7 Tailwind */
export const INLINE_TOOLBAR_BTN_PX = 28;
export const INLINE_TOOLBAR_GAP_PX = 2;
/** Chiều cao khối = 2 hàng icon */
export const INLINE_BLOCK_HEIGHT_PX = INLINE_TOOLBAR_BTN_PX * 2 + INLINE_TOOLBAR_GAP_PX;

export const INLINE_LIST_TOOLBAR_BTN =
  "flex items-center justify-center w-7 h-7 min-w-[28px] max-w-[28px] min-h-[28px] max-h-[28px] rounded-md shrink-0 overflow-hidden bg-transparent border-0 shadow-none hover:bg-transparent";

export const INLINE_LIST_TOOLBAR_GRID_CLASS =
  "[&_button]:!w-7 [&_button]:!h-7 [&_button]:!min-w-[28px] [&_button]:!max-w-[28px] [&_button]:!min-h-[28px] [&_button]:!max-h-[28px] [&_button]:!p-0 [&_button]:!bg-transparent [&_button]:hover:!bg-transparent [&_button]:border-0 [&_button]:shadow-none [&_button]:rounded-md [&>div]:!w-7 [&>div]:!h-7 [&>div]:!min-w-0 [&>div]:!max-w-[28px] [&>div]:overflow-hidden";

function getPreviewSize(aspectRatio?: "16:9" | "9:16"): { width: number; height: number } {
  const height = INLINE_BLOCK_HEIGHT_PX;
  const width =
    aspectRatio === "9:16" ? Math.round((height * 9) / 16) : Math.round((height * 16) / 9);
  return { width, height };
}

export function SceneInlineListCell({
  aspectRatio = "16:9",
  preview,
  toolbar,
  frameClassName = "",
  variant = "image",
}: {
  aspectRatio?: "16:9" | "9:16";
  preview: ReactNode;
  toolbar?: ReactNode;
  frameClassName?: string;
  variant?: "image" | "video";
}) {
  const { width, height } = getPreviewSize(aspectRatio);
  const toolbarWidth = INLINE_TOOLBAR_BTN_PX * 2 + INLINE_TOOLBAR_GAP_PX;
  const accentBorder = variant === "video" ? "border-purple-100" : "border-pink-100";
  const accentBg = variant === "video" ? "bg-purple-50/30" : "bg-pink-50/30";

  return (
    <div
      className={`inline-flex overflow-hidden flex-row gap-1 items-start px-1 py-1 bg-white rounded-lg border border-dashed ${accentBorder} ${accentBg}`}
    >
      <div
        className={`overflow-hidden relative bg-gray-100 rounded-md shrink-0 ${frameClassName}`}
        style={{ width, height }}
      >
        <div className="absolute inset-0">{preview}</div>
      </div>
      {toolbar ? (
        <div
          className={`grid grid-cols-2 grid-rows-2 gap-0.5 shrink-0 overflow-hidden place-items-center ${INLINE_LIST_TOOLBAR_GRID_CLASS}`}
          style={{ width: toolbarWidth, height }}
        >
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}

/** Cột ảnh/video trong bảng MXH — căn trái, lỗi chỉ hiện khi có */
export function SceneInlineMediaColumn({
  children,
  error,
}: {
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5 w-fit max-w-full">
      {children}
      {error ? (
        <div className="overflow-hidden w-full">
          <SceneMediaError message={error} variant="compact" />
        </div>
      ) : null}
    </div>
  );
}
