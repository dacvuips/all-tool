import { TimestampEntity } from "../../core";
import { TrendingTypeEnum } from "../trending/trending.interface";

/** Trạng thái đơn mua trending item */
export enum TrendingPurchaseOrderStatusEnum {
  /** Đã thanh toán – customer được dùng mãi (one-time purchase) */
  PAID = "PAID",
  /** Admin đã hoàn tiền / thu hồi quyền sử dụng */
  REFUNDED = "REFUNDED",
}

export type ITrendingPurchaseOrder = TimestampEntity & {
  /** ID khách hàng mua */
  customerId: string;
  /** ID trending item được mua */
  trendingId: string;
  /** Loại item tại thời điểm mua (PROMPT / CHATBOT / FLOW_APP / AI_STUDIO_APP) */
  trendingType: TrendingTypeEnum;
  /** Giá snapshot tại thời điểm mua (VND / mPoint) */
  price: number;
  /** Tên item snapshot tại thời điểm mua */
  itemName: string;
  /** ID giao dịch trừ mPoint (null nếu miễn phí) */
  walletTransactionId?: string;
  /** Trạng thái đơn */
  status: TrendingPurchaseOrderStatusEnum;
  /** Thời điểm thanh toán thành công */
  paidAt?: Date;
  /** Thời điểm admin hoàn tiền */
  refundedAt?: Date;
  /** Lý do hoàn tiền (admin ghi chú) */
  refundReason?: string;
  /** ID admin thực hiện hoàn tiền */
  refundedByUserId?: string;
};
