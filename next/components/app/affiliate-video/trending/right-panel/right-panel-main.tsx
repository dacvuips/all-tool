/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBinLine } from "react-icons/ri";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./batch-list";
import { TrendingCategoryList } from "./trending-category-list";
import { TrendingPromptRank } from "./trending-prompt-rank";

// ── Tab index mapping ────────────────────────────────────────────────────
const TAB_NAMES = ["script", "batch", "prompt-rank"] as const;

// ── Main Right Panel ─────────────────────────────────────────────────────
export const AffiliateVideoRightPanel = () => {
  const { t } = useTranslation();
  const {
    trendingScriptData,
    scriptTab,
    setScriptTab,
    batchRunning,
    sceneHistory,
    clearSceneHistory,
  } = useAffiliateVideoContext();

  const [confirmClear, setConfirmClear] = useState(false);
  const tabIndex =
    TAB_NAMES.indexOf(scriptTab as any) >= 0 ? TAB_NAMES.indexOf(scriptTab as any) : 0;

  // Label tab Batch List kèm số lượng scene
  const sceneCount = trendingScriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;

  const renderHistoryActions = () => (
    <>
      <span className="text-[10px] text-gray-400 whitespace-nowrap mr-1">
        {sceneHistory.length} {t("bản")}
      </span>
      {!confirmClear ? (
        <button
          onClick={() => setConfirmClear(true)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={t("Xóa lịch sử")}
        >
          <RiDeleteBinLine className="text-sm" />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              if (clearSceneHistory) await clearSceneHistory();
              setConfirmClear(false);
            }}
            className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md cursor-pointer border-0 transition-colors"
          >
            {t("Xóa hết")}
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors"
          >
            {t("Hủy")}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TabGroup
        index={tabIndex}
        onChange={(i) => setScriptTab && setScriptTab(TAB_NAMES[i])}
        name="affiliate-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {/* ── Tab: Danh sách Prompt (Trending) ── */}
        <TabGroup.Tab label={t("Danh sách Prompt")}>
          <TrendingCategoryList />
        </TabGroup.Tab>
        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab label={batchTabLabel}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={(trendingScriptData?.scenes || []).map((s, i) => ({
                id: (s as any).id || `scene-${i}`,
                sceneNumber: s.sceneNumber,
                camera: (s.camera as any) || "WIDE SHOT",
                imageGenPrompt: s.imageGenPrompt || "",
                motionPrompt: s.motionPrompt || "",
                dialogue: s.dialogue || "",
                visualPrompt: s.visualPrompt || "",
                disabled: (s as any).disabled ?? false,
                voiceDisable: (s as any).voiceDisable ?? false,
                audio: s.audio || "",
                noText: (s as any).noText ?? false,
                product_image_prompt: (s as any).product_image_prompt ?? "",
                selectedProductImages: (s as any).selectedProductImages ?? [],
              }))}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Bảng xếp hạng prompt")}>
          <TrendingPromptRank />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
