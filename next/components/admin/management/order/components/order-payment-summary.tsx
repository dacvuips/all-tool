import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit } from "react-icons/fa";
import { HiOutlineReceiptTax } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Order, PaymentStatus } from "../../../../../lib/repo";
import { orderService } from "../../../../../lib/repo/order/order.repo";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button, Field, Select, Textarea } from "../../../../shared/utilities/form";
import { StatusLabel } from "../../../../shared/utilities/misc";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";
import { formatMoney } from "./order-ui-helpers";

interface OrderPaymentSummaryProps {
  order: Order;
  onUpdate?: (order: Order) => void;
}

export function OrderPaymentSummary({ order, onUpdate }: OrderPaymentSummaryProps) {
  const { t } = useTranslation();
  const { PAYMENT_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS } = useOptionsTranslation();
  const [openUpdatePayment, setOpenUpdatePayment] = useState(false);

  const methodLabel =
    PAYMENT_METHOD_OPTIONS.find(
      (o) => o.value === (order?.paymentInfo?.method || order?.paymentMethod)
    )?.label ||
    order?.paymentInfo?.method ||
    order?.paymentMethod ||
    "-";

  const discount = order?.discount ?? 0;
  const tax = order?.tax ?? 0;
  const merchandise = order?.subtotal ?? order?.totalAmount ?? 0;

  return (
    <OrderSection title={t("Tổng kết thanh toán")} icon={<HiOutlineReceiptTax className="w-4 h-4" />}>
      <div className="space-y-2.5 text-sm">
        <OrderInfoField
          layout="horizontal"
          label={t("Giá gói / hàng")}
          value={formatMoney(merchandise)}
        />
        {discount > 0 ? (
          <OrderInfoField
            layout="horizontal"
            label={t("Giảm giá")}
            value={`-${formatMoney(discount)}`}
            labelClassName="text-rose-600"
            valueClassName="text-rose-600"
          />
        ) : null}
        {tax > 0 ? (
          <OrderInfoField layout="horizontal" label={t("Thuế")} value={formatMoney(tax)} />
        ) : null}
        <OrderInfoField layout="horizontal" label={t("Phương thức")} value={methodLabel} />
        <OrderInfoField
          layout="horizontal"
          label={t("Trạng thái thanh toán")}
          value={
            <div className="flex gap-2 items-center">
              <StatusLabel
                className="px-2 py-1 rounded-md"
                type="border-light"
                value={order?.paymentStatus}
                options={PAYMENT_STATUS_OPTIONS}
              />
              <Button
                icon={<FaEdit />}
                className="px-0 w-6 h-6 text-gray-500 hover:text-primary"
                onClick={() => setOpenUpdatePayment(true)}
                tooltip={t("Cập nhật trạng thái")}
              />
            </div>
          }
        />
        <div className="pt-3 mt-1 border-t border-gray-100">
          <div className="flex justify-between items-end">
            <span className="text-sm font-semibold text-gray-700">{t("Tổng tiền")}</span>
            <span className="text-xl font-bold text-primary">
              {formatMoney(order?.totalAmount)}
            </span>
          </div>
        </div>
      </div>
      <UpdatePaymentStatusModal
        open={openUpdatePayment}
        onClose={() => setOpenUpdatePayment(false)}
        orderId={order?.id}
        currentStatus={order?.paymentStatus}
        onSuccess={onUpdate}
      />
    </OrderSection>
  );
}

function UpdatePaymentStatusModal({
  open,
  onClose,
  orderId,
  currentStatus,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  currentStatus: PaymentStatus;
  onSuccess?: (order: Order) => void;
}) {
  const toast = useToast();
  const { t } = useTranslation();
  const { PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();
  const [status, setStatus] = useState<PaymentStatus>(currentStatus);
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setReason("");
    }
  }, [open, currentStatus]);

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      const updatedOrder = await orderService.updatePaymentStatus(orderId, status, reason);
      toast.success(t("Cập nhật trạng thái thanh toán thành công"));
      if (onSuccess && updatedOrder) onSuccess(updatedOrder);
      onClose();
    } catch (error) {
      toast.error(t("Cập nhật thất bại"));
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog isOpen={open} onClose={onClose} title={t("Cập nhật trạng thái thanh toán")}>
      <Dialog.Body>
        <div className="space-y-4">
          <Field label={t("Trạng thái")}>
            <Select
              value={status}
              onChange={setStatus}
              options={PAYMENT_STATUS_OPTIONS}
              className="w-full"
            />
          </Field>
          <Field label={t("Lý do thay đổi")}>
            <Textarea
              value={reason}
              onChange={setReason}
              placeholder={t("Nhập lý do thay đổi trạng thái...")}
              rows={3}
            />
          </Field>
        </div>
        <div className="flex justify-end mt-4 w-full">
          <Button
            onClick={handleUpdate}
            text={t("Cập nhật")}
            primary
            isLoading={updating}
            disabled={updating || !status}
          />
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
