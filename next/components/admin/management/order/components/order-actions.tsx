import { useTranslation } from "react-i18next";
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

  return (
    <div className="flex flex-col gap-2 md:flex-row md:justify-end">
      <Button
        text={t("In hóa đơn")}
        primary
        className="w-full md:w-auto"
        onClick={onPrintInvoice}
        icon={<i className="fas fa-print"></i>}
      />
      <Button
        text={t("Chỉnh sửa đơn hàng")}
        primary
        className="w-full md:w-auto"
        disabled={!canEdit || order.status === OrderStatus.CANCELLED}
        onClick={onUpdateOrder}
        icon={<i className="fas fa-edit"></i>}
      />
      <Button
        text={t("Hủy đơn hàng")}
        className="w-full text-white bg-red-600 hover:bg-red-700 md:w-auto"
        disabled={
          !canEdit ||
          cancelling ||
          order.status === OrderStatus.CANCELLED ||
          order.status === OrderStatus.DELIVERED
        }
        isLoading={cancelling}
        onClick={onCancelOrder}
        icon={<i className="fas fa-times"></i>}
      />
    </div>
  );
}
