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
function normalizePlaceholder(value: unknown): object | unknown[] {
  if (value === undefined || value === null) return {};
  if (typeof value === "object" && (Array.isArray(value) || (value !== null && value.constructor === Object))) {
    return value as object | unknown[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function JSONEditor({
  controlClassName = "form-control",
  className = "flex justify-center px-0 bg-gray-100",
  height = "500px",
  style = {},
  theme = "light_mitsuketa_tribute",
  ...props
}: JSONEditorProps) {
  const [value, setValue] = useState<any>(props.value);
  const onChange = (data: unknown) => {
    setValue(data);
    // Backend/GraphQL often expects JSON as string; stringify object so form stores string
    const output =
      typeof data === "object" && data !== null
        ? JSON.stringify(data)
        : typeof data === "string"
          ? data
          : "";
    if (props.onChange) props.onChange(output);
  };
  const placeholder = normalizePlaceholder(value ?? props.value);

  return (
    <div
      className={`${controlClassName} ${props.readOnly ? "readOnly" : ""} ${
        props.error ? "error" : ""
      } ${className}`}
      style={{ ...style }}
    >
      <JSONInput
        id={props.editorId}
        placeholder={placeholder}
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
