/**
 * affiliate-submit.tsx
 * Nút submit "Tạo Ảnh & Phim" – gradient pink-rose, light theme
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { GenerateAiIcon } from "../../../../../public/assets/svg/generate-ai";
import { Button } from "../../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

export const AffiliateSubmit = () => {
  const { t } = useTranslation();
  const { batchRunning, videoConfig, storyboardProgress } = useAffiliateVideoContext();
  const { customer } = useAuth();

  const submitLabel = batchRunning
    ? storyboardProgress
      ? t("Đang tạo cảnh ({{current}}/{{total}})", {
          current: storyboardProgress.current,
          total: storyboardProgress.total,
        })
      : t("Đang tạo cảnh...")
    : t("Tạo Cảnh");

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-white border-t border-gray-100">
      <div className="flex  gap-2 items-center justify-between">
        <Button
          submit
          className="w-full"
          id="create-video-btn"
          disabled={
            batchRunning ||
            !customer ||
            !videoConfig?.storyboardImage?.some((img) => img?.imageBytes)
          }
          primary
          text={submitLabel}
          isLoading={batchRunning}
          icon={<GenerateAiIcon />}
        />
      </div>
    </div>
  );
};
