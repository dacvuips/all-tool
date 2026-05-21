/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { useElementContext } from "../providers/element-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./batch-list";

/** Tab JSX order: 0 = Danh sách hàng loạt, 1 = Kịch Bản (must match onChange mapping below) */
const scriptTabToIndex = (tab: "script" | "batch" | undefined): number => {
  if (tab === "script") return 1;
  return 0; // "batch" or unknown → batch list tab
};
const indexToScriptTab = (index: number): "script" | "batch" => (index === 1 ? "script" : "batch");

// ── Main Right Panel ─────────────────────────────────────────────────────
export const ElementRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, scriptTab, setScriptTab, batchRunning } = useElementContext();
  const { customer } = useAuth();
  const tabIndex = scriptTabToIndex(scriptTab);

  // Label tab Batch List kèm số lượng scene
  const sceneCount = scriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={(i) => setScriptTab?.(indexToScriptTab(i))}
        name="element-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab label={batchTabLabel}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={(scriptData?.scenes || []).map((s, i) => ({
                ...s,
                id: s.id || `scene-${i}`,
                sceneNumber: i + 1,
                disabled: s.disabled ?? false,
                voiceDisable: s.voiceDisable ?? false,
              }))}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
