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
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";

interface OrderUpdateDialogProps extends DialogProps {
  order: Order;
  onSuccess?: (updatedOrder: Order) => void;
}

export function OrderUpdateDialog({ order, onSuccess, ...props }: OrderUpdateDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Order Info State
  const [status, setStatus] = useState(order.status);
  const [shippingNote, setShippingNote] = useState(order.shippingAddress.note || "");

  // Customer Info State
  const [recipientName, setRecipientName] = useState(order.shippingAddress?.recipientName || "");
  const [phone, setPhone] = useState(order.shippingAddress?.phone || "");
  const [email, setEmail] = useState(order.shippingAddress?.email || "");
  const [address, setAddress] = useState(order.shippingAddress?.address || "");
  const { ORDER_STATUS_OPTIONS } = useOptionsTranslation();

  const handleSave = async () => {
    try {
      setLoading(true);

      const { __typename, ...shippingAddressWithoutTypename } = (order.shippingAddress ||
        {}) as any;
      const updateData: any = {
        status,
        adminNote: shippingNote,
        shippingAddress: {
          ...shippingAddressWithoutTypename,
          recipientName,
          phone,
          email,
          address,
        },
      };

      const updatedOrder = await orderService.updateOrder(order.id, updateData);

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
    <Form dialog {...props} title={t("Cập nhật thông tin đơn hàng")} width="700px">
      <TabGroup name="order-update" className="p-4">
        <TabGroup.Tab label={t("Thông Tin Đơn Hàng")}>
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  {t("Mã đơn hàng")}
                </label>
                <Input value={order.orderNumber} readOnly className="bg-gray-50" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  {t("Ngày tạo")}
                </label>
                <Input
                  value={order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : ""}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {t("Trạng thái")}
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e)}
                options={ORDER_STATUS_OPTIONS}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {t("Loại đơn")}
              </label>
              <Input value="online" readOnly className="bg-gray-50" />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {t("Ghi chú giao hàng")}
              </label>
              <Textarea
                value={shippingNote}
                onChange={(e) => setShippingNote(e)}
                rows={4}
                placeholder={t("Nhập ghi chú giao hàng...")}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button text={t("Hủy")} onClick={props.onClose} />
              <Button
                text={t("Lưu")}
                primary
                isLoading={loading}
                onClick={handleSave}
                icon={<i className="fas fa-save"></i>}
              />
            </div>
          </div>
        </TabGroup.Tab>

        <TabGroup.Tab label={t("Thông Tin Khách Hàng")}>
          <div className="pt-4 space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {t("Tên khách hàng")}
              </label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e)}
                placeholder={t("Nhập tên khách hàng")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  {t("Số điện thoại")}
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e)}
                  placeholder={t("Nhập số điện thoại")}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e)}
                  placeholder={t("Nhập email")}
                  type="email"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">{t("Địa chỉ")}</label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e)}
                rows={3}
                placeholder={t("Nhập địa chỉ giao hàng")}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button text={t("Hủy")} onClick={props.onClose} />
              <Button
                text={t("Lưu")}
                primary
                isLoading={loading}
                onClick={handleSave}
                icon={<i className="fas fa-save"></i>}
              />
            </div>
          </div>
        </TabGroup.Tab>
      </TabGroup>
    </Form>
  );
}
