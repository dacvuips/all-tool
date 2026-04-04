/**
 * affiliate-submit.tsx
 * Nút submit "Tạo Ảnh & Phim" – gradient pink-rose, light theme
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import { RiStopLine } from "react-icons/ri";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Button } from "../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

export const AffiliateSubmit = () => {
  const { t } = useTranslation();
  const { batchRunning, stopRef } = useAffiliateVideoContext();

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-white border-t border-gray-100">
      {/* Stop button when running */}
      {batchRunning && (
        <Button
          onClick={() => {
            if (stopRef) stopRef.current = true;
          }}
          className="w-full mb-2 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <RiStopLine className="text-base" />
          {t("Dừng lại")}
        </Button>
      )}

      {/* Main CTA button */}
      <Button
        submit
        className="w-full"
        id="create-video-btn"
        disabled={batchRunning}
        primary
        text={batchRunning ? t("Đang tạo...") : t("Tạo Ảnh & Phim")}
        isLoading={batchRunning}
        icon={<GenerateAiIcon />}
      />
    </div>
  );
};
