import { Button } from "../../../shared/utilities/form";
import { VIDEO_DURATION_OPTIONS, VideoDurationS } from "../constants";

export function VideoDurationPicker({
  value,
  onChange,
  buttonClassName,
}: {
  value?: VideoDurationS;
  onChange: (duration: VideoDurationS) => void;
  buttonClassName?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {VIDEO_DURATION_OPTIONS.map((duration) => {
        const isActive = (value ?? 8) === duration;
        const baseClass =
          buttonClassName ??
          `flex items-center justify-center w-14 h-8 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
            isActive
              ? "text-blue-600 bg-blue-50 border-blue-400"
              : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
          }`;

        return (
          <Button
            key={duration}
            id={`video-duration-${duration}`}
            tooltip={`${duration}s`}
            onClick={() => onChange(duration)}
            className={baseClass}
          >
            {duration}s
          </Button>
        );
      })}
    </div>
  );
}
