import { TimestampEntity } from "../../core";

export type IBank = TimestampEntity & {
  method?: PaymentMethodEnum; // Phương thức thanh toán
  bankImage?: string; // Ảnh ngân hàng
  bankCode?: string; // Mã ngân hàng
  bankName?: string; // Tên ngân hàng
  accountNumber?: string; // Số tài khoản
  accountName?: string; // Tên chủ tài khoản
  bin?: string; // Mã bin ngân hàng
  status?: boolean; // Trạng thái
};
export enum PaymentMethodEnum {
  COD = "COD",
  BANK = "BANK",
  MOMO = "MOMO",
  ZALO_PAY = "ZALO_PAY",
  CREDIT_CARD = "CREDIT_CARD",
}
