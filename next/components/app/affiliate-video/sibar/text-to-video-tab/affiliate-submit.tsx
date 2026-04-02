import { useTranslation } from "react-i18next";
import { Button } from "../../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../../providers/affiliate-video-provider";

export const AffiliateSubmit = () => {
  const { t } = useTranslation();
  const { doneCount, totalCount, setShowAiModal, setPromptItems, batchRunning, stopRef } =
    useAffiliateVideoContext();

  return (
    <div
      className="flex-shrink-0 border-t border-white border-opacity-8 p-3 space-y-2"
      style={{ borderColor: "rgba(255,255,255,0.07)", background: "#09091a" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-12 text-blue-300 font-medium">
            {doneCount > 0
              ? `${doneCount}/${totalCount} videos done`
              : totalCount > 0
              ? `${totalCount} prompts ready`
              : "0 prompts"}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            onClick={() => setShowAiModal(true)}
            text={t("Thêm prompt")}
            className="w-7 h-7 rounded-lg bg-white bg-opacity-5 hover:bg-opacity-10 text-blue-400 text-16 font-bold border-0 cursor-pointer flex items-center justify-center transition-all"
          />
          {totalCount > 0 && (
            <Button
              onClick={() => setPromptItems([])}
              text={t("Xóa tất cả")}
              className="w-7 h-7 rounded-lg bg-white bg-opacity-5 hover:bg-red-900 hover:bg-opacity-40 text-blue-400 hover:text-red-400 text-12 border-0 cursor-pointer flex items-center justify-center transition-all"
            />
          )}
        </div>
      </div>

      {batchRunning && (
        <Button
          onClick={() => {
            stopRef.current = true;
          }}
          className="w-full py-2 rounded-xl bg-red-800 bg-opacity-50 hover:bg-opacity-70 text-red-300 font-bold text-13 border border-red-500 border-opacity-30 cursor-pointer transition-all"
          text="⏹ Dừng"
        />
      )}

      <Button
        // onClick={generateAllVideos}
        disabled={batchRunning || totalCount === 0}
        className="w-full py-3 rounded-xl font-bold text-14 border-0 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background:
            batchRunning || totalCount === 0
              ? "rgba(99,102,241,0.3)"
              : "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
          color: "white",
        }}
      >
        {batchRunning ? (
          <>
            <span className="animate-spin">⚙️</span> Đang tạo video...
          </>
        ) : totalCount > 0 ? (
          `▶ GENERATE ${totalCount} VIDEO`
        ) : (
          "▶ GENERATE NOW"
        )}
      </Button>
    </div>
  );
};
