/**
 * affiliate-submit.tsx
 * Nút submit "Tạo Ảnh & Phim" – gradient pink-rose, light theme
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import { RiFilmFill, RiLoader4Line, RiStopLine } from "react-icons/ri";
import { Button } from "../../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../../providers/affiliate-video-provider";

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
        id="create-video-btn"
        disabled={batchRunning}
        className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer transition-all border-0 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md hover:shadow-lg"
      >
        {batchRunning ? (
          <>
            <RiLoader4Line className="text-base animate-spin" />
            {t("Đang tạo...")}
          </>
        ) : (
          <>
            <RiFilmFill className="text-base" />
            {t("Tạo Ảnh & Phim")} 🎬
          </>
        )}
      </Button>
    </div>
  );
};
