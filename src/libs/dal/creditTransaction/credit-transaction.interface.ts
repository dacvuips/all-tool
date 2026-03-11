import { TimestampEntity } from "../../core";

/** Loại giao dịch credit */
export enum CreditTransactionTypeEnum {
  /** Trừ credit khi chạy node (run chuyển PROCESSING) */
  NODE_RUN_CHARGE = "NODE_RUN_CHARGE",
  /** Hoàn credit khi run FAILED */
  NODE_RUN_REFUND = "NODE_RUN_REFUND",
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
  /** Id run (AiGenerationRun) */
  runId: string;
  /** Id product (để báo cáo) */
  productId: string;
  /** Id node (để báo cáo) */
  nodeId: string;
  /** Mô tả giao dịch */
  description: string;
  /** Id giao dịch CHARGE gốc (chỉ có khi type = NODE_RUN_REFUND) */
  refTransactionId?: string;
};
