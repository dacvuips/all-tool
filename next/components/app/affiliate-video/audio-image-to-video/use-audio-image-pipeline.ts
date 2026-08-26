import { useEffect, useMemo, useRef } from "react";
import { useToast } from "../../../../lib/providers/toast-provider";
import { useWorkflowSteps, type WorkflowStepsState } from "../../../shared/workflow-steps";
import type { ScriptData } from "../constants";
import {
  analyzeSourceTextToScenes,
  transcribeSourceText,
} from "./analyze-audio-image";
import type { AudioImageToVideoFormState, SourceTab } from "./audio-image-types";
import { getAudioImageBatchActions } from "./audio-image-batch-bridge";

export type AudioImagePipelineStepId =
  | "transcribe"
  | "analyze"
  | "generateImage"
  | "generateVideo"
  | "export";

const SOURCE_TEXT_PREFIX = "audio-image-to-video:sourceText:";
const WORKFLOW_STORAGE_KEY = "audio-image-to-video:workflow:v1";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sourceTextStorageKey(sourceTab: SourceTab) {
  return `${SOURCE_TEXT_PREFIX}${sourceTab}:v1`;
}

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

function transcribeStepLabel(sourceTab: SourceTab): string {
  if (sourceTab === "image") return "Trích text ảnh";
  if (sourceTab === "text") return "Chuẩn bị text";
  return "Lấy text";
}

export function useAudioImagePipeline({
  getForm,
  sourceTab,
  onTranscribed,
  onAnalyzed,
  onAnalyzeComplete,
  onVideosGenerated,
}: {
  getForm: () => AudioImageToVideoFormState;
  /** Tab nguồn đang chọn — đổi label bước + kho text riêng */
  sourceTab: SourceTab;
  onTranscribed?: (text: string) => void;
  onAnalyzed: (script: ScriptData) => void;
  /** Sau phân tích xong — vd. xóa timeline Studio cũ */
  onAnalyzeComplete?: () => void;
  /** Sau tạo video xong — Studio seed lại với video mới */
  onVideosGenerated?: () => void;
}): WorkflowStepsState<AudioImagePipelineStepId> {
  const toast = useToast();
  const getFormRef = useRef(getForm);
  getFormRef.current = getForm;
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;
  const onAnalyzeCompleteRef = useRef(onAnalyzeComplete);
  onAnalyzeCompleteRef.current = onAnalyzeComplete;
  const onVideosGeneratedRef = useRef(onVideosGenerated);
  onVideosGeneratedRef.current = onVideosGenerated;
  const sourceTabRef = useRef(sourceTab);
  sourceTabRef.current = sourceTab;

  const textKey = sourceTextStorageKey(sourceTab);
  const sourceTextRef = useRef(readStoredSourceText(textKey));

  useEffect(() => {
    const key = sourceTextStorageKey(sourceTab);
    sourceTextRef.current = readStoredSourceText(key);
    const stored = sourceTextRef.current;
    // Image/audio: khôi phục text đã trích. Text: ưu tiên ô nhập form.
    if (sourceTab === "text") {
      const formText = getFormRef.current().textContent?.trim() || "";
      if (formText) sourceTextRef.current = formText;
      else if (stored) onTranscribedRef.current?.(stored);
    } else if (stored && !getFormRef.current().textContent?.trim()) {
      onTranscribedRef.current?.(stored);
    }
  }, [sourceTab]);

  const stepDefs = useMemo(() => {
    const steps: Array<{
      id: AudioImagePipelineStepId;
      label: string;
      run: () => Promise<void>;
    }> = [
      {
        id: "transcribe",
        label: transcribeStepLabel(sourceTab),
        run: async () => {
          try {
            const form = getFormRef.current();
            const tab = form.sourceTab || sourceTabRef.current;
            const key = sourceTextStorageKey(tab);

            // Text: dùng luôn nội dung ô nhập — không cần OCR/API nặng.
            if (tab === "text") {
              const text = (form.textContent || "").trim();
              if (!text) throw new Error("Vui lòng nhập nội dung văn bản");
              sourceTextRef.current = text;
              writeStoredSourceText(key, text);
              onTranscribedRef.current?.(text);
              return;
            }

            const text = await transcribeSourceText(form);
            sourceTextRef.current = text;
            writeStoredSourceText(key, text);
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
            const tab = form.sourceTab || sourceTabRef.current;
            const key = sourceTextStorageKey(tab);
            const sourceText =
              sourceTextRef.current.trim() ||
              form.textContent?.trim() ||
              readStoredSourceText(key);
            if (sourceText) {
              sourceTextRef.current = sourceText;
              writeStoredSourceText(key, sourceText);
            }
            const script = await analyzeSourceTextToScenes(form, sourceText);
            onAnalyzedRef.current(script);
            onAnalyzeCompleteRef.current?.();
          } catch (err: any) {
            toast.error(err?.message || "Phân tích thất bại");
            throw err;
          }
        },
      },
      {
        id: "generateImage",
        label: "Tạo ảnh",
        run: async () => {
          const actions = getAudioImageBatchActions();
          if (!actions?.generateAllImages) {
            toast.error("Chưa sẵn sàng tạo ảnh. Hãy hoàn thành Phân tích trước.");
            throw new Error("Batch image actions chưa sẵn sàng");
          }
          try {
            await actions.generateAllImages();
          } catch (err: any) {
            toast.error(err?.message || "Tạo ảnh thất bại");
            throw err;
          }
        },
      },
      {
        id: "generateVideo",
        label: "Tạo video",
        run: async () => {
          const actions = getAudioImageBatchActions();
          if (!actions?.generateAllVideos) {
            toast.error("Chưa sẵn sàng tạo video. Hãy tạo ảnh trước.");
            throw new Error("Batch video actions chưa sẵn sàng");
          }
          try {
            await actions.generateAllVideos();
            onVideosGeneratedRef.current?.();
          } catch (err: any) {
            toast.error(err?.message || "Tạo video thất bại");
            throw err;
          }
        },
      },
      {
        id: "export",
        label: "Xuất video",
        run: async () => {
          // Timeline + phụ đề chỉnh trong tab Studio (giống Film).
          toast.success("Mở tab Studio để ghép timeline và xuất video.");
          await wait(400);
        },
      },
    ];

    return steps;
  }, [toast, sourceTab]);

  return useWorkflowSteps({
    steps: stepDefs,
    storageKey: `${WORKFLOW_STORAGE_KEY}:${sourceTab}`,
    defaultAutoAdvance: false,
  });
}
