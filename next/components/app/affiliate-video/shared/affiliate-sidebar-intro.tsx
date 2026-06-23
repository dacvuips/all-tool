import { useTranslation } from "react-i18next";
import { IntroStep } from "../../../shared/utilities/intro/components/IntroSteps";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";
import { AffiliateSidebarIntroStep } from "./affiliate-sidebar-intro-steps";

interface AffiliateSidebarIntroProps {
  isOpen: boolean;
  steps: AffiliateSidebarIntroStep[];
  onDismiss: () => void;
}

/** Tour intro.js — chỉ sidebar trái (form cấu hình) */
export function AffiliateSidebarIntro({ isOpen, steps, onDismiss }: AffiliateSidebarIntroProps) {
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
