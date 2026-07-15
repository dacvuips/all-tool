import { useTranslation } from "react-i18next";
import { HiOutlineCash } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Order } from "../../../../../lib/repo";
import { OrderSection } from "./order-section";
import { formatMoney } from "./order-ui-helpers";

interface OrderPaymentHistoryProps {
  order: Order;
}

export function OrderPaymentHistory({ order }: OrderPaymentHistoryProps) {
  const { t } = useTranslation();
  const { PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();

  if (!order?.paymentLogs || order.paymentLogs.length === 0) return null;

  return (
    <OrderSection title={t("Lịch sử thanh toán")} icon={<HiOutlineCash className="w-4 h-4" />}>
      <div className="overflow-y-auto space-y-2 max-h-64 text-xs">
        {order.paymentLogs.map((log, index) => (
          <div key={index} className="pb-3 border-b border-gray-100 last:pb-0 last:border-0">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">
                  {PAYMENT_STATUS_OPTIONS.find((opt) => opt.value === log.status)?.label ||
                    t(log.status)}
                </div>
                <div className="mt-0.5 text-gray-500">
                  {new Date(log.createdAt).toLocaleString("vi-VN")}
                </div>
                {log.note ? <div className="mt-1 text-gray-600">{log.note}</div> : null}
                {log.transactionId ? (
                  <div className="mt-1 font-mono text-gray-500 break-all">
                    {t("Mã giao dịch")}: {log.transactionId}
                  </div>
                ) : null}
              </div>
              {log.amount != null ? (
                <div className="font-semibold whitespace-nowrap text-primary">
                  {formatMoney(log.amount)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </OrderSection>
  );
}
