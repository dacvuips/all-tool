import { useTranslation } from "react-i18next";
import { HiOutlinePencil, HiOutlinePrinter, HiOutlineX } from "react-icons/hi";
import { Order, OrderStatus } from "../../../../../lib/repo";
import { Button } from "../../../../shared/utilities/form/button";

interface OrderActionsProps {
  order: Order;
  canEdit: boolean;
  cancelling: boolean;
  onPrintInvoice: () => void;
  onUpdateOrder: () => void;
  onCancelOrder: () => void;
}

export function OrderActions({
  order,
  canEdit,
  cancelling,
  onPrintInvoice,
  onUpdateOrder,
  onCancelOrder,
}: OrderActionsProps) {
  const { t } = useTranslation();
  const cancelled = order.status === OrderStatus.CANCELLED;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button
        text={t("In hóa đơn")}
        outline
        className="w-full sm:w-auto"
        onClick={onPrintInvoice}
        icon={<HiOutlinePrinter />}
      />
      <Button
        text={t("Chỉnh sửa đơn hàng")}
        primary
        className="w-full sm:w-auto"
        disabled={!canEdit || cancelled}
        onClick={onUpdateOrder}
        icon={<HiOutlinePencil />}
      />
      <Button
        text={t("Hủy đơn hàng")}
        danger
        className="w-full sm:w-auto"
        disabled={!canEdit || cancelling || cancelled || order.status === OrderStatus.DELIVERED}
        isLoading={cancelling}
        onClick={onCancelOrder}
        icon={<HiOutlineX />}
      />
    </div>
  );
}
