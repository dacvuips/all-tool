/**
 * useSceneMediaGenerationActions.ts
 * Logic dừng / tạo lại job generation cho từng scene.
 */
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProgressKind } from "./useSceneProgressBroadcast";

type CancelJobFn = (jobId: string) => Promise<void>;

interface UseSceneMediaGenerationActionsParams {
  sceneId: string;
  kind: SceneProgressKind;
  cancelJob: CancelJobFn;
  registerSceneJob?: (sceneId: string, kind: SceneProgressKind, jobId: string | null) => void;
  getSceneJob?: (sceneId: string, kind: SceneProgressKind) => string | undefined;
  onStopCleanup: () => void;
  reportError?: (message: string | null) => void;
  onRetry: () => void;
}

export function useSceneMediaGenerationActions({
  sceneId,
  kind,
  cancelJob,
  registerSceneJob,
  getSceneJob,
  onStopCleanup,
  reportError,
  onRetry,
}: UseSceneMediaGenerationActionsParams) {
  const { t } = useTranslation();
  const jobIdRef = useRef<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  const bindJobEnqueued = useCallback(
    (jobId: string) => {
      jobIdRef.current = jobId;
      registerSceneJob?.(sceneId, kind, jobId);
      setCanRetry(false);
    },
    [registerSceneJob, sceneId, kind]
  );

  const clearJob = useCallback(() => {
    jobIdRef.current = null;
    registerSceneJob?.(sceneId, kind, null);
  }, [registerSceneJob, sceneId, kind]);

  const markGenerationEnded = useCallback(
    (interrupted = false) => {
      clearJob();
      if (interrupted) {
        setCanRetry(true);
      } else {
        setCanRetry(false);
      }
    },
    [clearJob]
  );

  const handleStop = useCallback(async () => {
    const jobId = jobIdRef.current || getSceneJob?.(sceneId, kind);
    if (!jobId) {
      onStopCleanup();
      setCanRetry(true);
      reportError?.(t("Đã dừng"));
      return;
    }

    setActionPending(true);
    try {
      await cancelJob(jobId);
    } finally {
      onStopCleanup();
      clearJob();
      setCanRetry(true);
      reportError?.(t("Đã dừng"));
      setActionPending(false);
    }
  }, [cancelJob, clearJob, getSceneJob, kind, onStopCleanup, reportError, sceneId, t]);

  const handleRetry = useCallback(() => {
    setCanRetry(false);
    reportError?.(null);
    onRetry();
  }, [onRetry, reportError]);

  return {
    bindJobEnqueued,
    markGenerationEnded,
    clearJob,
    actionPending,
    canRetry,
    handleStop,
    handleRetry,
    setCanRetry,
  };
}
