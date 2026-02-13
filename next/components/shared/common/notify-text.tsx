import React from "react";
import { HiInformationCircle } from "react-icons/hi";

export function NotifyText({
  text,
  color = "bluegray",
  icon = <HiInformationCircle />,
  className,
  children,
  textClassName,
}: {
  text?: string;
  color?:
    | "bluegray"
    | "red"
    | "yellow"
    | "blue"
    | "gray"
    | "green"
    | "blue"
    | "indigo"
    | "purple"
    | "pink";
  icon?: any;
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div
        style={{ borderColor: color }}
        className={`flex flex-row border-l-2  items-start w-full p-2 rounded-lg bg-${color}-50 ${className}`}
      >
        <i className={`mr-1 text-${color}-700 text-20`}>{icon}</i>
        <span className={`text-${color}-700 lg:text-16 text-12 ${textClassName}`}>
          {text || children}
        </span>
      </div>
    </>
  );
}
