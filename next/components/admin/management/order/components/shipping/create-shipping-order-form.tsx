import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { ShippingProvider } from "../../../../../../lib/repo";
import { ShopAddress } from "../../../../../../lib/repo/list/shopAddress.repo";
import { Order, orderService } from "../../../../../../lib/repo/order/order.repo";
import { Button, Radio, Textarea } from "../../../../../shared/utilities/form";
import { Field } from "../../../../../shared/utilities/form/field";
import { SelectShippingProvider } from "./select-shipping-provider";
import { SelectShopAddress } from "./select-shop-address";
import { ShippingPackage } from "./shipping-package";

interface CreateShippingOrderFormProps {
  order: Order;
  onSuccess: () => void;
  onClose: () => void;
  selectShippingProvider?: ShippingProvider; 
}

/**
 * Form tạo đơn vận chuyển
 * Cho phép chọn nhà cung cấp và dịch vụ để tạo đơn
 */
export function CreateShippingOrderForm({
  order,
  onSuccess,  
}: CreateShippingOrderFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectShippingProviderId, setSelectShippingProviderId] = useState<string>("");
  const [selectedShopAddress, setSelectedShopAddress] = useState<ShopAddress | null>(null); 
  // Form state
  const [formData, setFormData] = useState({
    orderId: order?.id || "",
    shippingProviderId: selectShippingProviderId || "",
    serviceCode: "",
    serviceTypeId: 2, // Mặc định: 2 = Hàng nhẹ, 5 = Hàng nặng
    insuranceValue: order?.totalAmount || 0,
    note: "",
    shopAddressId: selectedShopAddress?.id || "",
    totalItemsWeight: 0, // Sẽ được cập nhật từ ShippingPackage
    packageWeight: 0, // Sẽ được cập nhật từ ShippingPackage
    length: 0,
    width: 0,
    height: 0,
  });

  // Tự động cập nhật shopAddressId khi chọn địa chỉ
  const handleSelectShopAddress = (address: ShopAddress) => {
    setSelectedShopAddress(address);
    setFormData({ ...formData, shopAddressId: address.id });
  };

  // Memoize weight change handler to prevent infinite loop
  const handleWeightChange = useCallback((totalItemsWeight: number, packageWeight: number, length: number, width: number, height: number) => {
    setFormData((prev) => ({ ...prev, totalItemsWeight, packageWeight, length, width, height }));
  }, []);

  // Xử lý submit form
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validate
      if (!formData.shopAddressId) {
        toast.error(t("Vui lòng chọn địa chỉ lấy hàng"));
        return;
      }

      // Gọi API tạo đơn vận chuyển
      
      const result = await orderService.createShippingOrder(formData);

      if (result.success) {
        toast.success(t("Tạo đơn vận chuyển thành công"));
        onSuccess();
      } else {
        toast.error(result.message || t("Tạo đơn vận chuyển thất bại"));
      }
    } catch (error: any) {
      toast.error(error.message || t("Có lỗi xảy ra khi tạo đơn vận chuyển"));
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="p-4">
      <div>
        {/* Chọn địa chỉ lấy hàng */}
        <SelectShopAddress
          selectedAddress={selectedShopAddress}
          onSelectAddress={handleSelectShopAddress}
        />

        {/* Chọn loại hàng */}
        <Field label={t("Loại hàng")} required>
          <Radio
            value={formData.serviceTypeId}
            onChange={(val) => setFormData({ ...formData, serviceTypeId: val })}
            options={[
              { label: t("Hàng nhẹ (< 20kg)"), value: 2 },
              { label: t("Hàng nặng (≥ 20kg)"), value: 5 },
            ]}
          />
        </Field>

        {/* Thông tin nhà cung cấp dịch vụ vận chuyển */}
        <SelectShippingProvider 
          onSelectShippingProviderId={(id) => {
            setSelectShippingProviderId(id);
            setFormData((prev) => ({ ...prev, shippingProviderId: id }));
          }}
        />

        {/* Chọn thông tin vận chuyển */}
        <ShippingPackage order={order} onWeightChange={handleWeightChange}/>

        {/* Ghi chú */}
        <Field label={t("Ghi chú")}>
          <Textarea
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e })}
            placeholder={t("Nhập ghi chú cho đơn vận chuyển")}
          />
        </Field>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            text={loading ? t("Đang xử lý...") : t("Tạo đơn")}
            primary
            isLoading={loading}
          />
        </div>
      </div>
    </div>
  );
}
