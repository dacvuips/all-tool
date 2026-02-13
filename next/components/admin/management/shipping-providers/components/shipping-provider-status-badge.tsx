import { useTranslation } from "react-i18next";

/**
 * Component hiển thị badge trạng thái của nhà cung cấp vận chuyển
 * @param isActive - Trạng thái hoạt động của nhà cung cấp
 */
interface ShippingProviderStatusBadgeProps {
  isActive: boolean;
}

export function ShippingProviderStatusBadge({ isActive }: ShippingProviderStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
      }`}
    >
      {isActive ? t("Hoạt động") : t("Không hoạt động")}
    </span>
  );
}
