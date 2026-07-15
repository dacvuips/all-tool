import Link from "next/link";
import { useTranslation } from "react-i18next";
import { HiOutlineMail, HiOutlinePhone, HiOutlineUser } from "react-icons/hi";
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
    <OrderSection title={t("Khách hàng")} icon={<HiOutlineUser className="w-4 h-4" />}>
      <div className="space-y-3 text-sm">
        <OrderInfoField
          label={t("Email")}
          value={
            order?.customerId && customer?.email ? (
              <Link
                href={`/admin/management/customers?id=${order.customerId}`}
                className="inline-flex gap-1.5 items-center font-medium text-primary hover:underline break-all"
              >
                <HiOutlineMail className="w-3.5 h-3.5 shrink-0" />
                {customer.email}
              </Link>
            ) : (
              <span className="text-gray-400">{customer?.email || "-"}</span>
            )
          }
        />
        <OrderInfoField
          label={t("Tên khách hàng")}
          value={customer?.name || <span className="text-gray-400">-</span>}
        />
        <OrderInfoField
          label={t("Số điện thoại")}
          value={
            customer?.phoneNumber ? (
              <span className="inline-flex gap-1.5 items-center">
                <HiOutlinePhone className="w-3.5 h-3.5 text-gray-400" />
                {customer.phoneNumber}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )
          }
        />
      </div>
    </OrderSection>
  );
}
