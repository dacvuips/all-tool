import { useEffect, useMemo, useRef } from "react";
import { useToast } from "../../../../lib/providers/toast-provider";
import { useWorkflowSteps, type WorkflowStepsState } from "../../../shared/workflow-steps";
import type { ScriptData } from "../constants";
import {
  analyzeSourceTextToScenes,
  transcribeSourceText,
} from "./analyze-audio-image";
import type { AudioImageToVideoFormState } from "./audio-image-types";
import { getAudioImageBatchActions } from "./audio-image-batch-bridge";

export type AudioImagePipelineStepId =
  | "transcribe"
  | "analyze"
  | "generateImage"
  | "generateVideo"
  | "export";

const SOURCE_TEXT_KEY = "audio-image-to-video:sourceText:v1";
const WORKFLOW_STORAGE_KEY = "audio-image-to-video:workflow:v1";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readStoredSourceText(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStoredSourceText(key: string, text: string) {
  if (typeof window === "undefined") return;
  try {
    if (text) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function useAudioImagePipeline({
  useAiReferenceImage = true,
  getForm,
  onTranscribed,
  onAnalyzed,
}: {
  useAiReferenceImage?: boolean;
  getForm: () => AudioImageToVideoFormState;
  onTranscribed?: (text: string) => void;
  onAnalyzed: (script: ScriptData) => void;
}): WorkflowStepsState<AudioImagePipelineStepId> {
  const toast = useToast();
  const getFormRef = useRef(getForm);
  getFormRef.current = getForm;
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;
  const sourceTextRef = useRef(readStoredSourceText(SOURCE_TEXT_KEY));

  useEffect(() => {
    sourceTextRef.current = readStoredSourceText(SOURCE_TEXT_KEY);
    const stored = sourceTextRef.current;
    if (stored && !getFormRef.current().textContent?.trim()) {
      onTranscribedRef.current?.(stored);
    }
  }, []);

  const stepDefs = useMemo(() => {
    const steps: Array<{
      id: AudioImagePipelineStepId;
      label: string;
      run: () => Promise<void>;
    }> = [
      {
        id: "transcribe",
        label: "Lấy text",
        run: async () => {
          try {
            const text = await transcribeSourceText(getFormRef.current());
            sourceTextRef.current = text;
            writeStoredSourceText(SOURCE_TEXT_KEY, text);
            onTranscribedRef.current?.(text);
          } catch (err: any) {
            toast.error(err?.message || "Lấy text thất bại");
            throw err;
          }
        },
      },
      {
        id: "analyze",
        label: "Phân tích",
        run: async () => {
          try {
            const form = getFormRef.current();
            const sourceText =
              sourceTextRef.current.trim() ||
              form.textContent?.trim() ||
              readStoredSourceText(SOURCE_TEXT_KEY);
            if (sourceText) {
              sourceTextRef.current = sourceText;
              writeStoredSourceText(SOURCE_TEXT_KEY, sourceText);
            }
            const script = await analyzeSourceTextToScenes(form, sourceText);
            onAnalyzedRef.current(script);
          } catch (err: any) {
            toast.error(err?.message || "Phân tích thất bại");
            throw err;
          }
        },
      },
    ];

    if (useAiReferenceImage) {
      steps.push({
        id: "generateImage",
        label: "Generate Image",
        run: async () => {
          const actions = getAudioImageBatchActions();
          if (!actions?.generateAllImages) {
            toast.error("Chưa sẵn sàng tạo ảnh. Hãy hoàn thành Phân tích trước.");
            throw new Error("Batch image actions chưa sẵn sàng");
          }
          try {
            await actions.generateAllImages();
          } catch (err: any) {
            toast.error(err?.message || "Generate Image thất bại");
            throw err;
          }
        },
      });
    }

    steps.push(
      {
        id: "generateVideo",
        label: "Generate Video",
        run: async () => {
          const actions = getAudioImageBatchActions();
          if (!actions?.generateAllVideos) {
            toast.error(
              useAiReferenceImage
                ? "Chưa sẵn sàng tạo video. Hãy generate ảnh trước."
                : "Chưa sẵn sàng tạo video. Hãy hoàn thành Phân tích trước."
            );
            throw new Error("Batch video actions chưa sẵn sàng");
          }
          try {
            await actions.generateAllVideos();
          } catch (err: any) {
            toast.error(err?.message || "Generate Video thất bại");
            throw err;
          }
        },
      },
      {
        id: "export",
        label: "Xuất video",
        run: async () => {
          await wait(1200);
        },
      }
    );

    return steps;
  }, [toast, useAiReferenceImage]);

  return useWorkflowSteps({
    steps: stepDefs,
    storageKey: WORKFLOW_STORAGE_KEY,
    defaultAutoAdvance: false,
  });
}
