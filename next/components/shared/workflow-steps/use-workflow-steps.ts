import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WorkflowStepStatus = "idle" | "running" | "done" | "error";

export type WorkflowStepDef<TId extends string = string> = {
  id: TId;
  label: string;
  run?: () => Promise<void>;
};

export type WorkflowStep<TId extends string = string> = WorkflowStepDef<TId> & {
  status: WorkflowStepStatus;
};

function readStoredBoolean(key: string | undefined, fallback: boolean) {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeStoredBoolean(key: string | undefined, value: boolean) {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function toIdleSteps<TId extends string>(defs: WorkflowStepDef<TId>[]): WorkflowStep<TId>[] {
  return defs.map((step) => ({ ...step, status: "idle" }));
}

export function useWorkflowSteps<TId extends string = string>({
  steps: stepDefs,
  storageKey,
  defaultAutoAdvance = false,
}: {
  steps: WorkflowStepDef<TId>[];
  storageKey?: string;
  defaultAutoAdvance?: boolean;
}) {
  const defsRef = useRef(stepDefs);
  defsRef.current = stepDefs;

  const [steps, setSteps] = useState<WorkflowStep<TId>[]>(() => toIdleSteps(stepDefs));
  const [isRunning, setIsRunning] = useState(false);
  const [autoAdvance, setAutoAdvanceState] = useState(() =>
    readStoredBoolean(storageKey, defaultAutoAdvance)
  );

  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const stepIds = stepDefs.map((step) => step.id).join("|");
  useEffect(() => {
    setSteps(toIdleSteps(defsRef.current));
  }, [stepIds]);

  const patchStatus = useCallback((id: TId, status: WorkflowStepStatus) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, status } : step)));
  }, []);

  const setAutoAdvance = useCallback(
    (value: boolean) => {
      autoAdvanceRef.current = value;
      setAutoAdvanceState(value);
      writeStoredBoolean(storageKey, value);
    },
    [storageKey]
  );

  const executeFrom = useCallback(
    async (startIndex: number) => {
      const defs = defsRef.current;
      if (runningRef.current) return;
      if (startIndex < 0 || startIndex >= defs.length) return;

      const runId = ++runIdRef.current;
      runningRef.current = true;
      setIsRunning(true);

      try {
        for (let index = startIndex; index < defs.length; index++) {
          if (runIdRef.current !== runId) return;
          const def = defs[index];
          patchStatus(def.id, "running");
          try {
            await def.run?.();
          } catch {
            if (runIdRef.current !== runId) return;
            patchStatus(def.id, "error");
            return;
          }
          if (runIdRef.current !== runId) return;
          patchStatus(def.id, "done");
          if (index < defs.length - 1 && !autoAdvanceRef.current) break;
        }
      } finally {
        if (runIdRef.current === runId) {
          runningRef.current = false;
          setIsRunning(false);
        }
      }
    },
    [patchStatus]
  );

  const start = useCallback(async () => {
    runIdRef.current += 1;
    runningRef.current = false;
    setIsRunning(false);
    setSteps(toIdleSteps(defsRef.current));
    await executeFrom(0);
  }, [executeFrom]);

  const runNext = useCallback(async () => {
    const nextIndex = stepsRef.current.findIndex(
      (step) => step.status === "idle" || step.status === "error"
    );
    if (nextIndex < 0) return;
    await executeFrom(nextIndex);
  }, [executeFrom]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    runningRef.current = false;
    setIsRunning(false);
    setSteps((prev) =>
      prev.map((step) => (step.status === "running" ? { ...step, status: "idle" } : step))
    );
  }, []);

  const currentStep = useMemo(
    () => steps.find((step) => step.status === "running") ?? null,
    [steps]
  );
  const isDone = steps.length > 0 && steps.every((step) => step.status === "done");
  const hasError = steps.some((step) => step.status === "error");
  const canContinue =
    !isRunning &&
    !isDone &&
    steps.some((step) => step.status === "done") &&
    steps.some((step) => step.status === "idle" || step.status === "error");
  const canAutoContinue =
    !isRunning &&
    !isDone &&
    !hasError &&
    steps.some((step) => step.status === "done") &&
    steps.some((step) => step.status === "idle");

  useEffect(() => {
    if (autoAdvance && canAutoContinue) {
      runNext();
    }
  }, [autoAdvance, canAutoContinue, runNext]);

  return {
    steps,
    isRunning,
    isDone,
    canContinue,
    currentStep,
    autoAdvance,
    setAutoAdvance,
    start,
    runNext,
    stop,
  };
}

export type WorkflowStepsState<TId extends string = string> = ReturnType<
  typeof useWorkflowSteps<TId>
>;
