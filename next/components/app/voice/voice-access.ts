import { CustomerStatusEnum } from "../../../lib/repo/types";
import { SubscriptionPlanEnum, type Customer } from "../../../lib/repo/customer/customer.repo";

const STANDARD_PLUS_PLANS = new Set<string>([
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.ENTERPRISE,
]);

export function customerIdOf(customer: Customer | null | undefined): string {
  return String(customer?.id || (customer as { _id?: string } | undefined)?._id || "").trim();
}

function planKeyOf(subscription?: string | null): string {
  return String(subscription || "")
    .trim()
    .toLowerCase();
}

export function isStandardPlusPlan(subscription?: string | null): boolean {
  return STANDARD_PLUS_PLANS.has(planKeyOf(subscription));
}

export function remainingTextCredit(count?: number, limit?: number): number {
  const used = Number(count) || 0;
  const cap = limit === undefined || limit === null ? 0 : Number(limit);
  if (cap === -1) return Number.POSITIVE_INFINITY;
  return Math.max(0, cap - used);
}

export function voiceCreateBlockReason(
  customer: Customer | null | undefined,
  marketplaceStopped: boolean
): string {
  if (!customerIdOf(customer)) return "Vui lòng đăng nhập để tạo giọng";
  const status = String(customer?.status || "").toUpperCase();
  if (status && status !== CustomerStatusEnum.ACTIVE) {
    return "Tài khoản bị khóa hoặc ngừng kích hoạt";
  }
  if (marketplaceStopped) {
    return "Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!";
  }
  if (!isStandardPlusPlan(customer?.googlePackage?.subscription)) {
    return "Chức năng tạo giọng chỉ dành cho gói Standard trở lên. Vui lòng nâng cấp gói.";
  }
  const count = customer?.googlePackage?.textCreditCount ?? 0;
  const limit = customer?.googlePackage?.textCreditLimit ?? 0;
  if (remainingTextCredit(count, limit) < 1) {
    return `Bạn đã hết Voice Credit (${count}/${limit === -1 ? "∞" : limit}). Vui lòng nâng cấp gói hoặc liên hệ admin.`;
  }
  return "";
}

export function canCreateVoice(
  customer: Customer | null | undefined,
  marketplaceStopped: boolean
): boolean {
  return !voiceCreateBlockReason(customer, marketplaceStopped);
}

/** Giọng miễn phí (free-gen-audio): chỉ cần đăng nhập — khớp backend authVoiceCustomer. */
export function freeVoiceCreateBlockReason(
  customer: Customer | null | undefined
): string {
  if (!customerIdOf(customer)) return "Vui lòng đăng nhập để tạo giọng";
  return "";
}
