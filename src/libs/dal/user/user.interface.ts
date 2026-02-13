import { Place } from "../../shared/interfaces/place.interface";
import { TimestampEntity } from "../../core";
import { UserRoleEnum } from "../../shared";

export enum UserGender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}
export enum UserStatus {
  ACTIVE = "ACTIVE", // Hoạt động
  INACTIVE = "INACTIVE", // Không hoạt động
  BLOCKED = "BLOCKED", // Bị Khoá
}

export type PartnerConfig = {
  maximumOpenOrder?: number; // Số lượng đơn hàng tối đa mở
  minimumWalletBalance?: number; // Số dư mPoint tối thiểu
  maximumOrderValue?: number; // Giá trị đơn hàng tối đa
  isWithdrawExchangeFee?: boolean; // Trừ phí cộng tác viên
};
export type UserBanks = {
  bankAccount: string;
  bankNumber: string;
  bankName: string;
};
export type IUser = TimestampEntity & {
  uid?: string; // Mã UID Firebase
  email?: string; // Email
  name?: string; // Họ va tên
  role?: UserRoleEnum; // Vai trò
  phone?: string; // Điện thoại
  avatar?: string; // Ảnh đại diện
  place?: Place; // Vị trí
  scopes?: string[]; // Phân quyền
  root?: boolean;
  position?: string; // Chức vụ
  birthday?: Date; // Ngày sinh
  gender?: UserGender; // Giới tính
  address?: string;
  authorityIds?: string[]; // Phân quyền
  authorityId?: string; //Phân quyền
  code?: string; //Mã nhân viên
  status?: UserStatus; //Trạng thái
  partnerConfig?: PartnerConfig;
  banks?: UserBanks[];
  creditPoint?: number; // Điểm tín dụng
  partnerGroupId?: string; // Nhóm đối tác
  isPartnerGroupOwner?: boolean; // Là chủ nhóm đối tác
  gameIdsPermission?: string[]; // danh sách gameId được phân quyền cho tài khoản này
};
