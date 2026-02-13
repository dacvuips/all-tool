import { BaseEntity } from "../../core";

export type IAnalyticOrderSummary = BaseEntity & {
  when?: string; // YYYY-MM-DD
  time?: Date;
  total?: number; // Tổng số đơn hàng
  totalAmount?: number; // Tổng số tiền
  newOrder?: number; // Đơn hàng mới
  newAmount?: number; // Tổng số tiền đơn hàng mới
  status?: {
    status: any;
    count: number;
    amount: number;
  }[];
  products?: {
    productId: string;
    productName: string;
    orderCount: number;
    qty: number;
    amount: number;
  }[];
  suppliers?: {
    supplierName: string;
    count: number;
    amount: number;
  };
};
