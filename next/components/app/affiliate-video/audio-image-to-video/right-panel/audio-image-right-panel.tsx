import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { WorkflowStepsBar, type WorkflowStepsState } from "../../../../shared/workflow-steps";
import { CACHE_KEY, StoryModeTypeEnum, type ElementFormAudio } from "../../constants";
import { useAffiliateVideoContext } from "../../storyboard/providers/affiliate-video-provider";
import { AiGeneratingSpinner } from "../../storyboard/right-panel/ai-generating-spinner";
import type { AudioImagePipelineStepId } from "../use-audio-image-pipeline";
import { AudioImageStudioPanel } from "../studio/audio-image-studio-panel";
import { BatchListPanel } from "./batch-list";

const SCRIPT_PIPELINE_STEPS: AudioImagePipelineStepId[] = ["transcribe", "analyze"];

export const AudioImageRightPanel = ({
  pipeline,
  scriptCacheKey = CACHE_KEY.lastAudioImageScript,
  sourceAudio,
  aspectRatio,
  studioEpoch = 0,
  onStudioEpochBump,
}: {
  pipeline: WorkflowStepsState<AudioImagePipelineStepId>;
  scriptCacheKey?: string;
  /** Audio nguồn từ form — gắn track Audio trong Studio (tab Audio) */
  sourceAudio?: ElementFormAudio | null;
  aspectRatio?: string;
  /** Tăng sau phân tích / gen video để Studio seed lại */
  studioEpoch?: number;
  /** Bump epoch khi đổi lịch sử */
  onStudioEpochBump?: () => void;
}) => {
  const { t } = useTranslation();
  const { scriptData, batchRunning } = useAffiliateVideoContext();
  const [tabIndex, setTabIndex] = useState(0);
  const sceneCount = scriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;
  const storyModeType = scriptData?.storyModeType ?? StoryModeTypeEnum.image_to_video;

  const isScriptGenerating = useMemo(
    () =>
      batchRunning ||
      pipeline.steps.some(
        (step) =>
          SCRIPT_PIPELINE_STEPS.includes(step.id as AudioImagePipelineStepId) &&
          step.status === "running"
      ),
    [batchRunning, pipeline.steps]
  );

  const spinnerMessage = useMemo(() => {
    if (pipeline.steps.find((s) => s.id === "transcribe")?.status === "running") {
      return t("Đang lấy text từ nguồn...");
    }
    if (pipeline.steps.find((s) => s.id === "analyze")?.status === "running") {
      return t("Đang phân tích kịch bản AI...");
    }
    return t("Đang tạo kịch bản AI...");
  }, [pipeline.steps, t]);

  const batchScenes = useMemo(
    () =>
      (scriptData?.scenes || []).map((s, i) => ({
        id: s.id || `scene-${i}`,
        sceneNumber: s.sceneNumber,
        camera: s.camera || "WIDE SHOT",
        imageGenPrompt: s.imageGenPrompt || "",
        motionPrompt: s.motionPrompt || "",
        dialogue: s.dialogue || "",
        dialogueStartSec: s.dialogueStartSec,
        dialogueEndSec: s.dialogueEndSec,
        visualPrompt: s.visualPrompt || "",
        disabled: s.disabled ?? false,
        voiceDisable: s.voiceDisable ?? false,
        videoVoice: s.videoVoice || "",
        audio: s.audio || "",
        noText: s.noText ?? false,
        product_image_prompt: s.product_image_prompt ?? "",
        selectedProductImages: s.selectedProductImages ?? [],
        cropRegion: s.cropRegion,
        storyboardCropImage: s.storyboardCropImage,
      })),
    [scriptData?.scenes]
  );

  return (
    <div className="flex overflow-hidden flex-col flex-1 min-h-0">
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
      {/* className của TabGroup gắn vào thanh tab — không dùng flex-col ở đây */}
      <div className="flex flex-col flex-1 min-h-0 bg-white overflow-hidden">
        <TabGroup
          index={tabIndex}
          onChange={setTabIndex}
          name="audio-image-to-video-right"
          flex={false}
          keepMounted="visited"
          tabClassName="px-4 py-3"
          titleClassName="text-sm font-semibold whitespace-nowrap"
          bodyClassName={
            tabIndex === 1
              ? "flex flex-1 flex-col overflow-hidden min-h-0"
              : "flex-1 overflow-y-auto v-scrollbar min-h-0"
          }
          className="bg-white"
        >
          <TabGroup.Tab label={batchTabLabel}>
            {isScriptGenerating ? (
              <AiGeneratingSpinner message={spinnerMessage} />
            ) : (
              <BatchListPanel
                scenes={batchScenes}
                storyModeType={storyModeType}
                scriptCacheKey={scriptCacheKey}
                characters={[]}
                onHistorySelect={() => onStudioEpochBump?.()}
              />
            )}
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Studio")}>
            <AudioImageStudioPanel
              scenes={scriptData?.scenes || []}
              sourceAudio={sourceAudio}
              aspectRatio={aspectRatio || scriptData?.aspectRatio}
              studioEpoch={studioEpoch}
            />
          </TabGroup.Tab>
        </TabGroup>
      </div>
    </div>
  );
};
