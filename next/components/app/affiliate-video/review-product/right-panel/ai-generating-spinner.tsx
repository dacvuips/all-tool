/**
 * ai-generating-spinner.tsx
 * Shared AI generating spinner – reusable across Script tab & Batch List tab
 */
import { useTranslation } from "react-i18next";
import { GenerateAiIcon } from "../../../../../public/assets/svg/generate-ai";

interface AiGeneratingSpinnerProps {
  /** Optional message – defaults to "Đang tạo kịch bản AI..." */
  message?: string;
}

export const AiGeneratingSpinner = ({ message }: AiGeneratingSpinnerProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="relative w-20 h-20 mb-6">
        {/* Spinner ring rotating around the icon */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin"
          style={{ animationDuration: "1.2s" }}
          viewBox="0 0 80 80"
          fill="none"
        >
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="url(#aiSpinnerGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="180 45"
          />
          <defs>
            <linearGradient
              id="aiSpinnerGrad"
              x1="0"
              y1="0"
              x2="80"
              y2="80"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {/* Gold glow pulse */}
        <div
          className="absolute inset-0 rounded-full bg-yellow-200 opacity-20 animate-ping"
          style={{ animationDuration: "1.8s" }}
        />
        {/* Icon container */}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br text-yellow-200">
          <GenerateAiIcon size={36} />
        </div>
      </div>
      <div className="text-base font-semibold text-gray-700 mb-1">
        {message || t("Đang tạo kịch bản AI...")}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
};
