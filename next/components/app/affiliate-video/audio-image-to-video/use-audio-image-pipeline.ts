import { useMemo, useRef } from "react";
import { useToast } from "../../../../lib/providers/toast-provider";
import { useWorkflowSteps, type WorkflowStepsState } from "../../../shared/workflow-steps";
import type { ScriptData } from "../constants";
import {
  analyzeAudioImageToVideo,
  type AudioImageGenerateTextBody,
  type GenerateTextJobResult,
} from "./analyze-audio-image";
import type { AudioImageToVideoFormState } from "./audio-image-types";

export type AudioImagePipelineStepId = "analyze" | "generate" | "export";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gọi generate-text thẳng Flow2 (direct), không qua media job. */
async function runGenerateTextDirect(
  body: AudioImageGenerateTextBody
): Promise<GenerateTextJobResult> {
  const res = await fetch("/api/app/generate-text/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      direct: true,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || `Lỗi phân tích (${res.status})`);
  }
  return { data: payload?.data };
}

export function useAudioImagePipeline({
  getForm,
  onAnalyzed,
}: {
  getForm: () => AudioImageToVideoFormState;
  onAnalyzed: (script: ScriptData) => void;
}): WorkflowStepsState<AudioImagePipelineStepId> {
  const toast = useToast();
  const getFormRef = useRef(getForm);
  getFormRef.current = getForm;
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;

  const stepDefs = useMemo(
    () => [
      {
        id: "analyze" as const,
        label: "Phân tích",
        run: async () => {
          try {
            const script = await analyzeAudioImageToVideo(
              getFormRef.current(),
              runGenerateTextDirect,
              {
                onChunkProgress: ({ chunkIndex, chunkCount }) => {
                  if (chunkCount > 1) {
                    toast.info(
                      `Đã gửi phân tích đoạn ${chunkIndex + 1}/${chunkCount} (song song, cách 5s)...`
                    );
                  }
                },
                onChunkDone: ({ chunkIndex, chunkCount, sceneCount }) => {
                  if (chunkCount > 1) {
                    toast.success(
                      `Xong đoạn ${chunkIndex + 1}/${chunkCount} (${sceneCount} cảnh)`
                    );
                  }
                },
              }
            );
            onAnalyzedRef.current(script);
          } catch (err: any) {
            toast.error(err?.message || "Phân tích thất bại");
            throw err;
          }
        },
      },
      {
        id: "generate" as const,
        label: "Generate",
        run: async () => {
          await wait(1200);
        },
      },
      {
        id: "export" as const,
        label: "Xuất video",
        run: async () => {
          await wait(1200);
        },
      },
    ],
    []
  );

  return useWorkflowSteps({
    steps: stepDefs,
    storageKey: "audio-image-to-video:autoAdvance:v2",
    defaultAutoAdvance: false,
  });
}
