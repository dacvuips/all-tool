import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Order, orderService } from "../../../../lib/repo/order/order.repo";
import { Button } from "../../../shared/utilities/form";
import {
  checkoutTypeQueryParam,
  checkoutUrlTypeToOrderType,
  getOrderTypeLabel,
  parseCheckoutUrlType,
} from "../utils/checkout-type";

interface PendingOrderMismatchViewProps {
  pendingOrder: Order;
  requestedUrlType: string;
  onContinuePending?: () => void;
}

/**
 * Cảnh báo khi user mở checkout loại A nhưng đang có đơn pending loại B.
 */
export function PendingOrderMismatchView({
  pendingOrder,
  requestedUrlType,
  onContinuePending,
}: PendingOrderMismatchViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();

  const requestedType = parseCheckoutUrlType(requestedUrlType);
  const requestedOrderType = requestedType ? checkoutUrlTypeToOrderType(requestedType) : "TOOL";

  const handleGoToPending = () => {
    if (onContinuePending) {
      onContinuePending();
      return;
    }
    router.replace(`/checkout${checkoutTypeQueryParam(pendingOrder.type)}`);
  };

  const handleCancelPending = async () => {
    try {
      await orderService.cancelOrder(pendingOrder.id);
      toast.success(t("Hủy đơn thành công"));
      window.location.href = `/checkout?type=${requestedUrlType}`;
    } catch {
      toast.error(t("Hủy đơn thất bại"));
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] px-4 py-10 bg-gray-100">
      <div className="flex flex-col gap-4 p-6 w-full max-w-md bg-white rounded-2xl border border-yellow-200 shadow-sm">
        <div className="flex gap-3 items-start">
          <HiOutlineExclamationCircle className="flex-shrink-0 text-3xl text-yellow-500" />
          <div>
            <h2 className="text-lg font-bold text-gray-800">{t("Bạn có đơn đang chờ thanh toán")}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {t("Bạn đang cố thanh toán")}{" "}
              <strong>{getOrderTypeLabel(requestedOrderType, t)}</strong>
              {t(", nhưng còn đơn")}{" "}
              <strong>{getOrderTypeLabel(pendingOrder.type, t)}</strong>{" "}
              {t("chưa hoàn tất")} ({pendingOrder.orderNumber}).
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {t("Vui lòng hoàn tất hoặc hủy đơn cũ trước khi tạo đơn mới để tránh nhầm lẫn.")}
            </p>
          </div>
        </div>

        <Button
          primary
          className="w-full rounded-xl"
          text={t("Tiếp tục thanh toán đơn hiện tại")}
          onClick={handleGoToPending}
        />
        <Button
          className="w-full rounded-xl border border-red-300 text-red-600 hover:bg-red-50"
          text={t("Hủy đơn cũ và tạo đơn mới")}
          onClick={handleCancelPending}
        />
        <Button
          className="w-full rounded-xl border border-gray-300"
          text={t("Quay lại")}
          onClick={() => router.back()}
        />
      </div>
    </div>
  );
}
