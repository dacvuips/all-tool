import { useTranslation } from "react-i18next";
import { HiOutlineDocumentText } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Order } from "../../../../../lib/repo";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";
import { formatMoney, getOrderTypeLabel } from "./order-ui-helpers";

interface OrderShippingInfoProps {
  order: Order;
}

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
    <OrderSection title={t("Thông tin đơn")} icon={<HiOutlineDocumentText className="w-4 h-4" />}>
      <div className="space-y-3 text-sm">
        <OrderInfoField label={t("Loại đơn")} value={t(getOrderTypeLabel(order?.type))} />
        <OrderInfoField
          label={t("Gói")}
          value={
            order?.subscriptionPlan ? (
              <span className="capitalize">{order.subscriptionPlan}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )
          }
        />
        <OrderInfoField label={t("Phương thức thanh toán")} value={method} />
        {order?.creditAmount != null ? (
          <OrderInfoField label={t("Số credit")} value={formatMoney(order.creditAmount)} />
        ) : null}
        <OrderInfoField
          label={t("Ghi chú khách")}
          value={order?.customerNote || <span className="text-gray-400">-</span>}
        />
        <OrderInfoField
          label={t("Ghi chú admin")}
          value={order?.adminNote || <span className="text-gray-400">-</span>}
        />
      </div>
    </OrderSection>
  );
}
