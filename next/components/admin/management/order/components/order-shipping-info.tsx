import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Order } from "../../../../../lib/repo";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";

interface OrderShippingInfoProps {
  order: Order;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  TOOL: "Tool",
  RECAPTCHA: "Recaptcha",
  API_MEDIA: "API Media",
  NORMAL: "Thường",
};

/** Thông tin gói / loại đơn — đơn hệ thống không có địa chỉ giao hàng vật lý. */
export function OrderShippingInfo({ order }: OrderShippingInfoProps) {
  const { t } = useTranslation();
  const { PAYMENT_METHOD_OPTIONS } = useOptionsTranslation();
  const method =
    PAYMENT_METHOD_OPTIONS.find(
      (o) => o.value === (order?.paymentInfo?.method || order?.paymentMethod)
    )?.label ||
    order?.paymentInfo?.method ||
    order?.paymentMethod ||
    "-";

  return (
    <OrderSection title={t("Thông tin đơn")} icon="fas fa-info-circle">
      <div className="space-y-2 text-sm">
        <OrderInfoField
          label={t("Loại đơn")}
          value={order?.type ? t(ORDER_TYPE_LABELS[order.type] || order.type) : "-"}
        />
        <OrderInfoField
          label={t("Gói")}
          value={order?.subscriptionPlan ? String(order.subscriptionPlan) : "-"}
        />
        <OrderInfoField label={t("Phương thức thanh toán")} value={method} />
        {order?.creditAmount != null ? (
          <OrderInfoField
            label={t("Số credit")}
            value={Number(order.creditAmount).toLocaleString("vi-VN")}
          />
        ) : null}
        <OrderInfoField label={t("Ghi chú khách")} value={order?.customerNote || "-"} />
        <OrderInfoField label={t("Ghi chú admin")} value={order?.adminNote || "-"} />
      </div>
    </OrderSection>
  );
}
