import { useTranslation } from "react-i18next";
import { useFormContext, useWatch } from "react-hook-form";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { AiProviderKeyEnum } from "../../../../../lib/repo/product";
import { Field, Input, Select } from "../../../../shared/utilities/form";
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
      <Field name="key" label={t("Loại (Key)")} cols={sm ? 6 : 12} required>
        <Select
          hasImage
          options={CREDENTIAL_KEY_OPTIONS}
          placeholder={t("Chọn loại chứng chỉ")}
          clearable={false}
          readOnly={!!formItem?.id}
        />
      </Field>
      <Field name="value" label={t("Giá trị (Token)")} cols={sm ? 6 : 12} required={!isGemini}>
        <Input placeholder={t("Nhập token / API key")} />
      </Field>
      <Field name="active" label={t("Kích hoạt")} cols={sm ? 6 : 12}>
        <Switch />
      </Field>

      {isGemini && (
        <>
          <div className="col-span-12">
            <h3 className="mb-3 text-lg font-semibold text-gray-800">
              {t("Vertex AI OAuth2 (tuỳ chọn)")}
            </h3>
            <p className="mb-2 text-sm text-gray-500">
              {t("Điền để sử dụng Vertex AI qua OAuth2. Bỏ trống nếu dùng API key thông thường.")}
            </p>
          </div>
          <Field name="oauthClientId" label={t("OAuth Client ID")} cols={sm ? 6 : 12}>
            <Input placeholder={t("Nhập OAuth Client ID")} />
          </Field>
          <Field name="oauthClientSecret" label={t("OAuth Client Secret")} cols={sm ? 6 : 12}>
            <Input placeholder={t("Nhập OAuth Client Secret")} />
          </Field>
          <Field name="oauthRefreshToken" label={t("OAuth Refresh Token")} cols={12}>
            <Input placeholder={t("Nhập OAuth Refresh Token")} />
          </Field>
        </>
      )}
    </>
  );
}
