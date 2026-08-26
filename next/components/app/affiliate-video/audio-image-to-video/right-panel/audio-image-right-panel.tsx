import { useTranslation } from "react-i18next";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { WorkflowStepsBar, type WorkflowStepsState } from "../../../../shared/workflow-steps";
import { CACHE_KEY, StoryModeTypeEnum } from "../../constants";
import { useAffiliateVideoContext } from "../../storyboard/providers/affiliate-video-provider";
import { AiGeneratingSpinner } from "../../storyboard/right-panel/ai-generating-spinner";
import type { AudioImagePipelineStepId } from "../use-audio-image-pipeline";
import { BatchListPanel } from "./batch-list";

export const AudioImageRightPanel = ({
  pipeline,
  scriptCacheKey = CACHE_KEY.lastAudioImageScript,
}: {
  pipeline: WorkflowStepsState<AudioImagePipelineStepId>;
  scriptCacheKey?: string;
}) => {
  const { t } = useTranslation();
  const { scriptData, batchRunning } = useAffiliateVideoContext();
  const sceneCount = scriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;
  const storyModeType = scriptData?.storyModeType ?? StoryModeTypeEnum.image_to_video;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <WorkflowStepsBar
        steps={pipeline.steps}
        isRunning={pipeline.isRunning}
        isDone={pipeline.isDone}
        canContinue={pipeline.canContinue}
        autoAdvance={pipeline.autoAdvance}
        onAutoAdvanceChange={pipeline.setAutoAdvance}
        onContinue={pipeline.runNext}
        onRerunFrom={(stepId) => {
          void pipeline.rerunFrom(stepId as AudioImagePipelineStepId);
        }}
      />
      <TabGroup
        index={0}
        onChange={() => {}}
        name="audio-image-to-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        <TabGroup.Tab label={batchTabLabel}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={(scriptData?.scenes || []).map((s, i) => ({
                id: s.id || `scene-${i}`,
                sceneNumber: s.sceneNumber,
                camera: s.camera || "WIDE SHOT",
                imageGenPrompt: s.imageGenPrompt || "",
                motionPrompt: s.motionPrompt || "",
                dialogue: s.dialogue || "",
                visualPrompt: s.visualPrompt || "",
                disabled: s.disabled ?? false,
                voiceDisable: s.voiceDisable ?? false,
                audio: s.audio || "",
                noText: s.noText ?? false,
                product_image_prompt: s.product_image_prompt ?? "",
                selectedProductImages: s.selectedProductImages ?? [],
                cropRegion: s.cropRegion,
                storyboardCropImage: s.storyboardCropImage,
              }))}
              storyModeType={storyModeType}
              scriptCacheKey={scriptCacheKey}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
