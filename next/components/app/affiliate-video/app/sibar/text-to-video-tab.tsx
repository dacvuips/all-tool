/**
 * text-to-video-tab.tsx (app)
 * Sidebar layout: hiển thị prompt & link App đã chọn.
 */
import { useTranslation } from "react-i18next";
import { RiApps2Line, RiCloseLine } from "react-icons/ri";
import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";
import { useAffiliateSidebarIntro } from "../../shared/use-affiliate-sidebar-intro";
import { AffiliateIntroGuideButton } from "../../shared/affiliate-intro-guide-button";

import {
  TrainingGuidePopover,
  TrainingTopicSlug,
} from "../../../../shared/common/training-guide-popover";
import { AffiliateConfig } from "./affiliate-config";

export const AppSidebarTab = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const { introOpen, openIntro, handleIntroDismiss } = useAffiliateSidebarIntro(
    IntroGuideKey.APP_SIDEBAR
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex justify-center items-center w-8 h-8 bg-green-500 rounded-full">
            <RiApps2Line className="text-base text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex gap-1.5 items-center">
              <span className="text-base font-bold text-gray-800">{t("App Prompt & Link")}</span>
              <AffiliateIntroGuideButton id="app-guide-btn" onClick={openIntro} />
              <TrainingGuidePopover topicSlug={TrainingTopicSlug.APP_PROMPT} />
            </div>
            <span className="text-xs text-gray-500">
              {t("Cung cấp prompt tạo app hoặc link app trực tiếp ")}
            </span>
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

      <div className="overflow-hidden flex-1 min-h-0">
        <AffiliateConfig introOpen={introOpen} onIntroDismiss={handleIntroDismiss} />
      </div>
    </div>
  );
};
