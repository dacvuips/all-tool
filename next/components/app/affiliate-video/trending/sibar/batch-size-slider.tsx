/**
 * batch-size-slider.tsx
 * Slider chọn số lượng phiên bản / phân cảnh cần tạo.
 * Nhận label + description động tuỳ theo chế độ (Đơn Lẻ / Cốt truyện).
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { BsLayers } from "react-icons/bs";

interface BatchSizeSliderProps {
  /** Giá trị hiện tại */
  value: number;
  /** Callback khi giá trị thay đổi */
  onChange: (value: number) => void;
  /** Tiêu đề hiển thị (VD: "Số phiên bản" hoặc "Số phân cảnh") */
  label?: string;
  /** Mô tả phụ bên dưới slider – dùng {count} làm placeholder cho giá trị */
  description?: string;
}

export const BatchSizeSlider: React.FC<BatchSizeSliderProps> = ({
  value,
  onChange,
  label,
  description,
}) => {
  const { t } = useTranslation();

  const [localValue, setLocalValue] = React.useState(value);

  // Đồng bộ state nội bộ khi giá trị từ parent thay đổi
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  /** Xử lý khi user kéo slider */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalValue(val);
    onChange(val);
  };

  // Tiêu đề mặc định nếu không truyền prop label
  const displayLabel = label || t("Số lượng phân cảnh");

  // Mô tả mặc định nếu không truyền prop description
  const displayDescription =
    description?.replace("{count}", String(value)) ||
    `${t("AI sẽ tự nghĩ ra")} ${value} ${t("ý tưởng khác nhau dựa trên chủ đề bạn chọn.")}`;

  return (
    <div id="batch-size-slider" className="p-4 bg-purple-50 rounded-xl border border-purple-100">
      {/* Tiêu đề + icon */}
      <div className="flex justify-between items-center mb-4 text-purple-900">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {t(displayLabel)}: {localValue}
        </h3>
        <BsLayers className="text-lg text-purple-700" />
      </div>

      {/* Thanh slider */}
      <div className="relative w-full">
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={localValue}
          onChange={handleInputChange}
          className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
              ((localValue - 1) / 7) * 100
            }%, #e9d5ff ${((localValue - 1) / 7) * 100}%, #e9d5ff 100%)`,
          }}
        />
        {/* Custom thumb styles – đảm bảo hiển thị đúng trên mọi trình duyệt */}
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

      {/* Các mốc giá trị */}
      <div className="flex justify-between mt-2 text-xs font-medium text-purple-400">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
        <span>6</span>
        <span>7</span>
        <span>8</span>
      </div>

      {/* Mô tả phụ */}
      <p className="mt-3 text-xs italic leading-relaxed text-purple-600">*{displayDescription}</p>
    </div>
  );
};
