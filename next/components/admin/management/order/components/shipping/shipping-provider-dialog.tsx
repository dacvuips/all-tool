import { useTranslation } from "react-i18next";
import { ShippingProvider } from "../../../../../../lib/repo";
import { Order } from "../../../../../../lib/repo/order/order.repo";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { CreateShippingOrderForm } from "./create-shipping-order-form";

interface ShippingProviderDialogProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectShippingProvider?: ShippingProvider;
}

/**
 * Dialog hiển thị danh sách shipping providers và form tạo đơn
 */
export function ShippingProviderDialog({
  order,
  isOpen,
  onClose,
  onSuccess,
  selectShippingProvider,
}: ShippingProviderDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t("Tạo đơn vận chuyển")} width="600px">
      <CreateShippingOrderForm
        selectShippingProvider={selectShippingProvider}
        order={order}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    </Dialog>
  );
}
