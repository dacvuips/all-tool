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

import { useReviewContext } from "../providers/review-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./product/batch-list";

import { ImagesToVideoListPanel } from "../../elements/right-panel/images-to-video/images-to-video-list";
import { VideoToVideoListPanel } from "../../elements/right-panel/video-to-video/video-to-video-list";
import { REVIEW_SCRIPT_TAB_QUERY_KEY, ReviewScriptTabEnum } from "../constants";

/** Tab JSX order: 0 = Thành phần, 1 = Images to video, 2 = Video to video */
const scriptTabToIndex = (tab: ReviewScriptTabEnum | undefined): number => {
  if (tab === ReviewScriptTabEnum.imagesToVideo) return 1;
  if (tab === ReviewScriptTabEnum.videoToVideo) return 2;
  return 0;
};
const indexToScriptTab = (index: number): ReviewScriptTabEnum => {
  if (index === 1) return ReviewScriptTabEnum.imagesToVideo;
  if (index === 2) return ReviewScriptTabEnum.videoToVideo;
  return ReviewScriptTabEnum.batch;
};

const parseScriptTabParam = (value: string | undefined): ReviewScriptTabEnum | undefined => {
  if (value && Object.values(ReviewScriptTabEnum).includes(value as ReviewScriptTabEnum)) {
    return value as ReviewScriptTabEnum;
  }
  return undefined;
};

// ── Main Right Panel ─────────────────────────────────────────────────────
export const ReviewRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, setScriptTab, batchRunning } = useReviewContext();
  const { customer } = useAuth();
  const [queryParams, setQueryParams] = useQueryParams({
    [REVIEW_SCRIPT_TAB_QUERY_KEY]: "",
  });
  const tabIndex = scriptTabToIndex(
    parseScriptTabParam(queryParams[REVIEW_SCRIPT_TAB_QUERY_KEY] as string | undefined)
  );

  // Label tab Batch List kèm số lượng scene
  const sceneCount = scriptData?.scenes?.length ?? 0;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={(i) => {
          const tab = indexToScriptTab(i);
          setQueryParams({ [REVIEW_SCRIPT_TAB_QUERY_KEY]: tab });
          setScriptTab?.(tab);
        }}
        name="review-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab label={`${t("Sản phẩm")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`}>
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
            <ImagesToVideoListPanel
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
        <TabGroup.Tab label={t("Video To Video")}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <VideoToVideoListPanel
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
