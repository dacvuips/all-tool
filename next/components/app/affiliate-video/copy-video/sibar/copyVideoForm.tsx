/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiFileCopy2Line } from "react-icons/ri";

import { Form } from "../../../../shared/utilities/form";
import { CopyVideoFormConfig } from "../../constants";
import { extractAndSaveThumbnails, useThumbnailDB } from "../../hook/useVideoThumbnail";

import { useToast } from "../../../../../lib/providers/toast-provider";
import { useCopyVideoApi } from "../hook/useCopyVideoApi";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const CopyVideoForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    DEFAULT_VIDEO_CONFIG,
    copyVideoFormConfig,
    setBatchRunning,
    setScriptData,
    setScriptTab,
    persistCopyVideoInput,
  } = useCopyVideoContext();
  const { analyzeVideoForCopy } = useCopyVideoApi();
  const thumbnailDB = useThumbnailDB();

  // ── Submit handler: phân tích video gốc ──
  const handleSubmit = useCallback(
    async (_formData: any) => {
      if (!copyVideoFormConfig?.sourceVideo?.base64) {
        toast.error(t("Vui lòng upload video gốc trước khi phân tích"));
        return;
      }

      try {
        setScriptTab?.("script");
        setBatchRunning?.(true);
        // Persist copyVideoInput to IndexedDB on submit
        persistCopyVideoInput?.();
        const result = await analyzeVideoForCopy(copyVideoFormConfig as CopyVideoFormConfig);
        if (result) {
          setScriptData?.(result);
          toast.success(
            t("Phân tích video thành công! Đã tạo {{count}} cảnh", {
              count: result.scenes?.length || 0,
            })
          );

          // Extract & save thumbnails to IndexedDB (fire-and-forget)
          if (copyVideoFormConfig?.sourceVideo?.base64 && result.scenes?.length) {
            extractAndSaveThumbnails(
              copyVideoFormConfig.sourceVideo.base64,
              copyVideoFormConfig.sourceVideo.mimeType,
              result.scenes,
              thumbnailDB
            ).catch((err) => console.warn("[CopyVideoForm] Failed to extract thumbnails:", err));
          }
        }
      } catch (err: any) {
        console.error("[CopyVideoForm] analyzeVideoForCopy error:", err);
        toast.error(err?.message || t("Lỗi khi phân tích video"));
      } finally {
        setBatchRunning?.(false);
      }
    },
    [
      copyVideoFormConfig,
      analyzeVideoForCopy,
      setBatchRunning,
      setScriptData,
      setScriptTab,
      toast,
      t,
      thumbnailDB,
      persistCopyVideoInput,
    ]
  );

  return (
    <Form
      onSubmit={handleSubmit}
      defaultValues={DEFAULT_VIDEO_CONFIG}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <RiFileCopy2Line className="text-white text-base" />
          </div>
          <span className="text-base font-bold text-gray-800">{t("Sao chép video")}</span>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer border-0 transition-colors"
            >
              <RiCloseLine className="text-lg text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* ── Vùng cấu hình (cuộn được) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto v-scrollbar bg-white">
        <AffiliateConfig />
      </div>

      {/* ── Footer: Submit + Tip (cố định) ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <AffiliateSubmit />
        {/* <Tip /> */}
      </div>
    </Form>
  );
};
