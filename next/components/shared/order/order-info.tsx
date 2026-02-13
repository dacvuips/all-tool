import React from "react";
import { StatusLabel } from "../utilities/misc";

interface OrderInfoProps {
  order: {
    orderNumber?: string;
    totalAmount?: number;
    createdAt?: string | Date;
    paymentStatus?: string;
    items?: Array<{
      thumbnail?: string;
      productName: string;
      variantName?: string;
      quantity: number;
      price?: number;
    }>;
    paymentInfo?: any;
  };
  PAYMENT_STATUS_OPTIONS: any;
  t: (key: string) => string;
}

export const OrderInfo: React.FC<OrderInfoProps> = ({ order, PAYMENT_STATUS_OPTIONS, t }) => {
  return (
    <>
      <div className="flex items-center justify-center mb-2">
        <h4 className="text-lg font-bold text-primary">{t("Đơn hàng hiện tại")}</h4>
      </div>
      <div className="flex items-center justify-between gap-2 text-gray-700">
        <span className="font-semibold">{t("Mã đơn hàng")}: </span>
        <span className="font-mono text-primary">{order.orderNumber}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-gray-700">
        <span className="font-semibold">{t("Tổng tiền")}: </span>
        <span className="text-lg font-bold text-primary">
          {order.totalAmount?.toLocaleString()}đ
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-gray-700">
        <span className="font-semibold">{t("Ngày tạo")}: </span>
        <span>{new Date(order.createdAt).toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-gray-700">
        <span className="font-semibold">{t("Trạng thái")}: </span>
        <StatusLabel type="text" options={PAYMENT_STATUS_OPTIONS} value={order.paymentStatus} />
      </div>
    </>
  );
};
