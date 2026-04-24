import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

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

export interface PackageTransactionSnapshot {
  subscription?: string;
  videoCount?: number;
  videoLimit?: number;
  imageCount?: number;
  imageLimit?: number;
  requestCount?: number;
  requestLimit?: number;
  imageStreamCount?: number;
  videoStreamCount?: number;
  expiryPackageDate?: string;
}

export interface PackageTransaction extends BaseModel {
  customerId: string;
  customerCode?: string;
  type: PackageTransactionTypeEnum;
  before: PackageTransactionSnapshot;
  after: PackageTransactionSnapshot;
  description: string;
}

export class PackageTransactionRepository extends CrudRepository<PackageTransaction> {
  apiName: string = "PackageTransaction";
  displayName: string = t("giao dịch gói");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    customerId: String
    customerCode: String
    type: String
    description: String
    before {
      subscription
      videoCount
      videoLimit
      imageCount
      imageLimit
      requestCount
      requestLimit
      imageStreamCount
      videoStreamCount
      expiryPackageDate
    }
    after {
      subscription
      videoCount
      videoLimit
      imageCount
      imageLimit
      requestCount
      requestLimit
      imageStreamCount
      videoStreamCount
      expiryPackageDate
    }
  `);
  fullFragment: string = this.shortFragment;
}

export const packageTransactionService = new PackageTransactionRepository();
