import { useTranslation } from "react-i18next";
import { AddressSelector } from "../../../../index/cart/address-selector";
import { Field, Input, Switch } from "../../../../shared/utilities/form";

/**
 * Component chứa các field của form địa chỉ shop
 * Sử dụng trong DataTable.Form
 */
export function ShopAddressFields() {
  const { t } = useTranslation();

  return (
    <>
      {/* Thông tin người liên hệ */}

      <Field name="recipientName" label={t("Tên người liên hệ")} required cols={4}>
        <Input placeholder={t("Nhập tên người liên hệ")} />
      </Field>

      <Field name="phone" label={t("Số điện thoại")} required cols={4}>
        <Input placeholder={t("Nhập số điện thoại")} />
      </Field>

      <Field name="email" label={t("Email")} cols={4}>
        <Input placeholder={t("Nhập email")} type="email" />
      </Field>

      <AddressSelector />

      <Field name="postalCode" label={t("Mã bưu điện")} cols={6}>
        <Input placeholder={t("Nhập mã bưu điện")} />
      </Field>

      <Field name="note" label={t("Ghi chú")} cols={12}>
        <Input placeholder={t("Nhập ghi chú")} />
      </Field>

      <Field name="default" label={t("Đặt làm địa chỉ mặc định")} cols={6}>
        <Switch />
      </Field>

      <Field name="isActive" label={t("Trạng thái hoạt động")} cols={6}>
        <Switch />
      </Field>
    </>
  );
}
