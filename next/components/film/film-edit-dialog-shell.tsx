/**
 * Body form modal chỉnh sửa Film (scroll).
 * Tiêu đề / close: Dialog `title` + header chuẩn.
 * Footer: Dialog.Footer (Hủy / Lưu).
 */
import type { CSSProperties, ReactNode } from "react";

/**
 * className cho Dialog film edit — pad dọc nhỏ hơn mặc định (py-20) để đủ chỗ footer.
 */
export const FILM_EDIT_DIALOG_WRAPPER_CLASS =
  "fixed w-full h-screen top-0 left-0 z-100 flex flex-col items-center justify-center overflow-y-auto py-6 sm:py-8";

export const FILM_EDIT_DIALOG_CLASS =
  "relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl mt-10 mb-6";

export const FILM_EDIT_DIALOG_HEADER_CLASS =
  "relative flex items-center px-5 py-2 box-content bg-white z-5 rounded-t border-b border-gray-100";

export const FILM_EDIT_DIALOG_BODY_CLASS =
  "relative flex-1 min-h-0 p-0 pb-4 overflow-hidden bg-white";

export const FILM_EDIT_DIALOG_FOOTER_CLASS =
  "relative flex-shrink-0 flex justify-end items-center gap-2 px-5 pt-3 pb-4 bg-white border-t border-gray-100 z-5";

export default function FilmEditDialogShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-y-auto overscroll-contain px-5 py-4 space-y-3.5"
      style={{
        // header + footer Dialog + pad wrapper
        maxHeight: "calc(100vh - 12rem)",
      }}
    >
      {children}
    </div>
  );
}

/** Prompt instruction dài — giới hạn chiều cao, scroll trong textarea */
export const FILM_EDIT_PROMPT_TEXTAREA_CLASS =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y font-mono overflow-y-auto";

export const FILM_EDIT_PROMPT_TEXTAREA_STYLE: CSSProperties = {
  maxHeight: 160,
  minHeight: 96,
};
