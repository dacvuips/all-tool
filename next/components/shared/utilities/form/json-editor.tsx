import { useState } from "react";
import JSONInput from "react-json-editor-ajrm";
import locale from "react-json-editor-ajrm/locale/en";

export type JSONEditorProps = FormControlProps & {
  editorId?: string;
  height?: string;
  theme?:
    | "dark_vscode_tribute"
    | "light_mitsuketa_tribute"
    | "dark_vscode"
    | "light_mitsuketa"
    | "dark_vs"
    | "light_vs"
    | "dark_vs2015"
    | "light_vs2015"
    | "html"
    | "default";
};
export function JSONEditor({
  controlClassName = "form-control",
  className = "flex justify-center px-0 bg-gray-100",
  height = "500px",
  style = {},
  theme = "light_mitsuketa_tribute",
  ...props
}: JSONEditorProps) {
  const [value, setValue] = useState<any>(props.value);
  const onChange = (data) => {
    setValue(data);
    if (props.onChange) props.onChange(data);
  };

  return (
    <div
      className={`${controlClassName} ${props.readOnly ? "readOnly" : ""} ${
        props.error ? "error" : ""
      } ${className}`}
      style={{ ...style }}
    >
      <JSONInput
        id={props.editorId}
        placeholder={value}
        locale={locale}
        theme={theme}
        height={height || "300px"}
        viewOnly={props.readOnly}
        onBlur={(event) => {
          onChange(event.jsObject);
        }}
        onChange={(event) => {
          onChange(event.jsObject);
        }}
      />
    </div>
  );
}
