import { useTranslation } from "react-i18next";

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

/** Ratio-shaped rectangle icon that visually reflects the aspect ratio itself. */
function RatioShape({
  ratio,
  active,
}: {
  ratio: (typeof ASPECT_RATIOS)[number];
  active: boolean;
}) {
  const [w, h] = ratio.value.split(":").map(Number);
  const maxSize = 20;
  const width = w >= h ? maxSize : (maxSize * w) / h;
  const height = h >= w ? maxSize : (maxSize * h) / w;

  return (
    <span
      className={`shrink-0 rounded-[3px] border-2 ${
        active ? "border-blue-600 bg-blue-100" : "border-gray-400 bg-transparent"
      }`}
      style={{ width, height }}
    />
  );
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
    <div className="flex flex-wrap gap-2">
      {ASPECT_RATIOS.map((ar) => {
        const isActive = value === ar.value;
        const baseClass =
          buttonClassName ??
          `flex flex-col items-center justify-center gap-1.5 w-14 h-14 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
            isActive
              ? "text-blue-600 bg-blue-50 border-blue-400"
              : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
          }`;

        return (
          <Button
            key={ar.value}
            id={`aspect-ratio-${ar.value.replace(":", "-")}`}
            tooltip={aspectRatioLabel(ar, t)}
            onClick={() => onChange(ar.value)}
            className={baseClass}
          >
            <RatioShape ratio={ar} active={isActive} />
            <span>{ar.value}</span>
          </Button>
        );
      })}
    </div>
  );
}
