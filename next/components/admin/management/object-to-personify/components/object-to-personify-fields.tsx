import { useTranslation } from "react-i18next";
import { Field, ImageInput, Input, Textarea } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";

export function ObjectToPersonifyFields() {
  const { t } = useTranslation();

  return (
    <>
      <Field name="imageUrl" label={t("Ảnh đại diện")} cols={12}>
        <ImageInput largeImage cover />
      </Field>
      <Field name="name" label={t("Tên nhân vật")} cols={12} required>
        <Input />
      </Field>
      <Field name="code" label={t("Mã code")} cols={12} required>
        <Input />
      </Field>
      <Field name="prompt" label={t("Prompt mô tả")} cols={12}>
        <Textarea />
      </Field>
      <Field name="isActive" label={t("Kích hoạt")} cols={12}>
        <Switch />
      </Field>
    </>
  );
}
