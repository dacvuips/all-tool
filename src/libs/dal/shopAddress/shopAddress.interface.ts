import { TimestampEntity } from "../../core";

/**
 * Interface cho địa chỉ cửa hàng
 * Dùng để quản lý các địa chỉ gửi hàng của shop
 */
export type IShopAddress = TimestampEntity & {
  id: string;
  recipientName: string; // Tên người liên hệ/người gửi
  phone: string; // Số điện thoại
  email?: string; // Email (optional)
  address: string; // Địa chỉ chi tiết (số nhà, tên đường)
  ward?: string; // Phường/Xã
  district?: string; // Quận/Huyện
  province?: string; // Tỉnh/Thành phố
  country?: string; // Quốc gia
  postalCode?: string; // Mã bưu điện
  note?: string; // Ghi chú
  default: boolean; // Địa chỉ mặc định
  isActive: boolean; // Trạng thái hoạt động
};
