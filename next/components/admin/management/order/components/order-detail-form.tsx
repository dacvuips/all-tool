import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Order, orderService } from "../../../../../lib/repo";
import { useDataTable } from "../../../../shared/utilities/table/data-table";
import { OrderActions } from "./order-actions";
import { OrderCustomerInfo } from "./order-customer-info";
import { OrderItemsList } from "./order-items-list";
import { OrderPaymentHistory } from "./order-payment-history";
import { OrderPaymentSummary } from "./order-payment-summary";
import { OrderShippingInfo } from "./order-shipping-info";
import { OrderStatusTimeline } from "./order-status-timeline";
import { OrderUpdateDialog } from "./order-update-dialog";
import { ShipmentsTable } from "./shipping/shipments-table";

export function OrderDetailForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();
  const { userPermission } = useAuth();
  const { formItem, loadAll, onRefresh } = useDataTable();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showShippingTable, setShowShippingTable] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [order, setOrder] = useState<Order>(formItem as Order);

  const handleCancelOrder = async () => {
    if (!userPermission("EDIT_ORDER")) {
      toast.error(t("Bạn không có quyền hủy đơn hàng"));
      return;
    }

    await alert.danger(
      t("Xác nhận hủy đơn hàng"),
      t("Bạn có chắc chắn muốn hủy đơn hàng này? Hành động này không thể hoàn tác."),
      t("Xác nhận hủy"),
      async () => {
        try {
          setCancelling(true);
          const cancelledOrder = await orderService.cancelOrder(order.id);
          toast.success(t("Hủy đơn hàng thành công"));
          setOrder(cancelledOrder);
          loadAll();
          return true;
        } catch (error: any) {
          toast.error(error.message || t("Có lỗi xảy ra khi hủy đơn hàng"));
          return false;
        } finally {
          setCancelling(false);
        }
      }
    );
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleUpdateOrder = () => {
    setShowUpdateDialog(true);
  };

  const handleToggleShippingTable = () => {
    setShowShippingTable(!showShippingTable);
  };

  if (!order) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center divide-x divide-dashed divide-gray-300">
          
          <div className="text-sm text-gray-600 sm:text-base pr-2">
            {t("Mã đơn hàng")}: <span className="font-semibold">{order?.orderNumber}</span>
          </div>
          <div className="text-xs text-gray-500 sm:text-sm pl-2">
            {t("Ngày tạo")}:{" "}
            {order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : ""}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Column - Order Details */}
        <div className="space-y-4 lg:col-span-2">
          {/* Customer & Shipping Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OrderCustomerInfo order={order} />
            <OrderShippingInfo order={order} />
          </div>

          {/* Order Items */}
          <OrderItemsList order={order} />
          {/* Shipping Providers Table */}

          <ShipmentsTable
            order={order}
            onSuccess={() => {
              loadAll();
              onRefresh();
            }}
          />
        </div>

        {/* Right Column - Order Summary */}
        <div className="space-y-4">
          {/* Payment Summary */}
          {/* Payment Summary */}
          <OrderPaymentSummary 
            order={order} 
            onUpdate={(updatedOrder) => {
              setOrder(updatedOrder);
              loadAll();
              onRefresh();
            }}
          />

          {/* Order Status Timeline */}
          <OrderStatusTimeline order={order} />

          {/* Payment History */}
          <OrderPaymentHistory order={order} />
        </div>
      </div>
      {/* Action Buttons */}
      <OrderActions
        order={order}
        canEdit={userPermission("EDIT_ORDER")}
        cancelling={cancelling}
        onPrintInvoice={handlePrintInvoice}
        onUpdateOrder={handleUpdateOrder}
        onCancelOrder={handleCancelOrder}
      />

      {/* Update Dialog */}
      {showUpdateDialog && (
        <OrderUpdateDialog
          order={order}
          isOpen={showUpdateDialog}
          onClose={() => setShowUpdateDialog(false)}
          onSuccess={(updatedOrder) => {
            setShowUpdateDialog(false);
            setOrder(updatedOrder);
            loadAll();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
