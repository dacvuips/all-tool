import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit } from "react-icons/fa";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Order, PaymentStatus } from "../../../../../lib/repo";
import { orderService } from "../../../../../lib/repo/order/order.repo";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button, Field, Select, Textarea } from "../../../../shared/utilities/form";
import { StatusLabel } from "../../../../shared/utilities/misc";
import { OrderInfoField } from "./order-info-field";
import { OrderSection } from "./order-section";

interface OrderPaymentSummaryProps {
  order: Order;
  onUpdate?: (order: Order) => void;
}

export function OrderPaymentSummary({ order, onUpdate }: OrderPaymentSummaryProps) {
  const { t } = useTranslation();
  const { PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();
  const [openUpdatePayment, setOpenUpdatePayment] = useState(false);

 
   

  return (
    <OrderSection title="Tổng kết thanh toán" icon="fas fa-receipt">
      <div className="space-y-2 text-sm">
        <OrderInfoField
          layout="horizontal"
          label={t("Tổng tiền hàng")}
          value={`${order?.subtotal?.toLocaleString()} đ`}
        />
        <OrderInfoField
          layout="horizontal"
          label={t("Giảm giá")}
          value={`${order?.discount?.toLocaleString()} đ`}
          labelClassName="text-red-600"
          valueClassName="text-red-600"
        />
        <OrderInfoField
          layout="horizontal"
          label={t("Phí vận chuyển")}
          value={`${order?.shippingFee?.toLocaleString()} đ`}
        />
        <OrderInfoField
          layout="horizontal"
          label={t("Trạng thái thanh toán")}
          value={
            <div className="flex items-center gap-2">
              <StatusLabel className="rounded-sm px-2 py-1" type="border-light" value={order?.paymentStatus} options={PAYMENT_STATUS_OPTIONS} />
              <Button
                icon={<FaEdit />}
                className="h-6 w-6 px-0 text-gray-500 hover:text-primary"
                onClick={() => setOpenUpdatePayment(true)}
                tooltip={t("Cập nhật trạng thái")}
              />
            </div>
          }
        />  
        <div className="pt-2 mt-2 border-t">
          <div className="flex justify-between text-base font-bold">
            <span>{t("TỔNG TIỀN")}:</span>
            <span className="text-lg text-primary">{order?.totalAmount?.toLocaleString()} đ</span>
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
      if (onSuccess && updatedOrder) {
        onSuccess(updatedOrder);
      }
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
       <div className="w-full flex justify-end">
        <Button 
          onClick={handleUpdate}
          text={t("Cập nhật")}
          primary
          isLoading={updating}
          disabled={updating || !status}
        /></div>
    
      </Dialog.Body>
      
    </Dialog>
  );
}
