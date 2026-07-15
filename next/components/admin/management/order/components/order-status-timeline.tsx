import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiClock, HiOutlineClipboardList, HiTruck, HiX } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Order, OrderStatus } from "../../../../../lib/repo";
import { OrderSection } from "./order-section";

interface OrderStatusTimelineProps {
  order: Order;
}

interface TimelineNode {
  status: OrderStatus;
  des?: string;
  note?: string;
  date: Date;
}

const getStatusIcon = (type: OrderStatus) => {
  const iconMap: Partial<Record<OrderStatus, any>> = {
    [OrderStatus.CREATED]: HiClock,
    [OrderStatus.CONFIRMED]: HiCheckCircle,
    [OrderStatus.STATUS_CHANGED]: HiCheckCircle,
    [OrderStatus.PAYMENT_UPDATED]: HiClock,
    [OrderStatus.PAYMENT_CONFIRMED]: HiCheckCircle,
    [OrderStatus.SHIPPING_STARTED]: HiTruck,
    [OrderStatus.DELIVERED]: HiCheckCircle,
    [OrderStatus.CANCELLED]: HiX,
    [OrderStatus.PROCESSING]: HiTruck,
    [OrderStatus.ORDER_UPDATED]: HiCheckCircle,
  };

  return iconMap[type] || HiCheckCircle;
};

export function OrderStatusTimeline({ order }: OrderStatusTimelineProps) {
  const { t } = useTranslation();
  const { ORDER_STATUS_OPTIONS } = useOptionsTranslation();
  if (!order.orderLogs || order.orderLogs.length === 0) return null;

  const sortedLogs = [...order.orderLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const timelineNodes: TimelineNode[] = sortedLogs.map((log) => ({
    status: log.status,
    des: log.des,
    note: log.note,
    date: new Date(log.createdAt),
  }));

  return (
    <OrderSection
      title={t("Lịch sử đơn hàng")}
      icon={<HiOutlineClipboardList className="w-4 h-4" />}
      sticky
    >
      <div className="overflow-y-auto max-h-64">
        <div className="relative pl-6">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {timelineNodes.map((node, index) => {
              const Icon = getStatusIcon(node.status);
              const isLastNode = index === 0;
              const isCancelledNode = node.status === OrderStatus.CANCELLED;
              const colorClass = isCancelledNode ? "bg-rose-500" : "bg-emerald-500";

              return (
                <div key={index} className="relative flex items-start">
                  <div
                    className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full -ml-6 ${colorClass} ${
                      isLastNode ? "ring-4" : ""
                    } ${isLastNode && !isCancelledNode ? "ring-emerald-100" : ""} ${
                      isLastNode && isCancelledNode ? "ring-rose-100" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 pb-1 ml-4">
                    <div
                      className={`mb-0.5 text-xs font-semibold ${
                        isCancelledNode ? "text-rose-600" : "text-gray-900"
                      }`}
                    >
                      {ORDER_STATUS_OPTIONS.find((opt) => opt.value === node.status)?.label ||
                        t(node.status)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {node.date.toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {node.des ? <div className="mt-1 text-xs text-gray-600">{node.des}</div> : null}
                    {node.note ? (
                      <div className="mt-1 text-xs text-gray-500">
                        {t("Ghi chú")}: {node.note}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </OrderSection>
  );
}
