import { Order } from "../../../../../lib/repo";

export const ORDER_TYPE_LABELS: Record<string, string> = {
  TOOL: "Tool",
  RECAPTCHA: "Recaptcha",
  API_MEDIA: "API Media",
  NORMAL: "Thường",
};

export function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "0đ";
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

export function getOrderTypeLabel(type?: string | null) {
  if (!type) return "-";
  return ORDER_TYPE_LABELS[type] || type;
}

export function getOrderPackageTitle(order: Order) {
  const type = getOrderTypeLabel(order.type);
  const plan = order.subscriptionPlan ? String(order.subscriptionPlan) : "";
  if (type !== "-" && plan) return `${type} · ${plan}`;
  if (plan) return plan;
  if (type !== "-") return type;
  return "Đơn hàng";
}
