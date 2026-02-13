import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface OrderSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function OrderSection({
  title,
  icon,
  children,
  className = "",
  sticky = false,
}: OrderSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={`overflow-hidden border rounded-lg ${className}`}>
      <h3
        className={`p-4 pb-2 text-base font-semibold bg-gray-50 border-b ${
          sticky ? "sticky top-0 z-10" : ""
        }`}
      >
        {icon && <i className={`${icon} text-primary mr-2`}></i>}
        {t(title)}
      </h3>
      <div className="p-2 pt-1">{children}</div>
    </div>
  );
}
