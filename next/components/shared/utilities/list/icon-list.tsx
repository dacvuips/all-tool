import { ReactElement } from "react";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { Button } from "../form";

interface IconListItem {
  icon: ReactElement;
  label: string;
  value: string | number;
  className?: string;
  onClick?: () => void;
}

interface IconListProps {
  items: IconListItem[];
  direction?: "row" | "col";
  divider?: boolean;
  className?: string;
}

export const IconList = ({ items, direction, divider = true, className = "" }: IconListProps) => {
  const md = useScreen("md");
  const flexDirection = direction || (md ? "row" : "col");

  return (
    <div
      className={`flex items-start gap-2 ${divider ? "divide-x" : ""} ${
        flexDirection === "row" ? "flex-row" : "flex-col"
      } ${className}`}
    >
      {items.map((item, index) => (
        <Button
          key={index}
          className={`h-6 ${divider ? "pl-1.5" : ""} ${item.className || ""}`}
          text={`${item.label}: (${item.value})`}
          icon={item.icon}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
};
