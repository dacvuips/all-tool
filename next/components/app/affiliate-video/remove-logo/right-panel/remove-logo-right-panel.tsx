/**
 * Right panel — lịch sử kết quả xóa logo
 */
import { useTranslation } from "react-i18next";
import {
  RiDeleteBinLine,
  RiHistoryLine,
  RiImage2Line,
  RiLoader4Line,
  RiMagicLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { useRemoveLogoContext } from "../providers/remove-logo-provider";
import { ImageResultCard } from "./image-result-card";
import { VideoResultCard } from "./video-result-card";

export function RemoveLogoRightPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { history, clearHistory, removeHistoryItem, historyLoaded, running, uploads } =
    useRemoveLogoContext();

  const processingCount = uploads.filter((u) => u.status === "processing").length;

  const handleClearAll = async () => {
    if (!history.length) return;
    const ok = window.confirm(t("Xóa toàn bộ lịch sử ảnh/video đã clear trong trình duyệt?"));
    if (!ok) return;
    await clearHistory();
    toast.success(t("Đã xóa toàn bộ lịch sử"));
  };

  return (
    <div className="flex overflow-hidden flex-col flex-1 h-full bg-amber-50/40">
      <div className="flex flex-shrink-0 gap-2 justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex gap-2 items-center min-w-0">
          <div className="flex justify-center items-center w-8 h-8 text-white rounded-full bg-primary">
            <RiHistoryLine className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">{t("Kết quả & Lịch sử")}</h2>
            <p className="text-xs text-slate-500">
              {history.length
                ? t("{{count}} mục đã lưu (IndexedDB)", { count: history.length })
                : t("So sánh Before/After sau khi xóa logo")}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!history.length}
          onClick={handleClearAll}
          className="flex gap-1.5 items-center px-3 py-1.5 text-xs font-semibold text-danger bg-red-50 rounded-lg border border-red-100 disabled:opacity-40 hover:bg-red-100 transition-colors"
        >
          <RiDeleteBinLine className="text-danger" />
          {t("Xóa toàn bộ lịch sử")}
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 v-scrollbar">
        {(running || processingCount > 0) && (
          <div className="flex gap-2 items-center px-3 py-2 mb-4 text-sm rounded-xl border text-primary bg-primary-light border-primary">
            <RiLoader4Line className="text-lg animate-spin text-primary" />
            {t("Đang xóa logo cho {{count}} file...", {
              count: processingCount || uploads.length,
            })}
          </div>
        )}

        {!historyLoaded ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <RiLoader4Line className="mr-2 text-xl animate-spin" />
            {t("Đang tải lịch sử...")}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-6 py-20 text-center">
            <div className="flex justify-center items-center mb-4 w-16 h-16 text-white rounded-2xl border border-gray-200 shadow-sm bg-primary">
              <RiMagicLine className="text-3xl text-white" />
            </div>
            <p className="text-base font-semibold text-slate-700">{t("Chưa có kết quả")}</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {t(
                "Upload ảnh hoặc video bên trái rồi bấm Xóa Logo AI. Kết quả so sánh Before/After sẽ hiện tại đây và tự lưu trên máy bạn."
              )}
            </p>
            <div className="flex gap-2 items-center mt-4 text-xs text-gray-400">
              <RiImage2Line className="text-primary" />
              {t("Ảnh: So sánh kéo · Video: Trước / Sau")}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {history.map((item) => (
              <div key={item.id} className="w-full" style={{ maxWidth: 370 }}>
                {item.kind === "video" ? (
                  <VideoResultCard item={item} onRemove={removeHistoryItem} />
                ) : (
                  <ImageResultCard item={item} onRemove={removeHistoryItem} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
