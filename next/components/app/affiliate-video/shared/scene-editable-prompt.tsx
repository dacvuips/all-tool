/**
 * SceneEditablePrompt – preview prompt (clamp 2 dòng) + view/edit trong Dialog.
 * Dùng chung cho các tab Ảnh / Video / Video nối của phân cảnh.
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiEyeLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiPencilLine,
  RiSaveLine,
} from "react-icons/ri";

import { Dialog } from "../../../shared/utilities/dialog/dialog";

export type SceneEditablePromptProps = {
  text: string;
  textColor: string;
  labelEl: React.ReactNode;
  /** Tiêu đề Dialog (vd. IMAGE PROMPT, [MOTION]) */
  title: string;
  onSave: (value: string) => void | Promise<void>;
  /** Layout gọn (elements row) – nút action cạnh text thay vì absolute */
  compact?: boolean;
};

export function SceneEditablePrompt({
  text,
  textColor,
  labelEl,
  title,
  onSave,
  compact = false,
}: SceneEditablePromptProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openView = () => setDialogMode("view");

  const openEdit = () => {
    setEditValue(text ?? "");
    setDialogMode("edit");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditValue("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
    } finally {
      setSaving(false);
      closeDialog();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  useEffect(() => {
    if (dialogMode === "edit" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editValue, dialogMode]);

  const actionButtons = (
    <div
      className={`flex items-center gap-0.5 border border-primary shadow-sm bg-gray-50 rounded-md shrink-0 transition-all ${
        compact ? "" : "absolute z-10 -top-3 -right-1.5 sm:-right-2.5"
      } ${
        hovered
          ? "opacity-100 pointer-events-auto"
          : compact
            ? "opacity-0 pointer-events-none w-0 overflow-hidden border-0 shadow-none"
            : "md:opacity-0 md:pointer-events-none opacity-100 pointer-events-auto"
      }`}
    >
      <button
        type="button"
        onClick={openView}
        title={t("Xem prompt")}
        className="w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer border-0 bg-transparent text-gray-400 hover:text-purple-600 hover:bg-purple-50"
      >
        <RiEyeLine className="text-sm" />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy prompt"
        className="flex justify-center items-center w-6 h-6 text-gray-400 bg-transparent rounded-md border-0 transition-all cursor-pointer hover:text-green-600 hover:bg-green-50"
      >
        {copied ? (
          <span className="text-xs font-bold text-green-500">✓</span>
        ) : (
          <RiFileCopyLine className="text-sm" />
        )}
      </button>
      <button
        type="button"
        onClick={openEdit}
        title={t("Chỉnh sửa")}
        className="flex justify-center items-center w-6 h-6 text-gray-400 bg-transparent rounded-md border-0 transition-all cursor-pointer hover:text-blue-600 hover:bg-blue-50"
      >
        <RiPencilLine className="text-sm" />
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`relative ${compact ? "w-full min-w-0" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={compact ? "flex gap-1.5 items-start" : "relative"}>
          <div
            className={`text-xs leading-relaxed ${textColor} ${
              compact
                ? "flex-1 min-w-0 break-words overflow-hidden text-ellipsis-3"
                : "w-full whitespace-pre-line"
            }`}
            style={
              compact
                ? undefined
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }
            }
          >
            {!compact && labelEl}
            {text}
          </div>
          {actionButtons}
        </div>
      </div>

      <Dialog
        isOpen={dialogMode !== null}
        onClose={closeDialog}
        title={title}
        width="90vw"
        maxWidth="640px"
        slideFromBottom="none"
      >
        <Dialog.Body>
          {dialogMode === "view" ? (
            <div className="space-y-3">
              <div className={`text-sm leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto v-scrollbar ${textColor}`}>
                {labelEl}
                {text}
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors"
                >
                  {copied ? (
                    <span className="font-bold text-green-500">✓</span>
                  ) : (
                    <RiFileCopyLine className="text-sm" />
                  )}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer border-0 transition-colors"
                >
                  <RiPencilLine className="text-sm" />
                  {t("Chỉnh sửa")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 text-sm text-gray-700 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 resize-none transition-colors leading-relaxed max-h-[55vh] overflow-y-auto"
              />
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors"
                >
                  <RiCloseLine className="text-sm" />
                  {t("Đóng")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer border-0 transition-colors disabled:opacity-60 shadow-sm"
                >
                  {saving ? (
                    <RiLoader4Line className="text-sm animate-spin" />
                  ) : (
                    <RiSaveLine className="text-sm" />
                  )}
                  {saving ? `${t("Đang lưu")}...` : t("Lưu")}
                </button>
              </div>
            </div>
          )}
        </Dialog.Body>
      </Dialog>
    </>
  );
}
