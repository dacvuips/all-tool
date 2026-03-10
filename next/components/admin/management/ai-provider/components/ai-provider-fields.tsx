import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { Field, ImageInput, Input } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";

export function AiProviderFields() {
  const { t } = useTranslation();
  const sm = useScreen("sm");

  return (
    <>
      <div className="col-span-12">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("Thông tin nhà cung cấp AI")}</h3>
      </div>
      <Field name="name" label={t("Tên")} cols={sm ? 6 : 12} required>
        <Input placeholder={t("Tên nhà cung cấp")} />
      </Field>
      <Field name="key" label={t("Mã (key)")} cols={sm ? 6 : 12}>
        <Input placeholder={t("Mã định danh")} />
      </Field>
      <Field name="imgUrl" label={t("Ảnh / Logo")} cols={sm ? 6 : 12}>
        <ImageInput />
      </Field>
      <Field name="website" label={t("Website")} cols={sm ? 6 : 12}>
        <Input type="url" placeholder={t("https://...")} />
      </Field>
      <Field name="active" label={t("Kích hoạt")} cols={sm ? 6 : 12}>
        <Switch placeholder={t("Đang hoạt động")} />
      </Field>
    </>
  );
}
