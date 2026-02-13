import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiClock, HiTruck, HiX } from "react-icons/hi";
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
  const iconMap: Record<OrderStatus, any> = {
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

const getStatusColor = (type: OrderStatus, isCancelled: boolean) => {
  if (isCancelled && type === OrderStatus.CANCELLED) {
    return "bg-red-500";
  }
  if (type === OrderStatus.CANCELLED) {
    return "bg-red-500";
  }
  return "bg-green-500";
};

export function OrderStatusTimeline({ order }: OrderStatusTimelineProps) {
  const { t } = useTranslation();
  const { ORDER_STATUS_OPTIONS } = useOptionsTranslation();
  // Chỉ hiển thị nếu có logs và logs không rỗng
  if (!order.orderLogs || order.orderLogs.length === 0) {
    return null;
  }

  // Sắp xếp logs theo thời gian giảm dần
  const sortedLogs = [...order.orderLogs].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  const timelineNodes: TimelineNode[] = sortedLogs.map((log) => ({
    status: log.status,
    des: log.des,
    note: log.note,
    date: new Date(log.createdAt),
  }));

  return (
    <OrderSection title="Lịch sử đơn hàng" sticky>
      <div className="overflow-y-auto max-h-64">
        <div className="relative pl-6">
          {/* Vertical Line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>

          {/* Timeline Nodes */}
          <div className="space-y-4">
            {timelineNodes.map((node, index) => {
              const Icon = getStatusIcon(node.status);
              const isLastNode = index === 0;
              const isCancelledNode = node.status === OrderStatus.CANCELLED;
              const colorClass = getStatusColor(node.status, isCancelledNode);

              return (
                <div key={index} className="relative flex items-start">
                  {/* Icon Circle */}
                  <div
                    className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full -ml-6 ${
                      isLastNode ? `${colorClass} ring-4 ring-opacity-30` : colorClass
                    } ${isLastNode && !isCancelledNode ? "ring-green-200" : ""} ${
                      isLastNode && isCancelledNode ? "ring-red-200" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2 ml-4">
                    <div
                      className={`text-xs font-semibold mb-1 ${
                        isCancelledNode ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {ORDER_STATUS_OPTIONS.find((opt) => opt.value === node.status)?.label ||
                        t(node.status)}
                    </div>
                    <div className="mb-1 text-xs text-gray-500">
                      {node.date.toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {node.des && (
                      <div className="mt-1 text-xs italic text-gray-600">
                        {t("Mô tả")}: {node.des}
                      </div>
                    )}
                    {node.note && (
                      <div className="mt-1 text-xs italic text-gray-600">
                        {t("Ghi chú")}: {node.note}
                      </div>
                    )}
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
