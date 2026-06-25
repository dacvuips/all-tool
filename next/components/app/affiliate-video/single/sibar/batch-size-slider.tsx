import React from "react";
import { useTranslation } from "react-i18next";
import { BsLayers } from "react-icons/bs";

interface BatchSizeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const BatchSizeSlider: React.FC<BatchSizeSliderProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  const [localValue, setLocalValue] = React.useState(value);

  // Sync local state if parent value changes externally
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalValue(val);
    onChange(val);
  };

  return (
    <div id="batch-size-slider" className="p-4 bg-purple-50 rounded-xl border border-purple-100">
      <div className="flex justify-between items-center mb-4 text-purple-900">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {t("Số lượng mẹo cần tạo")}: {localValue}
        </h3>
        <BsLayers className="text-lg text-purple-700" />
      </div>

      <div className="relative w-full">
        <input
          type="range"
          min={1}
          max={16}
          step={1}
          value={localValue}
          onChange={handleInputChange}
          className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
              ((localValue - 1) / 15) * 100
            }%, #e9d5ff ${((localValue - 1) / 15) * 100}%, #e9d5ff 100%)`,
          }}
        />
        {/* Custom thumb styles using tailwind arbitrary variants since standard classes might not fully style the thumb in all browsers */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #9333ea;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 0 1px #9333ea;
          }
          input[type=range]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #9333ea;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 0 1px #9333ea;
          }
        `,
          }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs font-medium text-purple-400">
        <span>1</span>
        <span>4</span>
        <span>8</span>
        <span>12</span>
        <span>16</span>
      </div>

      <p className="mt-3 text-xs italic leading-relaxed text-purple-600">
        *{t("AI sẽ tự nghĩ ra")} {value} {t("ý tưởng khác nhau dựa trên chủ đề bạn chọn.")}
      </p>
    </div>
  );
};
