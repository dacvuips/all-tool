/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useTranslation } from "react-i18next";
import { useQueryParams } from "../../../../../lib/hooks/useQueryParams";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import {
  CopyVideoScene,
  ELEMENT_SCRIPT_TAB_QUERY_KEY,
  ElementAnalysisData,
  ElementScriptTabEnum,
} from "../../constants";
import {
  ELEMENT_SCRIPT_TAB_ENUM,
  getScenesForTab,
  sceneListKeyForTab,
} from "../../shared/script-tab-scenes";
import { useElementContext } from "../providers/element-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./element/batch-list";
import { ImagesToVideoListPanel } from "./images-to-video/images-to-video-list";
import { VideoToVideoListPanel } from "./video-to-video/video-to-video-list";

/** Tab JSX order: 0 = Thành phần, 1 = Images to video, 2 = Video to video */
const scriptTabToIndex = (tab: ElementScriptTabEnum | undefined): number => {
  if (tab === ElementScriptTabEnum.imagesToVideo) return 1;
  if (tab === ElementScriptTabEnum.videoToVideo) return 2;
  return 0;
};
const indexToScriptTab = (index: number): ElementScriptTabEnum => {
  if (index === 1) return ElementScriptTabEnum.imagesToVideo;
  if (index === 2) return ElementScriptTabEnum.videoToVideo;
  return ElementScriptTabEnum.batch;
};

const parseScriptTabParam = (value: string | undefined): ElementScriptTabEnum | undefined => {
  if (value && Object.values(ElementScriptTabEnum).includes(value as ElementScriptTabEnum)) {
    return value as ElementScriptTabEnum;
  }
  return undefined;
};

function normalizeElementScene(s: CopyVideoScene, i: number): CopyVideoScene {
  return {
    ...s,
    id: s.id || `scene-${i}`,
    sceneNumber: i + 1,
    disabled: s.disabled ?? false,
    voiceDisable: s.voiceDisable ?? false,
  };
}

function elementScenesForTab(
  scriptData: ElementAnalysisData | null | undefined,
  tab: ElementScriptTabEnum
): CopyVideoScene[] {
  return getScenesForTab<CopyVideoScene>(scriptData, tab, ELEMENT_SCRIPT_TAB_ENUM).map(
    normalizeElementScene
  );
}

// ── Main Right Panel ─────────────────────────────────────────────────────
export const ElementRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, setScriptTab, batchRunning } = useElementContext();
  const { customer } = useAuth();
  const [queryParams, setQueryParams] = useQueryParams({
    [ELEMENT_SCRIPT_TAB_QUERY_KEY]: "",
  });
  const tabIndex = scriptTabToIndex(
    parseScriptTabParam(queryParams[ELEMENT_SCRIPT_TAB_QUERY_KEY] as string | undefined)
  );

  const batchSceneCount = getScenesForTab(scriptData, ElementScriptTabEnum.batch, ELEMENT_SCRIPT_TAB_ENUM)
    .length;
  const imagesToVideoSceneCount = getScenesForTab(
    scriptData,
    ElementScriptTabEnum.imagesToVideo,
    ELEMENT_SCRIPT_TAB_ENUM
  ).length;
  const videoToVideoSceneCount = getScenesForTab(
    scriptData,
    ElementScriptTabEnum.videoToVideo,
    ELEMENT_SCRIPT_TAB_ENUM
  ).length;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={(i) => {
          const tab = indexToScriptTab(i);
          setQueryParams({ [ELEMENT_SCRIPT_TAB_QUERY_KEY]: tab });
          setScriptTab?.(tab);
        }}
        name="element-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab
          label={`${t("Thành Phần")}${batchSceneCount > 0 ? ` (${batchSceneCount})` : ""}`}
        >
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={elementScenesForTab(scriptData, ElementScriptTabEnum.batch)}
              characters={[]}
              sceneListKey={sceneListKeyForTab(ElementScriptTabEnum.batch, ELEMENT_SCRIPT_TAB_ENUM)}
            />
          )}
        </TabGroup.Tab>
        <TabGroup.Tab
          label={`${t("Images To Video")}${imagesToVideoSceneCount > 0 ? ` (${imagesToVideoSceneCount})` : ""}`}
        >
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <ImagesToVideoListPanel
              scenes={elementScenesForTab(scriptData, ElementScriptTabEnum.imagesToVideo)}
              characters={[]}
              sceneListKey={sceneListKeyForTab(
                ElementScriptTabEnum.imagesToVideo,
                ELEMENT_SCRIPT_TAB_ENUM
              )}
            />
          )}
        </TabGroup.Tab>
        <TabGroup.Tab
          label={`${t("Video To Video")}${videoToVideoSceneCount > 0 ? ` (${videoToVideoSceneCount})` : ""}`}
        >
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <VideoToVideoListPanel
              scenes={elementScenesForTab(scriptData, ElementScriptTabEnum.videoToVideo)}
              characters={[]}
              sceneListKey={sceneListKeyForTab(
                ElementScriptTabEnum.videoToVideo,
                ELEMENT_SCRIPT_TAB_ENUM
              )}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
