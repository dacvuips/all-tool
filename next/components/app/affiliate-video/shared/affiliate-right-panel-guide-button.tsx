import { useTranslation } from "react-i18next";
import { RiQuestionLine } from "react-icons/ri";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

interface AffiliateRightPanelGuideButtonProps {
  onClick: () => void;
  id?: string;
}

/** Nút ? mở hướng dẫn right panel (batch list) */
export function AffiliateRightPanelGuideButton({ onClick, id }: AffiliateRightPanelGuideButtonProps) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();

  if (!introEnabled) return null;

  return (
    <button
      type="button"
      id={id}
      title={t("Hướng dẫn danh sách hàng loạt")}
      aria-label={t("Hướng dẫn danh sách hàng loạt")}
      onClick={onClick}
      className="hidden md:flex justify-center items-center w-5 h-5 rounded-full border-0 bg-blue-100 text-blue-600 cursor-pointer transition-colors hover:bg-blue-200"
    >
      <RiQuestionLine className="text-xs" />
    </button>
  );
}
