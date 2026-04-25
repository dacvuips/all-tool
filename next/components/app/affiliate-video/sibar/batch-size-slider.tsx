import React from "react";
import { useTranslation } from "react-i18next";
import { BsLayers } from "react-icons/bs";

interface BatchSizeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const BatchSizeSlider: React.FC<BatchSizeSliderProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
      <div className="flex justify-between items-center mb-4 text-purple-900">
        <h3 className="font-semibold text-sm uppercase tracking-wide">
          {t("Số lượng mẹo cần tạo")}: {value}
        </h3>
        <BsLayers className="text-purple-700 text-lg" />
      </div>

      <div className="relative w-full">
        <input
          type="range"
          min={2}
          max={30}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-purple-200 accent-purple-600 focus:outline-none"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
              ((value - 2) / 18) * 100
            }%, #e9d5ff ${((value - 2) / 18) * 100}%, #e9d5ff 100%)`,
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

      <div className="flex justify-between text-purple-400 text-xs mt-2 font-medium">
        <span>2</span>
        <span>10</span>
        <span>20</span>
        <span>30</span>
      </div>

      <p className="text-purple-600 text-xs italic mt-3 leading-relaxed">
        *{t("AI sẽ tự nghĩ ra")} {value} {t("ý tưởng khác nhau dựa trên chủ đề bạn chọn.")}
      </p>
    </div>
  );
};
