import { useTranslation } from "react-i18next";
import { BsFile, BsSquare } from "react-icons/bs";

import { Button } from "../../../shared/utilities/form";
import { ASPECT_RATIOS, AspectRatio } from "../constants";

function aspectRatioLabel(
  ar: (typeof ASPECT_RATIOS)[number],
  t: (key: string) => string
): string {
  if (ar.orientation === "portrait") return `${ar.value} ${t("Dọc")}`;
  if (ar.orientation === "square") return `${ar.value} ${t("Vuông")}`;
  return `${ar.value} ${t("Ngang")}`;
}

export function AspectRatioPicker({
  value,
  onChange,
  buttonClassName,
}: {
  value?: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  buttonClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {ASPECT_RATIOS.map((ar) => {
        const isActive = value === ar.value;
        const isPortrait = ar.orientation === "portrait";
        const isSquare = ar.orientation === "square";
        const baseClass =
          buttonClassName ??
          `flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isActive
              ? "text-blue-600 bg-blue-50 border-blue-400"
              : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
          }`;

        return (
          <Button
            key={ar.value}
            id={`aspect-ratio-${ar.value.replace(":", "-")}`}
            onClick={() => onChange(ar.value)}
            className={baseClass}
          >
            <span className="text-base">
              {isSquare ? (
                <BsSquare />
              ) : isPortrait ? (
                <BsFile />
              ) : (
                <BsFile style={{ transform: "rotate(90deg)" }} />
              )}
            </span>
            {aspectRatioLabel(ar, t)}
          </Button>
        );
      })}
    </div>
  );
}
