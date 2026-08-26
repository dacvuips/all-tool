import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiPlayLine,
  RiRefreshLine,
} from "react-icons/ri";
import { Switch } from "../utilities/form";
import type { WorkflowStep, WorkflowStepStatus } from "./use-workflow-steps";

/** Tailwind v2: dùng success/green/danger/warning — không có emerald/amber. */
function statusClass(status: WorkflowStepStatus) {
  if (status === "done") return "bg-success text-white border-green-600";
  if (status === "running") return "bg-primary text-white border-primary";
  if (status === "error") return "bg-danger text-white border-red-600";
  return "bg-white text-gray-500 border-gray-300";
}

function lineClass(status: WorkflowStepStatus) {
  if (status === "done") return "bg-success";
  if (status === "running") return "bg-primary";
  if (status === "error") return "bg-danger";
  return "bg-gray-200";
}

function labelClass(status: WorkflowStepStatus) {
  if (status === "done") return "text-success";
  if (status === "running") return "text-primary";
  if (status === "error") return "text-danger";
  return "text-gray-400";
}

function StepIcon({ status, index }: { status: WorkflowStepStatus; index: number }) {
  if (status === "running") return <RiLoader4Line className="animate-spin text-xs" />;
  if (status === "done") return <RiCheckLine className="text-xs" />;
  if (status === "error") return <RiCloseLine className="text-xs" />;
  return <span className="text-10 font-bold leading-none">{index + 1}</span>;
}

function WorkflowStepItem({
  step,
  index,
  isFirst,
  isLast,
  leftLineStatus,
  rightLineStatus,
  clickable,
  canRetry,
  onRerun,
}: {
  step: WorkflowStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  leftLineStatus: WorkflowStepStatus;
  rightLineStatus: WorkflowStepStatus;
  clickable: boolean;
  canRetry: boolean;
  onRerun?: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const showRetry = canRetry && hovered;

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex h-6 w-full items-center">
        {isFirst ? (
          <div className="h-0.5 flex-1" />
        ) : (
          <div className={`h-0.5 flex-1 rounded ${lineClass(leftLineStatus)}`} />
        )}

        <button
          type="button"
          disabled={!clickable}
          title={
            canRetry
              ? t("Chạy lại từ bước này")
              : clickable
              ? t("Chạy từ bước này")
              : undefined
          }
          onClick={() => {
            if (clickable) onRerun?.(step.id);
          }}
          className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border p-0 ${
            showRetry
              ? "cursor-pointer border-primary bg-primary text-white"
              : statusClass(step.status)
          } ${clickable ? "cursor-pointer" : "cursor-default"}`}
        >
          {showRetry ? (
            <RiRefreshLine className="text-sm" />
          ) : (
            <StepIcon status={step.status} index={index} />
          )}
        </button>

        {isLast ? (
          <div className="h-0.5 flex-1" />
        ) : (
          <div className={`h-0.5 flex-1 rounded ${lineClass(rightLineStatus)}`} />
        )}
      </div>
      <span
        className={`mt-0.5 max-w-full truncate px-0.5 text-center text-10 font-semibold leading-tight ${
          showRetry ? "text-primary" : labelClass(step.status)
        }`}
      >
        {showRetry ? t("Chạy lại") : t(step.label)}
      </span>
    </div>
  );
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

      <div className="flex min-w-0 flex-1 items-start">
        {steps.map((step, index) => {
          const clickable = canClickStep(index);
          const prev = steps[index - 1];
          const canRetry =
            clickable && (step.status === "done" || step.status === "error");

          return (
            <WorkflowStepItem
              key={step.id}
              step={step}
              index={index}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
              leftLineStatus={prev?.status ?? "idle"}
              rightLineStatus={step.status}
              clickable={clickable}
              canRetry={canRetry}
              onRerun={onRerunFrom}
            />
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
