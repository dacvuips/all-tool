import { useTranslation } from "react-i18next";
import { Order } from "../../../../../lib/repo";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";

interface OrderCustomerInfoProps {
  order: Order;
}

export function OrderCustomerInfo({ order }: OrderCustomerInfoProps) {
  const { t } = useTranslation();

  return (
    <OrderSection title={t("Thông tin khách hàng")} icon="fas fa-user">
      <div className="space-y-2 text-sm">
        <OrderInfoField label={t("Tên khách hàng")} value={order?.shippingAddress?.recipientName} />
        <OrderInfoField label={t("Số điện thoại")} value={order?.shippingAddress?.phone} />
        <OrderInfoField label={t("Email")} value={order?.shippingAddress?.email || "-"} />
      </div>
    </OrderSection>
  );
}
