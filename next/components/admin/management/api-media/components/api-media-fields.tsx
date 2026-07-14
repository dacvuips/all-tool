import { useTranslation } from "react-i18next";
import { ApiMediaSubscriptionPlanEnum } from "../../../../../lib/repo/api-media-token/api-media-token.repo";
import { CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { DatePicker, Field, Input, Select } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";
import { useDataTable } from "../../../../shared/utilities/table/data-table";

const PLAN_OPTIONS = [
  { value: ApiMediaSubscriptionPlanEnum.FREE, label: "Free" },
  { value: ApiMediaSubscriptionPlanEnum.BASIC, label: "Basic" },
  { value: ApiMediaSubscriptionPlanEnum.STANDARD, label: "Standard" },
  { value: ApiMediaSubscriptionPlanEnum.PROFESSIONAL, label: "Professional" },
  { value: ApiMediaSubscriptionPlanEnum.UNLIMITED, label: "Unlimited" },
];

export function ApiMediaFields() {
  const { t } = useTranslation();
  const { formItem } = useDataTable();
  const isEdit = !!formItem?.id;

  return (
    <>
      <Field
        name="key"
        label={t("API Key")}
        cols={12}
        tooltip={
          isEdit
            ? t("Để trống nếu không muốn đổi key. Nhập key mới sẽ thay thế key hiện tại.")
            : t("Để trống để hệ thống tự sinh key.")
        }
      >
        <Input placeholder={isEdit ? t("Nhập key mới (tùy chọn)") : t("Tự sinh nếu để trống")} />
      </Field>

      {!isEdit && (
        <Field name="customerId" label={t("Khách hàng")} cols={12} required>
          <Select
            clearable
            placeholder={t("Chọn khách hàng")}
            autocompletePromise={(props) =>
              CustomerService.getAllAutocompletePromise(props, {
                fragment: "id name avatarUrl email",
                parseOption: (data) => ({
                  value: data.id,
                  label: data.name || data.email || data.id,
                  image: data.avatarUrl,
                }),
              })
            }
            hasImage
          />
        </Field>
      )}

      <Field name="subscriptionPlan" label={t("Gói đăng ký")} cols={6}>
        <Select options={PLAN_OPTIONS} placeholder={t("Chọn gói")} clearable={false} />
      </Field>

      <Field name="active" label={t("Kích hoạt")} cols={6}>
        <Switch />
      </Field>

      <Field name="requestQuantity" label={t("Số request cho phép")} cols={6}>
        <Input number />
      </Field>

      {isEdit && (
        <Field name="usedQuantity" label={t("Số request đã dùng")} cols={6}>
          <Input number />
        </Field>
      )}

      <Field
        name="streamCount"
        label={t("Số luồng đồng thời")}
        cols={6}
        tooltip={t("-1 = không giới hạn")}
      >
        <Input number />
      </Field>

      <Field name="expiredDate" label={t("Ngày hết hạn")} cols={6}>
        <DatePicker />
      </Field>
    </>
  );
}
