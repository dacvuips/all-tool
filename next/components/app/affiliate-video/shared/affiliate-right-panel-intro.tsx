import { useTranslation } from "react-i18next";
import { IntroStep } from "../../../shared/utilities/intro/components/IntroSteps";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";
import { AffiliateRightPanelIntroStep } from "./affiliate-right-panel-intro-steps";

interface AffiliateRightPanelIntroProps {
  isOpen: boolean;
  steps: AffiliateRightPanelIntroStep[];
  onDismiss: () => void;
}

/** Tour intro.js — chỉ right panel (batch list / danh sách hàng loạt) */
export function AffiliateRightPanelIntro({ isOpen, steps, onDismiss }: AffiliateRightPanelIntroProps) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();

  if (!introEnabled) return null;

  return (
    <IntroStep
      isOpen={isOpen}
      showProgress
      hidePrev={false}
      hideNext={false}
      nextLabel={t("Tiếp")}
      prevLabel={t("Trở lại")}
      doneLabel={t("Hoàn thành")}
      steps={steps}
      onClose={onDismiss}
      onComplete={onDismiss}
    />
  );
}
