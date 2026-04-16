import { TimestampEntity } from "../../core";

export enum WalletTransactionTypeEnum {
  DEPOSIT = "DEPOSIT", // Nạp tiền
  WITHDRAW = "WITHDRAW", // Rút tiền
  EXCHANGE_FEE = "EXCHANGE_FEE", // Phí giao dịch
  ADJUST_BALANCE = "ADJUST_BALANCE", // Cân chỉnh số dư
  MANAGE_COST = "MANAGE_COST", // Phí quản lý
  MANAGE_COMMISSION = "MANAGE_COMMISSION", // Hoa hồng quản lý

  BUY_UTILITIES_CUSTOMER = "BUY_UTILITIES_CUSTOMER", // Mua tiện ích khách hàng
  BUY_UTILITIES_SHOP = "BUY_UTILITIES_SHOP", // Mua tiện ích cửa hàng
  EXCHANGE_GAME_CARD = "EXCHANGE_GAME_CARD", // Đổi thẻ GAME
  INTRODUCE = "INTRODUCE", // Giới thiệu khách hàng
  AFFILIATE_ORDER = "AFFILIATE_ORDER", // Đơn hàng affiliate
  DEPOSIT_WITH_PAYPAL = "DEPOSIT_WITH_PAYPA", // Nạp tiền vào ví với paypal
  BUY_PACKAGE = "BUY_PACKAGE", // Mua gói / Nạp tiền từ đơn hàng
}

export enum WalletTransactionSideEnum {
  IN = "IN", // Giao dịch vào mPoint
  OUT = "OUT", // Giao dịch ra mPoint
}

export enum WalletTranscationStatusEnum {
  PENDING = "PENDING", // Đang chờ xử lý
  SUCCESS = "SUCCESS", // Thành công
  FAILED = "FAILED", // Thất bại
}

export enum WalletInfoKeyEnum {
  DEPOSIT_USER_ID = "DEPOSIT_USER_ID", // Người nạp tiền
  WITHDRAW_USER_ID = "WITHDRAW_USER_ID", // Người rút tiền
  EXCHANGE_ORDER_ID = "EXCHANGE_ORDER_ID", // Mã giao dịch trên hệ thống giao dịch
  CASSO_PAYMENT_INFO = "CASSO_PAYMENT_INFO", // Thông tin thanh toán của CASSO
  FROM_TRANSFER_USER_ID = "FROM_TRANSFER_USER_ID", // Người chuyển tiền
  BUY_UTILITIES_CUSTOMER_ID = "BUY_UTILITIES_CUSTOMER_ID", // Khách hàng mua tiện ích
  BUY_UTILITIES_SHOP_ID = "BUY_UTILITIES_SHOP_ID", // Cửa hàng mua tiện ích
  EXCHANGE_GAME_CARD_CUSTOMER_ID = "EXCHANGE_GAME_CARD_CUSTOMER_ID", // Khách hàng đổi thẻ game
  AFFILIATE_ORDER_ID = "AFFILIATE_ORDER_ID", // Đơn hàng affiliate

  DEPOSIT_WITH_PAYPAL_ORDER_ID = "DEPOSIT_WITH_PAYPAl_ORDER_ID", // Nạp tiền vào ví với paypal

  PAYPAL_TRANSACTION_ID = "PAYPAL_TRANSACTION_ID", // Mã giao dịch paypal
}

export type IWalletTransaction = TimestampEntity & {
  code: string; // Mã giao dịch
  walletId: string; // Mã mPoint
  ownerId: string; // Mã tài khoản
  side: WalletTransactionSideEnum; // Hướng giao dịch
  type: WalletTransactionTypeEnum; // Loại giao dịch
  amount: number; // Số tiền giao dịch
  balance: number; // Số dư mPoint sau khi giao dịch
  description: string; // Mô tả giao dịch
  status: WalletTranscationStatusEnum; // Trạng thái giao dịch
  failedReason: string; // Lý do thất bại
  transactionNoun: number; // Số lần giao dịch
  specificInfo: {
    key: string;
    value: any;
  }[];
};
