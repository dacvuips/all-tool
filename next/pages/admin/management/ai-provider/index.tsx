import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { AiProviderPage } from "../../../../components/admin/management/ai-provider/ai-provider-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

/**
 * Page quản lý nhà cung cấp AI
 * Route: /admin/management/ai-provider
 */
export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Nhà cung cấp AI")} />
      <AiProviderPage />
    </>
  );
}

Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
