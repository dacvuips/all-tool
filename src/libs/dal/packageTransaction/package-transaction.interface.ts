import { TimestampEntity } from "../../core";

/** Loại giao dịch Package */
export enum PackageTransactionTypeEnum {
  /** Reset count hàng ngày (gói còn hạn) */
  DAILY_RESET_COUNT = "DAILY_RESET_COUNT",
  /** Hạ xuống Free do hết hạn gói */
  EXPIRED_DOWNGRADE = "EXPIRED_DOWNGRADE",
  /** Thanh toán gói (mua/gia hạn) */
  PAYMENT = "PAYMENT",
  /** Hệ thống điều chỉnh thủ công */
  MANUAL_ADJUST = "MANUAL_ADJUST",
}

export type PackageTransactionSnapshot = {
  subscription?: string;
  videoCount?: number;
  videoLimit?: number;
  imageCount?: number;
  imageLimit?: number;
  requestCount?: number;
  requestLimit?: number;
  imageStreamCount?: number;
  videoStreamCount?: number;
  expiryPackageDate?: Date;
};

export type IPackageTransaction = TimestampEntity & {
  /** Id khách hàng */
  customerId: string;
  /** Mã khách hàng */
  customerCode?: string;
  /** Loại giao dịch */
  type: PackageTransactionTypeEnum;
  /** Snapshot trước khi thay đổi */
  before: PackageTransactionSnapshot;
  /** Snapshot sau khi thay đổi */
  after: PackageTransactionSnapshot;
  /** Mô tả giao dịch */
  description: string;
};
