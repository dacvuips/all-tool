import { useTranslation } from "react-i18next";
import { Order } from "../../../../../lib/repo";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";

interface OrderShippingInfoProps {
  order: Order;
}

export function OrderShippingInfo({ order }: OrderShippingInfoProps) {
  const { t } = useTranslation();
  const address = `${order?.shippingAddress?.address}
              ${order?.shippingAddress?.ward && `, ${order.shippingAddress.ward}`}
              ${order?.shippingAddress?.district && `, ${order.shippingAddress.district}`}
              ${order?.shippingAddress?.province && `, ${order.shippingAddress.province}`}`;

  return (
    <OrderSection title="Thông tin giao hàng" icon="fas fa-truck">
      <div className="space-y-2 text-sm">
        <OrderInfoField
          label={t("Địa chỉ")}
          value={address}
        />
        <OrderInfoField label={t("Loại đơn")} value="online" />
        <OrderInfoField label={t("Ghi chú")} value={order?.shippingAddress?.note || "-"} />
      </div>
    </OrderSection>
  );
}
