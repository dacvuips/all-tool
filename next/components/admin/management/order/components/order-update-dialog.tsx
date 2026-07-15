import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Order, orderService } from "../../../../../lib/repo";
import { DialogProps } from "../../../../shared/utilities/dialog/dialog";
import { Form } from "../../../../shared/utilities/form";
import { Button } from "../../../../shared/utilities/form/button";
import { Input } from "../../../../shared/utilities/form/input";
import { Select } from "../../../../shared/utilities/form/select";
import { Textarea } from "../../../../shared/utilities/form/textarea";
import { ORDER_TYPE_LABELS } from "./order-ui-helpers";

interface OrderUpdateDialogProps extends DialogProps {
  order: Order;
  onSuccess?: (updatedOrder: Order) => void;
}

export function OrderUpdateDialog({ order, onSuccess, ...props }: OrderUpdateDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(order.status);
  const [adminNote, setAdminNote] = useState(order.adminNote || "");
  const { ORDER_STATUS_OPTIONS } = useOptionsTranslation();

  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedOrder = await orderService.updateOrder(order.id, {
        status,
        adminNote,
      } as any);
      toast.success(t("Cập nhật đơn hàng thành công"));
      onSuccess?.(updatedOrder);
      props.onClose?.();
    } catch (error: any) {
      toast.error(error.message || t("Có lỗi xảy ra khi cập nhật đơn hàng"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form dialog {...props} title={t("Cập nhật thông tin đơn hàng")} width="560px">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              {t("Mã đơn hàng")}
            </label>
            <Input value={order.orderNumber} readOnly className="bg-gray-50" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">{t("Ngày tạo")}</label>
            <Input
              value={order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : ""}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">{t("Loại đơn")}</label>
            <Input
              value={order.type ? t(ORDER_TYPE_LABELS[order.type] || order.type) : "-"}
              readOnly
              className="bg-gray-50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">{t("Gói")}</label>
            <Input
              value={order.subscriptionPlan || "-"}
              readOnly
              className="bg-gray-50 capitalize"
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">{t("Trạng thái")}</label>
          <Select value={status} onChange={(e) => setStatus(e)} options={ORDER_STATUS_OPTIONS} />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">{t("Ghi chú admin")}</label>
          <Textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e)}
            rows={4}
            placeholder={t("Nhập ghi chú...")}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button text={t("Hủy")} onClick={props.onClose} />
          <Button text={t("Lưu")} primary isLoading={loading} onClick={handleSave} />
        </div>
      </div>
    </Form>
  );
}
