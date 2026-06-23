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
import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";
import { AffiliateIntroGuideButton } from "../../shared/affiliate-intro-guide-button";
import { useAffiliateSidebarIntro } from "../../shared/use-affiliate-sidebar-intro";
import { CopyVideoFormConfig } from "../../constants";
import { extractAndSaveThumbnails, useThumbnailDB } from "../../hook/useVideoThumbnail";

import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  TrainingGuidePopover,
  TrainingTopicSlug,
} from "../../../../shared/common/training-guide-popover";
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
    notifySceneThumbnailsSaved,
  } = useCopyVideoContext();
  const { analyzeVideoForCopy } = useCopyVideoApi();
  const thumbnailDB = useThumbnailDB();
  const { introOpen, openIntro, handleIntroDismiss } = useAffiliateSidebarIntro(
    IntroGuideKey.COPY_VIDEO_SIDEBAR
  );

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

          // Extract & save thumbnails to IndexedDB, then refresh scene cards
          if (copyVideoFormConfig?.sourceVideo?.base64 && result.scenes?.length) {
            extractAndSaveThumbnails(
              copyVideoFormConfig.sourceVideo.base64,
              copyVideoFormConfig.sourceVideo.mimeType,
              result.scenes,
              thumbnailDB
            )
              .then(() => notifySceneThumbnailsSaved?.())
              .catch((err) => console.warn("[CopyVideoForm] Failed to extract thumbnails:", err));
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
      notifySceneThumbnailsSaved,
    ]
  );

  return (
    <Form
      onSubmit={handleSubmit}
      defaultValues={copyVideoFormConfig}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex justify-center items-center w-8 h-8 bg-red-500 rounded-full">
            <RiFileCopy2Line className="text-base text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex gap-1.5 items-center">
              <span className="text-base font-bold text-gray-800">{t("Sao chép video")}</span>
              <AffiliateIntroGuideButton id="copy-video-guide-btn" onClick={openIntro} />
              <TrainingGuidePopover topicSlug={TrainingTopicSlug.COPY_PROMPT} />
            </div>
            <span className="text-xs text-gray-500">{t("Tạo phân cảnh theo video gốc ")}</span>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer md:hidden hover:bg-gray-200"
            >
              <RiCloseLine className="text-lg text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* ── Vùng cấu hình (cuộn được) ── */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white v-scrollbar">
        <AffiliateConfig
          introOpen={introOpen}
          onIntroDismiss={handleIntroDismiss}
        />
      </div>

      {/* ── Footer: Submit + Tip (cố định) ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <AffiliateSubmit />
        {/* <Tip /> */}
      </div>
    </Form>
  );
};
