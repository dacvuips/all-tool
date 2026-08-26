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

function statusesStorageKey(storageKey: string | undefined) {
  return storageKey ? `${storageKey}:statuses` : undefined;
}

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

function readStoredStatuses<TId extends string>(
  key: string | undefined,
  defs: WorkflowStepDef<TId>[]
): WorkflowStepStatus[] | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return null;
    return defs.map((def) => {
      const status = parsed[def.id];
      if (status === "done" || status === "error" || status === "idle") return status;
      // "running" lúc reload = bị gián đoạn → idle để làm lại
      return "idle";
    });
  } catch {
    return null;
  }
}

function writeStoredStatuses<TId extends string>(
  key: string | undefined,
  steps: Array<{ id: TId; status: WorkflowStepStatus }>
) {
  if (!key || typeof window === "undefined") return;
  try {
    const payload: Record<string, WorkflowStepStatus> = {};
    for (const step of steps) {
      payload[step.id] = step.status === "running" ? "idle" : step.status;
    }
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function toIdleSteps<TId extends string>(defs: WorkflowStepDef<TId>[]): WorkflowStep<TId>[] {
  return defs.map((step) => ({ ...step, status: "idle" as const }));
}

function hydrateSteps<TId extends string>(
  defs: WorkflowStepDef<TId>[],
  storageKey: string | undefined
): WorkflowStep<TId>[] {
  const stored = readStoredStatuses(statusesStorageKey(storageKey), defs);
  if (!stored) return toIdleSteps(defs);
  return defs.map((def, index) => ({
    ...def,
    status: stored[index] || "idle",
  }));
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
  const statusKey = statusesStorageKey(storageKey);

  const [steps, setSteps] = useState<WorkflowStep<TId>[]>(() =>
    hydrateSteps(stepDefs, storageKey)
  );
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
    setSteps(hydrateSteps(defsRef.current, storageKey));
  }, [stepIds, storageKey]);

  useEffect(() => {
    writeStoredStatuses(statusKey, steps);
  }, [steps, statusKey]);

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

  /** Chạy lại từ step chỉ định; các step sau bị reset về idle. */
  const rerunFrom = useCallback(
    async (stepId: TId) => {
      if (runningRef.current) return;
      const defs = defsRef.current;
      const startIndex = defs.findIndex((step) => step.id === stepId);
      if (startIndex < 0) return;

      // Chỉ cho phép nếu mọi step trước đó đã done
      const current = stepsRef.current;
      for (let i = 0; i < startIndex; i++) {
        if (current[i]?.status !== "done") return;
      }

      runIdRef.current += 1;
      runningRef.current = false;
      setIsRunning(false);
      setSteps((prev) =>
        prev.map((step, index) =>
          index >= startIndex ? { ...step, status: "idle" as const } : step
        )
      );
      await executeFrom(startIndex);
    },
    [executeFrom]
  );

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
    rerunFrom,
    stop,
  };
}

export type WorkflowStepsState<TId extends string = string> = ReturnType<
  typeof useWorkflowSteps<TId>
>;
