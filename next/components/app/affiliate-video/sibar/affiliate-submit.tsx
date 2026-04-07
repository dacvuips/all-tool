/**
 * affiliate-submit.tsx
 * Nút submit "Tạo Ảnh & Phim" – gradient pink-rose, light theme
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Button } from "../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

export const AffiliateSubmit = () => {
  const { t } = useTranslation();
  const { batchRunning, stopRef } = useAffiliateVideoContext();

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-white border-t border-gray-100">
      {/* Stop button when running */}

      {/* Main CTA button */}
      <Button
        submit
        className="w-full"
        id="create-video-btn"
        disabled={batchRunning}
        primary
        text={batchRunning ? t("Đang tạo...") : t("Tạo Cảnh")}
        isLoading={batchRunning}
        icon={<GenerateAiIcon />}
      />
    </div>
  );
};
