/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useTranslation } from "react-i18next";
import { RiCloseLine } from "react-icons/ri";
import { Form } from "../../../../shared/utilities/form";
import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";
import { useAffiliateSidebarIntro } from "../../shared/use-affiliate-sidebar-intro";
import { AffiliateSidebarGuideButton } from "../../shared/affiliate-sidebar-guide-button";

import { IoAppsSharp } from "react-icons/io5";
import {
  TrainingGuidePopover,
  TrainingTopicSlug,
} from "../../../../shared/common/training-guide-popover";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const TextToVideoTab = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const { handleSubmit, defaultVideoConfig, videoConfig, storyModeType } =
    useAffiliateVideoContext();
  const { introOpen, openIntro, handleIntroDismiss } = useAffiliateSidebarIntro(
    IntroGuideKey.STORYBOARD_SIDEBAR
  );

  /** Merge các field storyboard từ provider – react-hook-form không track hết */
  const wrappedSubmit = (data: any, promptText?: string) => {
    const mergedData = {
      ...data,
      storyModeType: storyModeType ?? data.storyModeType,
      storyboardImage: videoConfig?.storyboardImage,
      aspectRatio: videoConfig?.aspectRatio ?? data.aspectRatio,
      artStyle: videoConfig?.artStyle ?? data.artStyle,
      artStyleId: videoConfig?.artStyleId,
      language: videoConfig?.language ?? data.language,
      tipContent: videoConfig?.tipContent ?? data.tipContent,
      productImages: videoConfig?.productImages,
    };

    return handleSubmit?.(mergedData, promptText);
  };

  return (
    <Form
      onSubmit={wrappedSubmit}
      defaultValues={defaultVideoConfig}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <IoAppsSharp className="text-white text-base" />
          </div>
          <div className="flex flex-col">
            <div className="flex gap-1.5 items-center">
              <span className="text-base font-bold text-gray-800">
                {t("Tạo cảnh theo Storyboard")}
              </span>
              <AffiliateSidebarGuideButton id="storyboard-guide-btn" onClick={openIntro} />
              <TrainingGuidePopover topicSlug={TrainingTopicSlug.STORYBOARD} />
            </div>
            <span className="text-xs text-gray-500">{t("Tạo phân cảnh từ ảnh storyboard")}</span>
          </div>
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
        <AffiliateConfig introOpen={introOpen} onIntroDismiss={handleIntroDismiss} />
      </div>

      {/* ── Footer: Submit + Tip (cố định) ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <AffiliateSubmit />
        {/* <Tip /> */}
      </div>
    </Form>
  );
};
