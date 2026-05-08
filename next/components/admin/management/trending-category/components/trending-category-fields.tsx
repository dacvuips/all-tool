import { useTranslation } from "react-i18next";
import { Field, Input } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";

export function TrendingCategoryFields() {
  const { t } = useTranslation();

  return (
    <>
      <Field name="name" label={t("Tên danh mục")} cols={12} required>
        <Input />
      </Field>
      <Field name="priority" label={t("Thứ tự ưu tiên")} cols={6}>
        <Input number />
      </Field>
      <Field name="isHot" label={t("Đánh dấu HOT")} cols={6}>
        <Switch />
      </Field>
      <Field name="isActive" label={t("Kích hoạt")} cols={6}>
        <Switch />
      </Field>
    </>
  );
}
