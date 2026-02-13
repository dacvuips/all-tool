export enum ActionType {
  NONE = "NONE", // Không hành động
  WEBSITE = "WEBSITE", // Mở website
  ORDER = "ORDER", // Mở bài order
  PRODUCT = "PRODUCT", // Mở bài sản phẩm
  TRANSACT = "TRANSACT", // Mở giao dịch
  SUPPORT_TICKET = "SUPPORT_TICKET", // Mở ticket
  WALLET = "WALLET", // Mở
}

export type Action = {
  type?: ActionType; // Loại hành động
  link?: string; // Đường dẫn website
  postId?: string; // Mã bài đăng

  orderId?: string; // Mã Order
  productId?: string; // Mã sản phẩm
  ticketId?: string; // Mã ticket
  transactLink?: string; // Đường dân tran giao dịch
};
