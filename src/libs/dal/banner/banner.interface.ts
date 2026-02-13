import { TimestampEntity } from "../../core";

export enum BannerActionType {
  WEBSITE = "WEBSITE",
  PRODUCT = "PRODUCT",
  VOUCHER = "VOUCHER",
  SHOP = "SHOP",
  NORMAL = "NORMAL",
}
export enum BannerType {
  BANNER = "BANNER",
  POPUP = "POPUP",
}
export type IBanner = TimestampEntity & {
  image?: string; // Hình ảnh
  title?: string; // Tiêu đề
  subtitle?: string; // Mô tả tiêu đề
  actionType?: BannerActionType; // Loại hành động
  link?: string; // Đường dẫn website
  productId?: string; // Mã sản phẩm
  voucherId?: string; // Mã voucher
  isPublic?: boolean; // Hiển thị công khai
  priority?: number; // Ưu tiên
  memberId?: string; // Mã cửa hàng
  position?: string; // Vị trí
  type?: BannerType; //loại banner
};
