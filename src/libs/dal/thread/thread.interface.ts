import { TimestampEntity } from "../../core";
export enum ThreadChannel {
  shop = "shop", // Cửa hàng
  staff = "staff", // nhân viên
  customer = "customer", // Khách hàng
}

export enum ThreadStatus {
  new = "new", // Mở mới
  opening = "opening", // Đang mở tương tác
  closed = "closed", // Đã kết thúc
}

export type IThread = TimestampEntity & {
  channel?: ThreadChannel; // Kênh trao đổi
  snippet?: string; // Tin nhắn gần nhất
  lastMessageAt?: Date; // Thời điểm tin nhắn gần nhất
  messageId?: string; // Mã tin nhắn gần nhất
  shopId?: string; // Mã chủ shop
  customerId?: string; // Mã khách hàng
  staffId?: string; // Mã nhân viên
  shopProductId?: string; // Mã sản phẩm
  gameOrderId?: string; //Mã đơn giao dịch
  status?: ThreadStatus; // Trạng thái trao đổi
  seenCustomer?: boolean; // khách hàng đã xem
  seenShop?: boolean; // cửa hàng đã xem
  seenStaff?: boolean; // nhân viên đã xem
  meta?: any;
};
