import { useTranslation } from "react-i18next";
import { RiQuestionLine } from "react-icons/ri";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

interface AffiliateIntroGuideButtonProps {
  onClick: () => void;
  id?: string;
}

/** Nút ? mở hướng dẫn intro bên cạnh tiêu đề sidebar / batch list */
export function AffiliateIntroGuideButton({ onClick, id }: AffiliateIntroGuideButtonProps) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();

  if (!introEnabled) return null;

  return (
    <button
      type="button"
      id={id}
      title={t("Hướng dẫn sử dụng")}
      aria-label={t("Hướng dẫn sử dụng")}
      onClick={onClick}
      className="hidden md:flex justify-center items-center w-6 h-6 rounded-full border-0 bg-blue-100 text-blue-600 cursor-pointer transition-colors hover:bg-blue-200"
    >
      <RiQuestionLine className="text-sm" />
    </button>
  );
}
