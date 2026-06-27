import { Order, PaymentStatus } from "../../../../lib/repo/order/order.repo";

/** Query param on /checkout */
export type CheckoutUrlType = "tool" | "recaptcha" | "api-media" | "normal";

export type SubscriptionOrderType = "TOOL" | "RECAPTCHA" | "API_MEDIA" | "NORMAL";

export function parseCheckoutUrlType(value: string | undefined): CheckoutUrlType | null {
  if (value === "recaptcha" || value === "api-media" || value === "normal" || value === "tool") {
    return value;
  }
  return null;
}

export function checkoutUrlTypeToOrderType(urlType: CheckoutUrlType): SubscriptionOrderType {
  switch (urlType) {
    case "recaptcha":
      return "RECAPTCHA";
    case "api-media":
      return "API_MEDIA";
    case "normal":
      return "NORMAL";
    default:
      return "TOOL";
  }
}

export function orderTypeToCheckoutUrlType(
  orderType?: SubscriptionOrderType | string
): CheckoutUrlType {
  switch (orderType) {
    case "RECAPTCHA":
      return "recaptcha";
    case "API_MEDIA":
      return "api-media";
    case "NORMAL":
      return "normal";
    default:
      return "tool";
  }
}

/** Subscription SePay PG — không gồm `normal` (dùng createNormalSePayPGCheckout). */
export type SubscriptionCheckoutUrlType = Exclude<CheckoutUrlType, "normal">;

export function orderTypeToSubscriptionCheckoutUrlType(
  orderType?: SubscriptionOrderType | string
): SubscriptionCheckoutUrlType {
  const urlType = orderTypeToCheckoutUrlType(orderType);
  return urlType === "normal" ? "tool" : urlType;
}

export function checkoutTypeQueryParam(orderType?: SubscriptionOrderType | string): string {
  return `?type=${orderTypeToCheckoutUrlType(orderType)}`;
}

/** Trang đích sau thanh toán thành công */
export function getPostPaymentSuccessPath(orderType?: SubscriptionOrderType | string): string {
  switch (orderType) {
    case "NORMAL":
      return "/";
    case "API_MEDIA":
      return "/api-generate-media";
    case "RECAPTCHA":
      return "/recaptcha";
    default:
      return "/profile/orders-buy";
  }
}

/** Nhãn hiển thị loại đơn (dùng trong cảnh báo xung đột) */
export function getOrderTypeLabel(
  orderType: SubscriptionOrderType | string | undefined,
  t: (key: string) => string
): string {
  switch (orderType) {
    case "API_MEDIA":
      return t("Gói API Media");
    case "RECAPTCHA":
      return t("Gói reCAPTCHA");
    case "NORMAL":
      return t("Nạp mPoint");
    default:
      return t("Gói công cụ");
  }
}

export function isPendingOrder(order: Order | null | undefined): boolean {
  return order?.paymentStatus === PaymentStatus.PAYMENT_PENDING;
}

/**
 * URL yêu cầu loại checkout cụ thể nhưng đơn pending khác loại → cần chặn / cảnh báo.
 */
export function hasCheckoutTypeMismatch(
  order: Order | null | undefined,
  explicitUrlType: string | undefined
): boolean {
  if (!order || !isPendingOrder(order)) return false;
  const parsed = parseCheckoutUrlType(explicitUrlType);
  if (!parsed) return false;
  return order.type !== checkoutUrlTypeToOrderType(parsed);
}
