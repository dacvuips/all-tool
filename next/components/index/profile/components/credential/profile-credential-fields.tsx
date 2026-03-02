import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { AiProviderKeyEnum } from "../../../../../lib/repo/ai-provider/ai-provider.repo";
import { Field, Input, Select } from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";
import { useDataTable } from "../../../../shared/utilities/table/data-table";

const CREDENTIAL_KEY_OPTIONS = Object.values(AiProviderKeyEnum).map((key) => ({
  value: key,
  label: key.replace(/_/g, " "),
}));

export function ProfileCredentialFields() {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const { formItem } = useDataTable();

  return (
    <>
      <div className="col-span-12">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("Thông tin chứng chỉ")}</h3>
      </div>
      <Field name="key" label={t("Loại (Key)")} cols={sm ? 6 : 12} required>
        <Select
          options={CREDENTIAL_KEY_OPTIONS}
          placeholder={t("Chọn loại chứng chỉ")}
          clearable={false}
          readOnly={!!formItem?.id}
        />
      </Field>
      <Field name="value" label={t("Giá trị (Token)")} cols={sm ? 6 : 12} required>
        <Input placeholder={t("Nhập token / API key")} />
      </Field>
      <Field name="active" label={t("Kích hoạt")} cols={sm ? 6 : 12}>
        <Switch />
      </Field>
    </>
  );
}
