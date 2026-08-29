import { CustomerStatusEnum } from "../../lib/repo/types";
import type { Customer } from "../../lib/repo/customer/customer.repo";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import {
  customerIdOf,
  isStandardPlusPlan,
  remainingTextCredit,
} from "../app/voice/voice-access";

/** Gói Basic / trial / free / chưa mua → chặn tính năng Film. */
export function filmFeatureBlockReason(
  customer: Customer | null | undefined,
  marketplaceStopped: boolean
): string {
  if (!customerIdOf(customer)) {
    return "Vui lòng đăng nhập để sử dụng Film";
  }
  const status = String(customer?.status || "").toUpperCase();
  if (status && status !== CustomerStatusEnum.ACTIVE) {
    return "Tài khoản bị khóa hoặc ngừng kích hoạt";
  }
  if (marketplaceStopped) {
    return "Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!";
  }
  if (!isStandardPlusPlan(customer?.googlePackage?.subscription)) {
    return "Chức năng Film chỉ dành cho gói Standard trở lên. Vui lòng nâng cấp gói.";
  }
  return "";
}

export function canUseFilmFeatures(
  customer: Customer | null | undefined,
  marketplaceStopped: boolean
): boolean {
  return !filmFeatureBlockReason(customer, marketplaceStopped);
}

/** Tạo giọng trong Film: Standard+; giọng thu phí thêm kiểm tra Voice Credit. */
export function filmDialogueVoiceBlockReason(
  customer: Customer | null | undefined,
  marketplaceStopped: boolean,
  voiceId: string
): string {
  const base = filmFeatureBlockReason(customer, marketplaceStopped);
  if (base) return base;
  if (isFreeGenAudioVoiceId(voiceId)) return "";
  const count = customer?.googlePackage?.textCreditCount ?? 0;
  const limit = customer?.googlePackage?.textCreditLimit ?? 0;
  if (remainingTextCredit(count, limit) < 1) {
    return `Bạn đã hết Voice Credit (${count}/${limit === -1 ? "∞" : limit}). Vui lòng nâng cấp gói hoặc liên hệ admin.`;
  }
  return "";
}
