import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Order } from "../../../../../lib/repo";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";

interface OrderCustomerInfoProps {
  order: Order;
}

export function OrderCustomerInfo({ order }: OrderCustomerInfoProps) {
  const { t } = useTranslation();
  const customer = order?.customer;

  return (
    <OrderSection title={t("Thông tin khách hàng")} icon="fas fa-user">
      <div className="space-y-2 text-sm">
        <OrderInfoField
          label={t("Email")}
          value={
            order?.customerId && customer?.email ? (
              <Link
                href={`/admin/management/customers?id=${order.customerId}`}
                className="font-medium text-primary hover:underline break-all"
              >
                {customer.email}
              </Link>
            ) : (
              customer?.email || "-"
            )
          }
        />
        <OrderInfoField label={t("Tên khách hàng")} value={customer?.name || "-"} />
        <OrderInfoField label={t("Số điện thoại")} value={customer?.phoneNumber || "-"} />
      </div>
    </OrderSection>
  );
}
