import classnames from "classnames";
import { useRouter } from "next/router";
import PropTypes from "prop-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseNumber } from "../../../../lib/helpers/parser";
import { Label } from "./label";
// import "../../../../style/multiRangeSlider.css";
export interface MultiRangeProps extends ReactProps {
  min?: number;
  max?: number;
  label?: string;
  onChange?: ({ min, max }) => void;
  width?: string;
  multi?: boolean;
  classNameValue?: string;
  classNameLabel?: string;
  getValue?: () => any;
  textValue?: string;
  defaultMinValue?: number;
  defaultMaxValue?: number;
}
const MultiRangeSlider = ({
  min,
  max,
  onChange,
  getValue,
  className,
  style,
  label,
  defaultMinValue,
  defaultMaxValue,
  ...props
}: MultiRangeProps) => {
  const [minVal, setMinVal] = useState(defaultMinValue || min);
  const [maxVal, setMaxVal] = useState(defaultMaxValue || max);
  const [minValue, setMinValue] = useState();
  const [maxValue, setMaxValue] = useState();
  const [hasValue, setHasValue] = useState<boolean>(true);
  const minValRef = useRef(null);
  const maxValRef = useRef(null);
  const range = useRef(null);
  const router = useRouter();
  const timeOutRef = useRef<any>(null);

  useEffect(() => {
    if (router.query["minValue"] || router.query["maxValue"]) {
      const value = getValue();
      setMinValue(value.minValue);
      setMaxValue(value.maxValue);
    }
  }, []);

  useEffect(() => {
    setMinVal(defaultMinValue);
    setMaxVal(defaultMaxValue);
  }, [defaultMaxValue, defaultMinValue]);
  // Convert to percentage
  const getPercent = useCallback(
    (value) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );

  // Set width of the range to decrease from the left side
  useEffect(() => {
    if (maxValRef.current) {
      const minPercent = getPercent(minVal);
      const maxPercent = getPercent(+maxValRef.current.value); // Preceding with '+' converts the value from type string to type number

      if (range.current) {
        range.current.style.left = `${minPercent}%`;
        range.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [minVal, getPercent]);

  // Set width of the range to decrease from the right side
  useEffect(() => {
    if (minValRef.current) {
      const minPercent = getPercent(+minValRef.current.value);
      const maxPercent = getPercent(maxVal);

      if (range.current) {
        range.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [maxVal, getPercent]);

  // Get min and max values when their state changes
  useEffect(() => {
    if (timeOutRef.current) clearTimeout(timeOutRef.current);
    if (!hasValue) {
      if (minValue || maxValue) {
        timeOutRef.current = setTimeout(() => {
          onChange({ min: minValue, max: maxValue });
        }, 300);
      } else {
        timeOutRef.current = setTimeout(() => {
          onChange({ min: minVal, max: maxVal });
        }, 300);
      }
    }
  }, [hasValue]);

  return (
    <div className={`pb-7 ${className}`} style={{ width: `${props.width}` }}>
      {label ? <Label text={label} className={`${props.classNameLabel}`}></Label> : ""}

      {/* Thêm input nhập số cho min và max */}
      <div className="flex items-center justify-between mb-2">
        <input
          type="number"
          min={min}
          max={maxVal - 1}
          value={minVal}
          onChange={(e) => {
            let value = Number(e.target.value);
            if (value >= min && value <= maxVal - 1) {
              setMinVal(value);
              onChange && onChange({ min: value, max: maxVal });
            } else if (value < min) {
              setMinVal(min);
              onChange && onChange({ min: min, max: maxVal });
            } else if (value > maxVal - 1) {
              setMinVal(maxVal - 1);
              onChange && onChange({ min: maxVal - 1, max: maxVal });
            }
          }}
          className="w-20 px-2 py-1 border rounded"
        />
        {props.multi && (
          <input
            type="number"
            min={minVal + 1}
            max={max}
            value={maxVal}
            onChange={(e) => {
              let value = Number(e.target.value);
              if (value <= max && value >= minVal + 1) {
                setMaxVal(value);
                onChange && onChange({ min: minVal, max: value });
              } else if (value > max) {
                setMaxVal(max);
                onChange && onChange({ min: minVal, max: max });
              } else if (value < minVal + 1) {
                setMaxVal(minVal + 1);
                onChange && onChange({ min: minVal, max: minVal + 1 });
              }
            }}
            className="w-20 px-2 py-1 border rounded"
          />
        )}
      </div>

      <div className={`relative w-full mt-3 `}>
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          ref={minValRef}
          onMouseDown={() => setHasValue(true)}
          onMouseUp={() => setHasValue(false)}
          onChange={(event) => {
            if (minValue && maxValue) {
              const value = Math.min(+minValue, maxVal - 1);
              setMinVal(minValue);
              event.target.value = value.toString();
              setMaxValue(null);
              setMinValue(null);
            } else {
              const value = Math.min(+event.target.value, maxVal - 1);
              setMinVal(value);
              event.target.value = value.toString();
              setMaxValue(null);
              setMinValue(null);
            }
          }}
          className={classnames(`thumb w-full  thumb--zindex-3`, {
            "thumb--zindex-5": minVal > max - 100,
          })}
        />
        {props.multi && (
          <input
            style={style}
            type="range"
            min={min}
            max={max}
            value={maxVal}
            ref={maxValRef}
            onMouseDown={() => setHasValue(true)}
            onMouseUp={() => setHasValue(false)}
            onChange={(event) => {
              if (minValue && maxValue) {
                const value = Math.min(+maxValue, minVal + 1);
                setMaxVal(maxValue);
                event.target.value = value.toString();
                setMaxValue(null);
                setMinValue(null);
              } else {
                const value = Math.max(+event.target.value, minVal + 1);
                setMaxVal(value);
                event.target.value = value.toString();
                setMaxValue(null);
                setMinValue(null);
              }
            }}
            className={`w-full thumb thumb--zindex-4  `}
          />
        )}
      </div>

      <div style={style} className={`w-full slider_multi`}>
        <div className=" slider__track" />
        <div ref={range} className=" slider__range" />
        <div className={`slider__left-value ${props.classNameValue}`}>
          {parseNumber(minVal) + props.textValue}
        </div>
        <div className={`slider__right-value ${props.classNameValue}`}>
          {parseNumber(maxVal) + props.textValue}
        </div>
      </div>
    </div>
  );
};

MultiRangeSlider.propTypes = {
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MultiRangeSlider;
