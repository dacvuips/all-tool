import { TimestampEntity } from "../../core";

/** Loại giao dịch credit */
export enum CreditTransactionTypeEnum {
  /** Trừ credit khi chạy node (run chuyển PROCESSING) */
  NODE_RUN_CHARGE = "NODE_RUN_CHARGE",
  /** Hoàn credit khi run FAILED */
  NODE_RUN_REFUND = "NODE_RUN_REFUND",
  /** Cộng credit khi đơn hàng nạp credit được thanh toán */
  ORDER_TOPUP = "ORDER_TOPUP",
  /** Trừ credit (hoàn lại) khi giao dịch bị void/huỷ sau khi đã cộng credit */
  ORDER_VOID = "ORDER_VOID",
  /** Cộng credit hoa hồng giới thiệu (10% giá đơn hàng) */
  REFERRAL_BONUS = "REFERRAL_BONUS",
}

export type ICreditTransaction = TimestampEntity & {
  /** Id khách hàng */
  customerId: string;
  /** Loại giao dịch */
  type: CreditTransactionTypeEnum;
  /** Số credit (luôn dương; CHARGE = trừ balance, REFUND = cộng balance) */
  amount: number;
  /** Số dư credit của customer sau giao dịch */
  balanceAfter: number;
  /** Id run (AiGenerationRun), chỉ dùng cho NODE_RUN_* */
  runId?: string;
  /** Id product (để báo cáo), chỉ dùng cho NODE_RUN_* */
  productId?: string;
  /** Id node (để báo cáo), chỉ dùng cho NODE_RUN_* */
  nodeId?: string;
  /** Id order dùng cho nạp credit */
  orderId?: string;
  /** Mô tả giao dịch */
  description: string;
  /** Id giao dịch CHARGE gốc (chỉ có khi type = NODE_RUN_REFUND) */
  refTransactionId?: string;
};
