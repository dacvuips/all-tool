import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface OrderSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  sticky?: boolean;
  actions?: ReactNode;
}

export function OrderSection({
  title,
  icon,
  children,
  className = "",
  sticky = false,
  actions,
}: OrderSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={`overflow-hidden bg-white rounded-xl border border-gray-200 ${className}`}>
      <div
        className={`flex gap-2 justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100 ${
          sticky ? "sticky top-0 z-10" : ""
        }`}
      >
        <h3 className="flex gap-2 items-center text-sm font-semibold text-gray-800">
          {icon ? <span className="text-primary">{icon}</span> : null}
          {t(title)}
        </h3>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
