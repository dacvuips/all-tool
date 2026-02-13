export enum CustomerStatusEnum {
  ACTIVE = "ACTIVE", // Kích hoạt
  INACTIVE = "INACTIVE", // Không kích hoạt
  BLOCKED = "BLOCKED", // Bị khóa
}

export type CustomerTimes = {
  registedAt?: Date; // Thời gian đăng ký
  lastLoginAt?: Date; // Thời gian đăng nhập cuối
  lastOrderAt?: Date; // Thời gian đặt hàng cuối
  emailVerifiedAt?: Date; // Thời gian xác thực email
  passwordChangedAt?: Date; // Thời gian thay đổi mật khẩu
};

export enum RewardPointTypeEnum {
  TRANSACTION = "TRANSACTION",
  PAYMENT = "PAYMENT",
}
export type BankCustomer = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  code: string;
  bin: string;
};
export type CustomerIntro = {
  order: boolean;
  card: boolean;
};
