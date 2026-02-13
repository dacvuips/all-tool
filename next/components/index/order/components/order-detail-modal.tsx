import { useTranslation } from "react-i18next";
import { Order } from "../../../../lib/repo/order/order.repo";
import { OrderStatusTimeline } from "../../../admin/management/order/components";

interface OrderDetailModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  const { t } = useTranslation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">
              <i className="fas fa-file-alt mr-2"></i>
              {t("Chi tiết đơn hàng")} #{order.orderNumber}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {/* 3 Columns Layout - Responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Shipping Address */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-map-marker-alt mr-2 text-primary"></i>
                  {t("Địa chỉ giao hàng")}
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <label className="text-gray-600">{t("Tên người nhận")}:</label>
                    <p className="font-medium text-gray-900">
                      {order.shippingAddress?.recipientName || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-600">{t("Số điện thoại")}:</label>
                    <p className="font-medium text-gray-900">
                      {order.shippingAddress?.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-600">{t("Email")}:</label>
                    <p className="font-medium text-gray-900">
                      {order.shippingAddress?.email || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-600">{t("Địa chỉ")}:</label>
                    <p className="font-medium text-gray-900">
                      {order.shippingAddress?.address}
                      {order.shippingAddress?.ward && `, ${order.shippingAddress.ward}`}
                      {order.shippingAddress?.district && `, ${order.shippingAddress.district}`}
                      {order.shippingAddress?.province && `, ${order.shippingAddress.province}`}
                    </p>
                  </div>
                  {order.shippingAddress?.note && (
                    <div>
                      <label className="text-gray-600">{t("Ghi chú")}:</label>
                      <p className="font-medium text-gray-900">{order.shippingAddress.note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Payment Info */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-credit-card mr-2 text-primary"></i>
                  {t("Thông tin thanh toán")}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("Phương thức")}:</span>
                    <span className="font-medium text-gray-900">
                      {order.paymentMethod === "BANK" ? t("Chuyển khoản") : order.paymentMethod}
                    </span>
                  </div>
                  {order.paymentInfo?.bankName && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("Ngân hàng")}:</span>
                        <span className="font-medium text-gray-900">
                          {order.paymentInfo.bankName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("Số TK")}:</span>
                        <span className="font-medium text-gray-900">
                          {order.paymentInfo.accountNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("Chủ TK")}:</span>
                        <span className="font-medium text-gray-900">
                          {order.paymentInfo.accountName}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="pt-3 mt-3 border-t">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">{t("Tạm tính")}:</span>
                      <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.shippingFee > 0 && (
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">{t("Phí vận chuyển")}:</span>
                        <span className="text-gray-900">{formatCurrency(order.shippingFee)}</span>
                      </div>
                    )}
                    {order.discount > 0 && (
                      <div className="flex justify-between mb-2 text-green-600">
                        <span>{t("Giảm giá")}:</span>
                        <span>-{formatCurrency(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 mt-2 border-t">
                      <span className="text-base font-bold text-gray-900">{t("Tổng cộng")}:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Order History */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-history mr-2 text-primary"></i>
                  {t("Lịch sử đơn hàng")}
                </h3>
                <div className="overflow-y-auto max-h-96">
                  <OrderStatusTimeline order={order} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              <i className="fas fa-check mr-2"></i>
              {t("Đóng")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
