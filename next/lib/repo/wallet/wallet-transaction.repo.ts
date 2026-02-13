import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions } from "../crud.repo";
import { User } from "../general";
import {
  WalletTransactionSideEnum,
  WalletTransactionTypeEnum,
  WalletTranscationStatusEnum,
} from "../types";

export interface WalletTransaction extends BaseModel {
  code?: string; // Mã giao dịch
  walletId?: string; // Mã mPoint
  ownerId?: string; // Mã tài khoản
  side?: WalletTransactionSideEnum; // Hướng giao dịch
  type?: WalletTransactionTypeEnum; // Loại giao dịch
  amount?: number; // Số tiền giao dịch
  balance?: number; // Số dư mPoint sau khi giao dịch
  description?: string; // Mô tả giao dịch
  status?: WalletTranscationStatusEnum; // Trạng thái giao dịch
  failedReason?: string; // Lý do thất bại
  transactionNoun?: number; // Số lần giao dịch
  specificInfo?: any[];
  tranferFromUser?: any;
  ownerCustomer?: User;
  ownerUser?: User;
}
export class WalletTransactionRepository extends CrudRepository<WalletTransaction> {
  apiName: string = "WalletTransaction";
  displayName: string = t("giao dịch mpoint");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    code: String
    walletId: String
    ownerId: String
    ownerCustomer{name }
    ownerUser{name }
    side: String
    type: String
    amount: Float
    balance: Float
    description: String
    status: String
    failedReason: String
    transactionNoun: Int
    specificInfo:Mixed
    tranferFromUser:Mixed
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    code: String
    walletId: String
    ownerId: String
    side: String
    type: String
    amount: Float
    balance: Float
    description: String
    status: String
    failedReason: String
    transactionNoun: Int
  `);
  async getTransactions(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getWalletTransactions",
    });
  }
}

export const WalletTransactionService = new WalletTransactionRepository();
