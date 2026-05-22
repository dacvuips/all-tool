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

type ElementScriptTab = "images-to-video" | "video-to-video" | "batch";

/** Tab JSX order: 0 = Thành phần, 1 = Images to video, 2 = Video to video */
const scriptTabToIndex = (tab: ElementScriptTab | undefined): number => {
  if (tab === "images-to-video") return 1;
  if (tab === "video-to-video") return 2;
  return 0;
};
const indexToScriptTab = (index: number): ElementScriptTab => {
  if (index === 1) return "images-to-video";
  if (index === 2) return "video-to-video";
  return "batch";
};

// ── Main Right Panel ─────────────────────────────────────────────────────
export const ElementRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, scriptTab, setScriptTab, batchRunning } = useElementContext();
  const { customer } = useAuth();
  const tabIndex = scriptTabToIndex(scriptTab);

  // Label tab Batch List kèm số lượng scene
  const sceneCount = scriptData?.scenes?.length ?? 0;

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
        <TabGroup.Tab label={`${t("Thành Phần")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`}>
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
        <TabGroup.Tab label={t("Images To Video")}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <>{"Đang phát triển , các sếp bình tỉnh nhé"}</>
          )}
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Video To Video")}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <>{"Đang phát triển , các sếp bình tỉnh nhé"} </>
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
