import { useTranslation } from "react-i18next";
import { HiOutlineCube } from "react-icons/hi";
import { Order } from "../../../../../lib/repo";
import { OrderSection } from "./order-section";
import { formatMoney, getOrderPackageTitle, getOrderTypeLabel } from "./order-ui-helpers";

interface OrderItemsListProps {
  order: Order;
}

export function OrderItemsList({ order }: OrderItemsListProps) {
  const { t } = useTranslation();
  const items = order?.items || [];

  if (items.length === 0) {
    return (
      <OrderSection title={t("Nội dung đơn")} icon={<HiOutlineCube className="w-4 h-4" />}>
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900">
              {getOrderPackageTitle(order)}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {t("Loại")}: {t(getOrderTypeLabel(order.type))}
              {order.subscriptionPlan ? (
                <>
                  {" · "}
                  {t("Gói")}: <span className="capitalize">{order.subscriptionPlan}</span>
                </>
              ) : null}
              {order.creditAmount != null ? (
                <>
                  {" · "}
                  Credit: {Number(order.creditAmount).toLocaleString("vi-VN")}
                </>
              ) : null}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500">{t("Thành tiền")}</div>
            <div className="text-lg font-bold text-primary">{formatMoney(order.totalAmount)}</div>
          </div>
        </div>
      </OrderSection>
    );
  }

  return (
    <OrderSection
      title={`${t("Danh sách sản phẩm")} (${items.length})`}
      icon={<HiOutlineCube className="w-4 h-4" />}
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs tracking-wide text-gray-500 uppercase border-b border-gray-100">
              <th className="px-3 py-2.5 font-semibold text-left">#</th>
              <th className="px-3 py-2.5 font-semibold text-left">{t("Sản phẩm")}</th>
              <th className="px-3 py-2.5 font-semibold text-center">{t("SL")}</th>
              <th className="px-3 py-2.5 font-semibold text-right">{t("Đơn giá")}</th>
              <th className="px-3 py-2.5 font-semibold text-right">{t("Thành tiền")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80">
                <td className="px-3 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-3 items-center min-w-0">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.productName}
                        className="object-cover w-12 h-12 rounded-lg border border-gray-200 shrink-0"
                      />
                    ) : null}
                    <div className="font-medium text-gray-900 truncate">
                      {item.productName || "-"}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">{item.quantity ?? 0}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="font-medium">{formatMoney(item.price)}</div>
                  {item.originalPrice != null && item.originalPrice > (item.price ?? 0) ? (
                    <div className="text-xs text-gray-400 line-through">
                      {formatMoney(item.originalPrice)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-semibold text-right whitespace-nowrap">
                  {formatMoney(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OrderSection>
  );
}
