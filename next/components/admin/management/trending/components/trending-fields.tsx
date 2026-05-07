import { useTranslation } from "react-i18next";
import { Field, ImageInput, Input, Textarea } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";

export function TrendingFields() {
  const { t } = useTranslation();

  return (
    <>
      <Field name="imageUrls" label={t("Danh sách ảnh")} cols={12}>
        <ImageInput largeImage cover multi />
      </Field>
      <Field name="name" label={t("Tên trending")} cols={12} required>
        <Input />
      </Field>
      <Field name="prompt" label={t("Prompt mô tả")} cols={12}>
        <Textarea />
      </Field>
      <Field name="count" label={t("Số lượt sử dụng")} cols={6}>
        <Input number />
      </Field>
      <Field name="isActive" label={t("Kích hoạt")} cols={6}>
        <Switch />
      </Field>
    </>
  );
}
