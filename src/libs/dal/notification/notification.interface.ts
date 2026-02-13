import { TimestampEntity } from "../../core";

export enum NotificationType {
  MESSAGE = "MESSAGE", // Tin nhắn
  ORDER = "ORDER", // Đơn hàng
  ACCOUNT = "ACCOUNT", // Tài khoản
  PRODUCT = "PRODUCT", // Sản phẩm
  WEBSITE = "WEBSITE", // Website
  SUPPORT_TICKET = "SUPPORT_TICKET", // Yêu cầu hỗ trợ
  TRANSACT = "TRANSACT", // Giao dịch
  WALLET = "WALLET", // Chuyển khoản và số  dư
  GAME_ORDER = "GAME_ORDER", // Đặt hàng sản phẩm
  SETTING = "SETTING", // Cấu hình sàn
  GAME_CARD = "GAME_CARD", // Thẻ game
  AFFILIATE_ORDER = "AFFILIATE_ORDER", // Đơn affiliate
}
export enum NotificationTarget {
  SHOP = "SHOP", // Gửi tới chủ shop
  USER = "USER", // Gưi tới staff
  CUSTOMER = "CUSTOMER", // Gửi tới khách hàng
}
export type INotification = TimestampEntity & {
  target?: NotificationTarget; // Gửi tới
  shopId?: string; // Mã chủ shop
  userId?: string; // Mã nhân viên
  customerId?: string; // Mã khách hàng
  title?: string; // Tiêu đề thông báo
  body?: string; // Nội dung thông báo
  type?: NotificationType; // Loại thông báo
  seen?: boolean; // Đã xem
  seenAt?: Date; // Ngày xem
  image?: string; // Hình ảnh
  sentAt?: Date; // Ngày gửi
  orderId?: string; // Mã đơn hàng
  gameOrderId?: string; // Mã đơn hàng sản phẩm
  productId?: string; // Mã sản phẩm
  link?: string; // Link website
  ticketId?: string; // Mã yêu cầu hỗ trợ
  registId?: string; // Mã đăng ký cộng tác viên
  transactLink?: string; // Link đơn hàng
  walletLink?: string; // Link thông tin mPoint
  affiliateOrderId?: string; // Mã đơn affiliate
};
