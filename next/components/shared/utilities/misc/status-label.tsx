interface Props extends ReactProps {
  options?: Option[];
  value: any;
  label?: string;
  type?: StatusLabelType;
  extraClassName?: string;
}
export type StatusLabelType = "label" | "text" | "light"|"border-light";
export function StatusLabel({
  value,
  options,
  type = "label",
  className = "px-2 py-1 text-xs font-semibold uppercase rounded-full whitespace-nowrap",
  extraClassName = "",
  style = {},
  ...props
}: Props) {
  const option = options?.find((x) => x.value == value);
  const color = option?.color || "bluegray";
  const label = props.label || option?.label || "Không có";
  return (
    <span
      className={`${className} ${extraClassName} ${
        type == "label" ? `text-white` : `text-${color}`
      } ${
        type == "label" ? `bg-${color}` : type == "light" ? `bg-${color}-light` : type == "border-light" ? `border-${color} border bg-${color}-light` : "bg-transparent"
      }`}
      style={style}
    >
      {label}
    </span>
  );
}
