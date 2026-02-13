import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Order } from "../../../../../lib/repo";
import { OrderSection } from "./order-section";

interface OrderPaymentHistoryProps {
  order: Order;
}

export function OrderPaymentHistory({ order }: OrderPaymentHistoryProps) {
  const { t } = useTranslation();
  const { PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();

  if (!order?.paymentLogs || order.paymentLogs.length === 0) {
    return null;
  }

  return (
    <OrderSection title="Lịch sử thanh toán" icon="fas fa-history">
      <div className="space-y-2 text-xs overflow-y-auto max-h-64">
        {order.paymentLogs.map((log, index) => (
          <div key={index} className="pb-2 border-b last:border-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {PAYMENT_STATUS_OPTIONS.find((opt) => opt.value === log.status)?.label ||
                    t(log.status)}
                </div>
                <div className="text-gray-500">
                  {new Date(log.createdAt).toLocaleString("vi-VN")}
                </div>
                {log.note && <div className="mt-1 text-gray-600">{log.note}</div>}
                {log.transactionId && (
                  <div className="mt-1 text-gray-500">
                    {t("Mã giao dịch")}: {log.transactionId}
                  </div>
                )}
              </div>
              {log.amount && (
                <div className="ml-2 font-semibold text-primary">
                  {log.amount.toLocaleString()}đ
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </OrderSection>
  );
}
