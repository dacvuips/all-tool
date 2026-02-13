import { TimestampEntity } from "../../core";
import {
  CustomerIntro,
  CustomerStatusEnum,
  CustomerTimes,
} from "../../shared/interfaces/customer.interface";

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
  creditPoint?: number; // Điểm tín dụng
  bankVerifiedId?: string; // Mã Ngân hàng đã xác thực
  bankVerified?: any; //Ngân hàng đã xác thực
  hasReward?: boolean; // Có thưởng
  intro?: CustomerIntro; // Giới thiệu
  province?: string;
  district?: string;
  ward?: string;
};
