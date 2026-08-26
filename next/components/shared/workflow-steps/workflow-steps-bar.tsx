import { useTranslation } from "react-i18next";
import { RiCheckLine, RiCloseLine, RiLoader4Line, RiPlayLine } from "react-icons/ri";
import { Switch } from "../utilities/form";
import type { WorkflowStep, WorkflowStepStatus } from "./use-workflow-steps";

function statusClass(status: WorkflowStepStatus) {
  if (status === "done") return "bg-emerald-500 text-white border-emerald-500";
  if (status === "running") return "bg-primary text-white border-primary";
  if (status === "error") return "bg-red-500 text-white border-red-500";
  return "bg-white text-gray-400 border-gray-300";
}

function lineClass(status: WorkflowStepStatus) {
  if (status === "done") return "bg-emerald-400";
  if (status === "running") return "bg-primary";
  if (status === "error") return "bg-red-400";
  return "bg-gray-200";
}

function StepIcon({ status, index }: { status: WorkflowStepStatus; index: number }) {
  if (status === "running") return <RiLoader4Line className="animate-spin text-xs" />;
  if (status === "done") return <RiCheckLine className="text-xs" />;
  if (status === "error") return <RiCloseLine className="text-xs" />;
  return <span className="text-10 font-bold">{index + 1}</span>;
}

export function WorkflowStepsBar({
  title,
  steps,
  isRunning,
  isDone,
  canContinue,
  autoAdvance,
  onAutoAdvanceChange,
  onContinue,
  onRerunFrom,
}: {
  title?: string;
  steps: WorkflowStep[];
  isRunning: boolean;
  isDone: boolean;
  canContinue?: boolean;
  autoAdvance: boolean;
  onAutoAdvanceChange: (value: boolean) => void;
  onContinue?: () => void;
  /** Click step đã xong / lỗi / step kế tiếp để chạy lại từ đó */
  onRerunFrom?: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const current = steps.find((step) => step.status === "running");
  const statusText =
    isRunning && current
      ? t("Đang {{step}}...", { step: t(current.label).toLowerCase() })
      : isDone
      ? t("Hoàn tất")
      : "";

  const canClickStep = (index: number) => {
    if (!onRerunFrom || isRunning) return false;
    const step = steps[index];
    if (!step) return false;
    if (step.status === "done" || step.status === "error") return true;
    // Step kế tiếp (idle) khi mọi step trước đã done
    if (step.status === "idle") {
      return steps.slice(0, index).every((s) => s.status === "done");
    }
    return false;
  };

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-3 py-2">
      {title ? (
        <span className="flex-shrink-0 text-xs font-semibold text-gray-800">{title}</span>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const clickable = canClickStep(index);
          return (
            <div key={step.id} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              <button
                type="button"
                disabled={!clickable}
                title={clickable ? t("Chạy lại từ bước này") : undefined}
                onClick={() => {
                  if (clickable) onRerunFrom?.(step.id);
                }}
                className={`flex min-w-0 flex-col items-center border-0 bg-transparent p-0 ${
                  clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${statusClass(
                    step.status
                  )}`}
                >
                  <StepIcon status={step.status} index={index} />
                </div>
                <span
                  className={`mt-0.5 text-center text-10 font-semibold leading-tight ${
                    step.status === "idle" ? "text-gray-400" : "text-gray-700"
                  }`}
                >
                  {t(step.label)}
                </span>
              </button>
              {!isLast && (
                <div className={`mx-1.5 mb-3 h-0.5 flex-1 rounded ${lineClass(step.status)}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {canContinue && !autoAdvance && onContinue ? (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-0.5 rounded-md border-0 bg-primary px-2 py-0.5 text-10 font-semibold text-white"
          >
            <RiPlayLine className="text-xs" />
            {t("Tiếp tục")}
          </button>
        ) : statusText ? (
          <span className="text-10 text-gray-500">{statusText}</span>
        ) : null}
        <Switch
          size="sm"
          className="items-center"
          value={autoAdvance}
          placeholder={t("Auto")}
          onChange={(value) => onAutoAdvanceChange(!!value)}
        />
      </div>
    </div>
  );
}
