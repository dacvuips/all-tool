import { TimestampEntity } from "../../core";

export enum CustomerStatusEnum {
  ACTIVE = "ACTIVE", // Kích hoạt
  INACTIVE = "INACTIVE", // Không kích hoạt
  BLOCKED = "BLOCKED", // Bị khóa
}

export enum SubscriptionPlanEnum {
  FREE = "free",
  TRIAL = "trial",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  UNLIMITED = "unlimited",
}

export type SubscriptionPlanOption = {
  label: string;
  videoLimit: number;
  imageLimit: number;
  imageStreamCount: number;
  videoStreamCount: number;
  price: number;
};

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

export type GooglePackage = {
  subscription?: SubscriptionPlanEnum; // Gói đăng ký
  videoCount?: number; // Số video đã dùng
  videoLimit?: number; // Giới hạn video
  imageCount?: number; // Số ảnh đã dùng
  imageLimit?: number; // Giới hạn ảnh
  imageStreamCount?: number; // Số luồng ảnh đồng thời
  videoStreamCount?: number; // Số luồng video đồng thời
  expiryPackageDate?: Date; // Ngày hết hạn gói
};

export type ICustomer = TimestampEntity & {
  code?: string; // Mã khách hàng
  name?: string; // Tên khách hàng
  uid?: string; // Mã UID Firebase
  phoneNumber?: string; // Số điện thoại
  email?: string; // Email
  address?: string; // Địa chỉ
  avatarUrl?: string; // Ảnh đại diện
  status?: CustomerStatusEnum; // Trạng thái
  passwordHash?: string; // Mật khẩu
  birthday?: Date; // Ngày sinh
  times?: CustomerTimes; // Lần mua hàng
  rewardPoint?: number; // Điểm thưởng

  bankVerifiedId?: string; // Mã Ngân hàng đã xác thực
  bankVerified?: any; //Ngân hàng đã xác thực
  hasReward?: boolean; // Có thưởng
  intro?: CustomerIntro; // Giới thiệu
  province?: string;
  district?: string;
  ward?: string;
  googlePackage?: GooglePackage; // Gói Google (subscription, limits, counts)
};
