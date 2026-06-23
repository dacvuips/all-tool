/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiFilmFill, RiGridLine } from "react-icons/ri";
import { Form } from "../../../../shared/utilities/form";
import { TAB_TYPE } from "../../constants";
import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";
import { useAffiliateSidebarIntro } from "../../shared/use-affiliate-sidebar-intro";
import { AffiliateSidebarGuideButton } from "../../shared/affiliate-sidebar-guide-button";

import {
  TrainingGuidePopover,
  TrainingTopicSlug,
} from "../../../../shared/common/training-guide-popover";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const TextToVideoTab = ({ onClose, type }: { onClose?: () => void; type: TAB_TYPE }) => {
  const { t } = useTranslation();
  const { handleSubmit, defaultVideoConfig, videoConfig, storyModeType } =
    useAffiliateVideoContext();
  const introKey =
    type === TAB_TYPE.single ? IntroGuideKey.SINGLE_SIDEBAR : IntroGuideKey.BATCH_SIDEBAR;
  const { introOpen, openIntro, handleIntroDismiss } = useAffiliateSidebarIntro(introKey);

  /** Wrap handleSubmit: nếu single mode thì xoá batchSize để AI tự quyết định số scene */
  const wrappedSubmit = (data: any, promptText?: string) => {
    // Merge objectToPersonifyCode from provider state – react-hook-form doesn't track this field
    const mergedData = {
      ...data,
      batchSize: videoConfig?.batchSize ?? 8,
      storyModeType,
      objectToPersonifyCode: videoConfig?.objectToPersonifyCode,
      artStyleId: videoConfig?.artStyleId,
      productImages: videoConfig?.productImages,
      objectToPersonifyImage: videoConfig?.objectToPersonifyImage,
    };
    if (type === TAB_TYPE.single) {
      const { batchSize, ...rest } = mergedData;
      return handleSubmit?.(rest, promptText);
    }
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
            {type === TAB_TYPE.single ? (
              <RiFilmFill className="text-white text-base" />
            ) : (
              <RiGridLine className="text-white text-base" />
            )}
          </div>

          <div className="flex flex-col">
            {type === TAB_TYPE.single ? (
              <div className="flex gap-1.5 items-center">
                <span className="text-base font-bold text-gray-800">{t("Đơn Lẻ")}</span>
                <AffiliateSidebarGuideButton id="single-guide-btn" onClick={openIntro} />
                <TrainingGuidePopover topicSlug={TrainingTopicSlug.SINGLE_PROMPT} />
              </div>
            ) : (
              <div className="flex gap-1.5 items-center">
                <span className="text-base font-bold text-gray-800">{t("Kịch Bản")}</span>
                <AffiliateSidebarGuideButton id="batch-guide-btn" onClick={openIntro} />
                <TrainingGuidePopover topicSlug={TrainingTopicSlug.BATCH_PROMPT} />
              </div>
            )}
            {type === TAB_TYPE.single ? (
              <span className="text-xs text-gray-500">
                {t("AI tư tạo phân cảnh theo kịch bản  ")}
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                {t("Tạo phân cảnh theo kịch bản tùy chỉnh ")}
              </span>
            )}
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
        <AffiliateConfig
          type={type}
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
