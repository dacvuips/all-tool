/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useTranslation } from "react-i18next";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { ChatBotCategoryList } from "./chat-bot-category-list";
import { ChatBotPromptRank } from "./chat-bot-prompt-rank";

// ── Tab index mapping ────────────────────────────────────────────────────
const TAB_NAMES = ["script", "batch", "prompt-rank"] as const;

// ── Main Right Panel ─────────────────────────────────────────────────────
export const AffiliateVideoRightPanel = () => {
  const { t } = useTranslation();
  const { trendingScriptData, scriptTab, setScriptTab, batchRunning } = useAffiliateVideoContext();

  const tabIndex =
    TAB_NAMES.indexOf(scriptTab as any) >= 0 ? TAB_NAMES.indexOf(scriptTab as any) : 0;

  // Label tab Batch List kèm số lượng scene
  const sceneCount = trendingScriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
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
        <TabGroup.Tab label={t("Danh sách ChatBot")}>
          <ChatBotCategoryList />
        </TabGroup.Tab>

        <TabGroup.Tab label={t("Bảng xếp hạng prompt")}>
          <ChatBotPromptRank />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
