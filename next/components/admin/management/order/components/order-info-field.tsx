import { ReactNode } from "react";

interface OrderInfoFieldProps {
  label: string;
  value: ReactNode;
  layout?: "stacked" | "horizontal";
  labelClassName?: string;
  valueClassName?: string;
}

export function OrderInfoField({
  label,
  value,
  layout = "stacked",
  labelClassName = "",
  valueClassName = "",
}: OrderInfoFieldProps) {
  if (layout === "horizontal") {
    return (
      <div className="flex justify-between">
        <span className={`text-gray-600 ${labelClassName}`}>{label}:</span>
        <span className={`font-medium ${valueClassName}`}>{value}</span>
      </div>
    );
  }

  return (
    <div>
      <div className={`text-xs text-gray-600 ${labelClassName}`}>{label}</div>
      <div className={`font-medium ${valueClassName}`}>{value}</div>
    </div>
  );
}
