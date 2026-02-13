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
  // Items
  items: IOrderItem[];

  // Pricing
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  totalAmount: number;

  // Shipping address
  shippingAddress: IShippingAddress;

  // Payment
  paymentMethod: PaymentMethodEnum;
  paymentStatus: PaymentStatus;
  paymentInfo?: IPaymentInfo;

  // Timestamps
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  // Notes
  customerNote?: string;
  adminNote?: string;

  // Logs
  logs?: IOrderLog[];
  paymentLogs?: IPaymentLog[];

  // Shipments (đơn vận chuyển)
  shipmentIds?: Types.ObjectId[]; // Danh sách ID của các shipment

  // Metadata
  ipAddress?: string;
  userAgent?: string;
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

export interface IOrderItem {
  productName: string;
  thumbnail?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  subtotal: number;
}

export interface IShippingAddress {
  recipientName: string;
  phone: string;
  email?: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  note?: string;
}
export interface IShopAddress {
  name: string;
  phone: string;
  email?: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
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
  PAYMENT_PENDING = "PAYMENT_PENDING",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_CANCELLED = "PAYMENT_CANCELLED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
  PAYMENT_PARTIALLY_REFUNDED = "PAYMENT_PARTIALLY_REFUNDED",
  PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT",
  PAYMENT_UNPAID = "PAYMENT_UNPAID",
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
