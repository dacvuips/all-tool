import { useTranslation } from "react-i18next";
import { RiRefreshLine } from "react-icons/ri";
import { formatDate, parseNumber } from "../../../../../../lib/helpers/parser";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import {
  Order,
  PaymentMethod,
  PaymentStatus,
  orderService,
} from "../../../../../../lib/repo/order/order.repo";
import { Button } from "../../../../../shared/utilities/form";

interface Props {
  order: Order;
  loadAll: () => void;
}

const PAYMENT_STATUS_TEXT: Record<string, string> = {
  [PaymentStatus.PAYMENT_INITIATED]: "Mới tạo",
  [PaymentStatus.PAYMENT_PENDING]: "Chờ thanh toán",
  [PaymentStatus.PAYMENT_SUCCESS]: "Đã thanh toán",
  [PaymentStatus.PAYMENT_FAILED]: "Thanh toán thất bại",
  [PaymentStatus.PAYMENT_CANCELLED]: "Đã hủy",
  [PaymentStatus.PAYMENT_REFUNDED]: "Đã hoàn tiền",
  [PaymentStatus.PAYMENT_PARTIALLY_REFUNDED]: "Hoàn tiền một phần",
  [PaymentStatus.PAYMENT_TIMEOUT]: "Hết hạn thanh toán",
  [PaymentStatus.PAYMENT_UNPAID]: "Chưa thanh toán",
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  [PaymentStatus.PAYMENT_SUCCESS]: "bg-green-50 text-green-700 border-green-200",
  [PaymentStatus.PAYMENT_PENDING]: "bg-yellow-50 text-yellow-700 border-yellow-200",
  [PaymentStatus.PAYMENT_CANCELLED]: "bg-red-50 text-red-700 border-red-200",
  [PaymentStatus.PAYMENT_FAILED]: "bg-red-50 text-red-700 border-red-200",
  [PaymentStatus.PAYMENT_TIMEOUT]: "bg-orange-50 text-orange-700 border-orange-200",
};

export function OrderBuyItem({ order, loadAll }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const canCancel =
    order.paymentStatus === PaymentStatus.PAYMENT_PENDING ||
    order.paymentStatus === PaymentStatus.PAYMENT_INITIATED ||
    order.paymentStatus === PaymentStatus.PAYMENT_UNPAID;

  const onCancelOrder = async () => {
    try {
      await orderService.cancelOrder(order.id);
      toast.success(t("Hủy đơn thành công"));
      loadAll();
    } catch (error) {
      toast.error(t("Hủy đơn thất bại"));
    }
  };

  return (
    <article className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex flex-wrap gap-2 justify-between items-start">
        <div>
          <p className="font-semibold text-gray-900 text-15">{order.orderNumber || order.id}</p>
          <p className="text-gray-500 text-13">
            {t("Tạo lúc")}: {formatDate(order.createdAt, "HH:mm dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span
            className={`px-2.5 py-1 text-12 border rounded-full ${
              PAYMENT_STATUS_CLASS[order.paymentStatus] ||
              "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            {t(PAYMENT_STATUS_TEXT[order.paymentStatus] || "Không xác định")}
          </span>
          <Button
            icon={<RiRefreshLine className="text-16" />}
            onClick={loadAll}
            tooltip={t("Tải lại")}
            className="p-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mt-3 sm:grid-cols-3">
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-gray-500 text-12">{t("Tổng tiền")}</p>
          <p className="font-semibold text-gray-900">{parseNumber(order.totalAmount || 0)}đ</p>
        </div>
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-gray-500 text-12">{t("Phương thức")}</p>
          <p className="font-semibold text-gray-900">
            {order.paymentMethod ? PaymentMethod[order.paymentMethod] || order.paymentMethod : "-"}
          </p>
        </div>
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-gray-500 text-12">{t("Sản phẩm")}</p>
          <p className="font-semibold text-gray-900">
            {order.creditAmount > 0 ? t("Đơn hàng tín dụng") : order.items?.[0]?.productName || "-"}
          </p>
        </div>
        {order.creditAmount > 0 && (
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-gray-500 text-12">{t("Tín dụng")}</p>
            <p className="font-semibold text-gray-900">{parseNumber(order.creditAmount || 0)}đ</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3">
        <p className="text-gray-500 text-12">
          {t("Cập nhật")}: {formatDate(order.updatedAt, "HH:mm dd/MM/yyyy")}
        </p>
        <div className="flex gap-2">
          {canCancel && (
            <Button
              outline
              text={t("Hủy đơn")}
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={onCancelOrder}
            />
          )}
        </div>
      </div>
    </article>
  );
}
