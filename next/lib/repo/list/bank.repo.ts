import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { PaymentMethodEnum } from "../types";

export interface Bank extends BaseModel {
  method?: PaymentMethodEnum; // Phương thức thanh toán
  bankImage?: string; // Ảnh ngân hàng
  bankCode?: string; // Mã ngân hàng
  bankName?: string; // Tên ngân hàng
  accountNumber?: string; // Số tài khoản
  accountName?: string; // Tên chủ tài khoản
  bin?: string; // Mã bin ngân hàng
  status?: boolean; // Trạng thái
}
export class BankRepository extends CrudRepository<Bank> {
  apiName: string = "Bank";
  displayName: string = t("ngân hàng");
  shortFragment: string = this.parseFragment(`
  id: String
  createdAt: DateTime
  updatedAt: DateTime

  method: String
  bankImage: String
  bankCode: String
  bankName: String
  accountNumber: String
  accountName: String
  bin:String
  status:Boolean
  `);
  fullFragment: string = this.parseFragment(`
  id: String
  createdAt: DateTime
  updatedAt: DateTime

  method: String
  bankImage: String
  bankCode: String
  bankName: String
  accountNumber: String
  accountName: String
  bin:String
  status:Boolean
  `);

  async getBankVietQR(): Promise<any> {
    return this.query({
      query: `getBankVietQR`,
    }).then((res) => res.data.g0);
  }
}

export const BankService = new BankRepository();
