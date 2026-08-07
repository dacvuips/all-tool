import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiSparkles } from "react-icons/hi";
import { FilmEpisodeRecord } from "./film-types";

type Props = {
  episode: FilmEpisodeRecord | null;
  onSave: (content: string) => Promise<void>;
  /** Nút Trích xuất — gọi sau khi đã lưu nội dung nếu dirty */
  onExtract?: (content: string) => void | Promise<void>;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Đếm khoảng trắng / xuống dòng; hỗ trợ tiếng Việt
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export default function FilmOriginalContentPanel({ episode, onSave, onExtract }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    setContent(episode?.originalContent || "");
    setDirty(false);
  }, [episode?.id, episode?.originalContent]);

  const wordCount = useMemo(() => countWords(content), [content]);
  const canExtract = !!episode && content.trim().length > 0 && !extracting && !saving;

  const persistIfNeeded = async () => {
    if (!episode || !dirty) return;
    setSaving(true);
    try {
      await onSave(content);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!episode || saving || !dirty) return;
    await persistIfNeeded();
  };

  const handleExtract = async () => {
    if (!canExtract) return;
    setExtracting(true);
    try {
      await persistIfNeeded();
      if (onExtract) {
        await onExtract(content);
      }
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
          {t("Nội dung gốc")}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-10 font-bold flex items-center justify-center flex-shrink-0">
              01
            </span>
            <h2 className="text-base font-bold text-gray-900 m-0 truncate">
              {t("Nội dung gốc")}
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
              {wordCount.toLocaleString("vi-VN")} {t("từ")}
            </span>

            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer disabled:text-gray-300"
              >
                {saving ? t("Đang lưu...") : t("Lưu")}
              </button>
            )}

            <button
              type="button"
              onClick={handleExtract}
              disabled={!canExtract}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border-0 transition-colors ${
                canExtract
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm"
                  : "bg-blue-200 text-white cursor-not-allowed"
              }`}
            >
              <span className="relative inline-flex items-center">
                <HiPlus className="text-base" />
                <HiSparkles className="absolute -top-1 -right-1.5 text-10 text-yellow-200" />
              </span>
              <span>{extracting ? t("Đang trích xuất...") : t("Trích xuất")}</span>
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0 p-4 sm:p-5">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            placeholder={t("Dán nội dung tiểu thuyết, tóm tắt hoặc mô tả...")}
            className="w-full h-full min-h-xs resize-none border-0 outline-none text-sm text-gray-800 leading-relaxed placeholder-gray-400 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
