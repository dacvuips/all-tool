import { TimestampEntity } from "../../core";

export type WalletTimes = {
  lastIn: Date; // Lần nạp cuối
  lastOut: Date; // Lần rút cuối
  lastLocked: Date; // Lần khóa mPoint cuối
};

export type IWallet = TimestampEntity & {
  ownerId: string; // Mã tài khoản
  balance: number; // Số dư mPoint
  totalIn: number; // Tổng mPoint đã nạp
  totalOut: number; // Tổng mPoint đã rút
  times: WalletTimes;
  isLocked: boolean; // mPoint đã bị khóa
  transactionNoun: number; // Số lần giao dịch
};
