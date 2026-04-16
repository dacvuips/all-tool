import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";

import { AiProviderKeyEnum } from "../../../../../lib/repo/product/productApp.repo";
import { Field, Select, Textarea } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";
import { useDataTable } from "../../../../shared/utilities/table/data-table";

export function CredentialFields() {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const { formItem } = useDataTable();
  const { CREDENTIAL_KEY_OPTIONS } = useOptionsTranslation();
  const { control } = useFormContext();
  const selectedKey = useWatch({ control, name: "key" });
  const isGemini = selectedKey === AiProviderKeyEnum.GOOGLE_GEMINI_KEY;

  return (
    <>
      <div className="col-span-12">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("Thông tin chứng chỉ")}</h3>
      </div>
      <Field name="key" label={t("Loại (Key)")} cols={12} required>
        <Select
          hasImage
          options={CREDENTIAL_KEY_OPTIONS}
          placeholder={t("Chọn loại chứng chỉ")}
          clearable={false}
          readOnly={!!formItem?.id}
        />
      </Field>
      <Field name="value" label={t("Giá trị (Token)")} cols={12} required={!isGemini}>
        <Textarea placeholder={t("Nhập token / API key")} />
      </Field>
      <Field name="active" label={t("Kích hoạt")} cols={12}>
        <Switch />
      </Field>
    </>
  );
}
