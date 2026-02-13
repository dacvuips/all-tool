import { TimestampEntity } from "../../core";

export type IPaypalTransactions = TimestampEntity & {
  orderId?: string;
  customerId?: string;
  paymentId?: string;
  status?: PaypalTransactionsStatusEnum;
  code?: string;
  amount?: number;
  logs?: PaypalTransactionsLog[];
};

export enum PaypalTransactionsStatusEnum {
  PENDING = "PENDING", // Đơn hàng đang chờ xử lý
  PROCESSING = "PROCESSING", // Đơn hàng đang được xử lý
  CHECKOUT_ORDER_APPROVED = "CHECKOUT_ORDER_APPROVED", // Đơn hàng đã duyệt checkout
  PAYMENT_CAPTURE_COMPLETED = "PAYMENT_CAPTURE_COMPLETED", // Đơn hàng đã được thanh toán thành công
}

export type PaypalTransactionsLog = {
  status: string;
  createdAt: Date;
  message: string;
  meta: any;
};
