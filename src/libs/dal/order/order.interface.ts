import { Types } from "mongoose";
import { TimestampEntity } from "../../core";
import { PaymentMethodEnum } from "../bank";

export type IOrder = TimestampEntity & {
  id: string;

  // Customer info
  customerId?: Types.ObjectId;
  sessionId?: string;

  // Order info
  orderNumber: string;
  status: OrderStatusEnum;

  productId: string;

  // Pricing
  creditAmount: number;
  totalAmount: number;

  // Payment
  paymentMethod: PaymentMethodEnum;
  paymentStatus: PaymentStatus;
  paymentInfo?: IPaymentInfo;
  paidAt?: Date;
  cancelledAt?: Date;
  adminNote?: string;
  orderLogs: IOrderLog[];
  paymentLogs: IPaymentLog[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};

export interface IOrderLog {
  status: OrderStatusEnum;
  des?: string; // Description with detailed information
  note?: string;
  meta?: any; // Metadata for additional information
  createdAt: Date;
  creatorId?: string;
}
export interface IPaymentLog {
  status: PaymentStatus;
  des?: string; // Description with detailed information
  note?: string;
  meta?: any; // Metadata for additional information (transaction ID, gateway response, etc.)
  createdAt: Date;
  creatorId?: string;
  amount?: number; // Amount related to this payment action
  transactionId?: string; // Transaction ID from payment gateway
}

export interface IPaymentInfo {
  method: PaymentMethodEnum;
  bankImage?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  metaData?: any; // Dữ liệu trả về từ cổng thanh toán
}

export enum OrderStatusEnum {
  CREATED = "CREATED",
  STATUS_CHANGED = "STATUS_CHANGED",
  PAYMENT_UPDATED = "PAYMENT_UPDATED",
  PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
  SHIPPING_STARTED = "SHIPPING_STARTED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  ORDER_UPDATED = "ORDER_UPDATED",
}

export enum PaymentStatus {
  PAYMENT_INITIATED = "PAYMENT_INITIATED", // Thanh toán đã được khởi tạo
  PAYMENT_PENDING = "PAYMENT_PENDING", // Thanh toán đang chờ xử lý
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED", // Thanh toán thất bại
  PAYMENT_CANCELLED = "PAYMENT_CANCELLED", // Thanh toán đã bị hủy
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED", // Thanh toán đã được hoàn tiền
  PAYMENT_PARTIALLY_REFUNDED = "PAYMENT_PARTIALLY_REFUNDED", // Thanh toán đã hoàn tiền một phần
  PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT", // Thanh toán đã hết thời gian thanh toán
  PAYMENT_UNPAID = "PAYMENT_UNPAID", // Thanh toán chưa được thanh toán
}

export const ORDER_STATUS_OPTIONS = [
  { value: OrderStatusEnum.CREATED, label: "Tạo đơn hàng", color: "info" },
  {
    value: OrderStatusEnum.STATUS_CHANGED,
    label: "Thay đổi trạng thái đơn hàng",
    color: "warning",
  },
  {
    value: OrderStatusEnum.PAYMENT_UPDATED,
    label: "Cập nhật phương thức thanh toán",
    color: "purple",
  },
  { value: OrderStatusEnum.PAYMENT_CONFIRMED, label: "Xác nhận thanh toán", color: "success" },
  { value: OrderStatusEnum.SHIPPING_STARTED, label: "Bắt đầu giao hàng", color: "orange" },
  { value: OrderStatusEnum.DELIVERED, label: "Đã giao hàng", color: "success" },
  { value: OrderStatusEnum.CANCELLED, label: "Hủy đơn hàng", color: "danger" },
  { value: OrderStatusEnum.PROCESSING, label: "Đang xử lý đơn hàng", color: "info" },
  { value: OrderStatusEnum.ORDER_UPDATED, label: "Cập nhật đơn hàng", color: "warning" },
];
