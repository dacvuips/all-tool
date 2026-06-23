import { useTranslation } from "react-i18next";
import { IntroStep } from "../../../shared/utilities/intro/components/IntroSteps";
import { AffiliateIntroStep as IntroStepDef } from "./affiliate-intro-steps";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

interface AffiliateIntroStepProps {
  isOpen: boolean;
  steps: IntroStepDef[];
  onDismiss: () => void;
}

/** Wrapper IntroStep với nhãn i18n chuẩn cho affiliate-video */
export function AffiliateIntroStep({ isOpen, steps, onDismiss }: AffiliateIntroStepProps) {
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
