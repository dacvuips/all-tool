import { useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";

interface SwitchProps extends FormControlProps {
  /** Kích thước nhỏ hơn (dùng trong bảng) */
  size?: "sm" | "md";
}
export function Switch({
  controlClassName = "form-switch",
  className = "",
  style = {},
  dependent = false,
  size = "md",
  ...props
}: SwitchProps) {
  const [value, setValue] = useState<boolean>(props.value || getDefaultValue({}));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value || getDefaultValue({}));
    } else {
      setValue(getDefaultValue({}));
    }
  }, [props.value]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (props.readOnly || loading) return;

    let newVal = !(dependent ? props.value : value);
    setValue(newVal);
    if (props.onChange) {
      setLoading(true);
      try {
        await props.onChange(newVal);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className={`${controlClassName} cursor-pointer ${props.error ? "error" : ""} ${className} ${
        props.readOnly ? "readOnly" : ""
      } ${size === "sm" ? "is-sm" : ""}`}
      style={{ ...style }}
      onClick={toggle}
    >
      <span
        className={`switch flex-shrink-0 flex-grow-0 self-start ${
          size === "sm" ? "mt-0" : "mt-2"
        }`}
      >
        <input
          type="checkbox"
          value={dependent ? props.value : value || false}
          checked={dependent ? props.value : value}
          name={props.name}
          readOnly={props.readOnly}
          onChange={() => {}}
        />
        <span className="slider round">
          <i
            className="absolute w-5 h-5 left-0.5 flex-center text-gray-400"
            style={{ bottom: 3, transition: "0.4s", opacity: loading ? 1 : 0 }}
          >
            {loading && <CgSpinner className="text-lg animate-spin" />}
          </i>
        </span>
      </span>
      {props.placeholder && <span className="px-2 switch-text">{props.placeholder}</span>}
    </div>
  );
}

const getDefaultValue = (props: SwitchProps) => {
  return false;
};

Switch.getDefaultValue = getDefaultValue;
