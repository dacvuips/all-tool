import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Order, orderService } from "../../../../../lib/repo";
import { StatusLabel } from "../../../../shared/utilities/misc";
import { useDataTable } from "../../../../shared/utilities/table/data-table";
import { OrderActions } from "./order-actions";
import { OrderCustomerInfo } from "./order-customer-info";
import { OrderItemsList } from "./order-items-list";
import { OrderPaymentHistory } from "./order-payment-history";
import { OrderPaymentSummary } from "./order-payment-summary";
import { OrderShippingInfo } from "./order-shipping-info";
import { OrderStatusTimeline } from "./order-status-timeline";
import { OrderUpdateDialog } from "./order-update-dialog";
import { formatMoney, getOrderTypeLabel } from "./order-ui-helpers";

export function OrderDetailForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();
  const { userPermission } = useAuth();
  const { formItem, loadAll, onRefresh } = useDataTable();
  const { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [order, setOrder] = useState<Order>(formItem as Order);

  useEffect(() => {
    if (formItem) setOrder(formItem as Order);
  }, [formItem]);

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

  if (!order) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 pb-4 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <h2 className="text-lg font-bold text-gray-900 truncate">{order.orderNumber}</h2>
            <StatusLabel
              extraClassName="rounded-md"
              options={ORDER_STATUS_OPTIONS}
              value={order.status}
              type="border-light"
            />
            <StatusLabel
              extraClassName="rounded-md"
              options={PAYMENT_STATUS_OPTIONS}
              value={order.paymentStatus}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
            <span>
              {t("Ngày tạo")}:{" "}
              <b className="font-medium text-gray-700">
                {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "-"}
              </b>
            </span>
            <span className="hidden text-gray-300 sm:inline">·</span>
            <span>
              {t("Loại")}:{" "}
              <b className="font-medium text-gray-700">{t(getOrderTypeLabel(order.type))}</b>
            </span>
            {order.subscriptionPlan ? (
              <>
                <span className="hidden text-gray-300 sm:inline">·</span>
                <span>
                  {t("Gói")}:{" "}
                  <b className="font-medium text-gray-700 capitalize">{order.subscriptionPlan}</b>
                </span>
              </>
            ) : null}
            <span className="hidden text-gray-300 sm:inline">·</span>
            <span>
              {t("Tổng")}:{" "}
              <b className="font-semibold text-primary">{formatMoney(order.totalAmount)}</b>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OrderCustomerInfo order={order} />
            <OrderShippingInfo order={order} />
          </div>
          <OrderItemsList order={order} />
        </div>

        <div className="space-y-4">
          <OrderPaymentSummary
            order={order}
            onUpdate={(updatedOrder) => {
              setOrder(updatedOrder);
              loadAll();
              onRefresh();
            }}
          />
          <OrderStatusTimeline order={order} />
          <OrderPaymentHistory order={order} />
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <OrderActions
          order={order}
          canEdit={userPermission("EDIT_ORDER")}
          cancelling={cancelling}
          onPrintInvoice={() => window.print()}
          onUpdateOrder={() => setShowUpdateDialog(true)}
          onCancelOrder={handleCancelOrder}
        />
      </div>

      {showUpdateDialog ? (
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
      ) : null}
    </div>
  );
}
