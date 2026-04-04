/**
 * text-to-video-tab.tsx
 * Sidebar layout: Config form + Submit button, light theme
 */
import { useTranslation } from "react-i18next";
import { RiCameraLensFill, RiMagicFill } from "react-icons/ri";
import { Form } from "../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";
import { Tip } from "./tip";

export const TextToVideoTab = () => {
  const { t } = useTranslation();
  const { handleSubmit, defaultVideoConfig } = useAffiliateVideoContext();
  return (
    <div className="flex flex-col h-full ">
      <div>
        {/* ── Header: Tạo Nhân Vật ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <RiCameraLensFill className="text-white text-base" />
            </div>
            <span className="text-base font-bold text-gray-800">{t("Tạo Nhân Vật")}</span>
          </div>
          <button
            // onClick={() => setShowAiModal && setShowAiModal(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors cursor-pointer border-0"
          >
            <RiMagicFill className="text-xs" />
            {t("Gợi ý")}
          </button>
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto v-scrollbar bg-white">
        {/* Scrollable config area */}{" "}
        <div className="flex-1 ">
          <Form onSubmit={handleSubmit} defaultValues={defaultVideoConfig}>
            <AffiliateConfig />

            {/* Fixed submit at bottom */}
            <AffiliateSubmit />
            <Tip />
          </Form>
        </div>
      </div>
    </div>
  );
};
