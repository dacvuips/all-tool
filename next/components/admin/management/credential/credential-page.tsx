import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Credential, credentialService } from "../../../../lib/repo";
import { Field, Form, Input, Switch } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";

export const CredentialPage = () => {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const [credential, setCredential] = useState<Credential | null>(null);

  // Load credential data
  const loadCredential = async () => {
    try {
      setLoading(true);
      const cred = (await credentialService.getMyCredential()) as Credential;
      if (cred) {
        setCredential(cred);
      }
    } catch (error) {
      console.error("Load credential error:", error);
      toast.error(t("Không thể tải dữ liệu"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredential();
  }, []);

  const handleSubmit = async (data) => {
    try {
      setLoading(true);

      await credentialService.createOrUpdate({
        id: credential?.id,
        data,
      });

      toast.success(t("Cập nhật thành công"));
      await loadCredential();
    } catch (error: any) {
      console.error("Update credential error:", error);
      toast.error(error.message || t("Không thể cập nhật"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto">
      <Card>
        <Form grid onSubmit={handleSubmit} defaultValues={credential}>
          {/* Google AI Studio */}
          <Field name="googleAIStudio.value" label={t("Google AI Studio Token")} cols={9}>
            <Input placeholder={t("Nhập Google AI Studio Token")} type="password" />
          </Field>
          <Field name="googleAIStudio.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>
          {/* ChatGPT */}
          <Field name="chatGPT.value" label={t("ChatGPT Token")} cols={9}>
            <Input placeholder={t("Nhập ChatGPT Token")} type="password" />
          </Field>
          <Field name="chatGPT.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>
          {/* GHN Token */}
          <Field name="ghnToken.value" label={t("GHN Token")} cols={9}>
            <Input placeholder={t("Nhập GHN Token")} type="password" />
          </Field>
          <Field name="ghnToken.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>

          {/* Giao Hang Tiet Kiem */}
          <Field name="giaoHangTietKiem.value" label={t("Giao Hàng Tiết Kiệm Token")} cols={9}>
            <Input placeholder={t("Nhập Giao Hàng Tiết Kiệm Token")} type="password" />
          </Field>
          <Field name="giaoHangTietKiem.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>
          {/* SPX */}
          <Field name="spx.value" label={t("SPX Token")} cols={9}>
            <Input placeholder={t("Nhập SPX Token")} type="password" />
          </Field>
          <Field name="spx.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>
          {/* JT Express */}
          <Field name="jtExpress.value" label={t("JT Express Token")} cols={9}>
            <Input placeholder={t("Nhập JT Express Token")} type="password" />
          </Field>
          <Field name="jtExpress.active" label={t("Kích hoạt")} cols={3}>
            <Switch />
          </Field>

          <Form.Footer
            isLoading={loading}
            submitProps={{ disabled: !userPermission("EDIT_CREDENTIAL") }}
            cancelText=""
          />
        </Form>
      </Card>
    </div>
  );
};
