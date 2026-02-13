import { TimestampEntity } from "../../core";

export enum PopupNotifyType {
  IMAGE = "IMAGE", // hình ảnh
  VIDEO = "VIDEO", // video
  HTML = "HTML", // html
}
export enum PopupNotifyStatus {
  ACTIVE = "ACTIVE", // hoạt động
  INACTIVE = "INACTIVE", // không hoạt động
}
export enum PopupNotifyActionType {
  WEBSITE = "WEBSITE",
  PRODUCT = "PRODUCT",
  VOUCHER = "VOUCHER",
  SHOP = "SHOP",
  NORMAL = "NORMAL",
}
export type IPopupNotify = TimestampEntity & {
  name?: string; // tên popup
  description?: string; // mô tả
  type?: PopupNotifyType; // loại popup
  status?: PopupNotifyStatus; // trạng thái
  data?: any; // dữ liệu
  startDate?: Date; // ngày bắt đầu
  endDate?: Date; // ngày kết thúc
  priority?: number; // ưu tiên
  action?: PopupNotifyActionType; // hành động
  link?: string; // đường dẫn website
};
