import { useEffect, useRef, MutableRefObject, useState, StyleHTMLAttributes, useMemo } from "react";

export interface TextareaProps extends FormControlProps {
  rows?: number;
  maxRows?: number;
}
export function Textarea({
  controlClassName = "form-control",
  className = "",
  rows = 2,
  style = {},
  ...props
}: TextareaProps) {
  const ref: MutableRefObject<HTMLTextAreaElement> = useRef();
  const [value, setValue] = useState(undefined);
  const textareaStyle = useMemo(
    () => ({
      width: "calc(100% - 26px)",
      minHeight: rows ? rows * 24 : undefined,
      maxHeight: props.maxRows ? props.maxRows * 24 : undefined,
      ...style,
    }),
    [style, rows, props.maxRows]
  );

  useEffect(() => {
    if (props.value !== undefined) {
      if (props.value !== value) {
        setValue(props.value || getDefaultValue({}));
      }
    } else {
      setValue(getDefaultValue({}));
    }
  }, [props.value]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = ref.current.scrollHeight - 16 + "px";
  }, [value]);

  const onChange = (data) => {
    setValue(data);
    if (props.onChange) props.onChange(data);
  };

  return (
    <>
      <textarea
        tabIndex={props.noFocus && -1}
        ref={ref}
        rows={rows}
        id={props.id}
        className={`${controlClassName} outline-none box-content py-2 ${
          props.error ? "error" : ""
        } ${className}`}
        style={textareaStyle}
        name={props.name}
        readOnly={props.readOnly}
        value={value}
        placeholder={props.placeholder}
        onChange={(e) => onChange(e.target.value)}
      ></textarea>
    </>
  );
}

const getDefaultValue = (props: TextareaProps) => {
  return "";
};

Textarea.getDefaultValue = getDefaultValue;
